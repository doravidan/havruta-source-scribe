# חסידותה — תכנית בנייה: "משפיע AI אישי"

## חזון מוצרי

חסידותה אינה ספרייה דיגיטלית — היא **משפיע חב"די דיגיטלי** שמלווה את היהודי בלימוד חסידות ובעבודת ה' מדי יום. המערכת זוכרת מי המשתמש, מה הוא למד, במה הוא מתקשה, ומכוונת אותו הלאה.

הצעד הראשון: שדרוג ה-Ask הקיים ל**צ'אט שיחתי עם זיכרון אישי**, מבוסס על המאגר הקיים (Tanya, מאמרים, שיחות, היום יום), עם פרופיל לימודי מתפתח.

---

## עקרונות

1. **שיחה, לא שאילתות.** כל שאלה ממשיכה את ההקשר הקודם. המשפיע שואל בחזרה ובודק הבנה.
2. **זיכרון אישי.** מה המשתמש לומד עכשיו (פרק בתניא, מאמר), נושאים שחזרו, שאלות פתוחות, רמת הבנה משוערת.
3. **גרונדינג בקורפוס.** כל תשובה מסתמכת על מקורות שהמשתמש יכול לפתוח. הסברים מקושרים לציטוטים.
4. **כיוון לפעולה.** סוף כל שיחה: הצעת המשך — מקור לקרוא, שאלה למחשבה, או חזרה לחומר קודם.

---

## ארכיטקטורה

### צד שרת — AI SDK + Lovable AI Gateway

החלפת `askHavruta` (one-shot generateText) ב-**streaming chat agent** עם tools.

- **Route חדש**: `src/routes/api/mashpia.ts` — POST handler עם `streamText` + `toUIMessageStreamResponse({ originalMessages, onFinish })`.
- **מודל**: `google/gemini-3-flash-preview` דרך helper חדש `src/lib/ai-gateway.server.ts` (`createLovableAiGatewayProvider`). שומרים על OpenRouter כ-fallback בלבד אם המפתח חסר.
- **System prompt**: זהות "משפיע חב"די" — חם, מכבד, מבוסס מקורות, חוזר בעברית בלבד (או אנגלית לפי `lang`), מסיים בשאלת המשך אחת.
- **Tools** (כולם `tool({ inputSchema: z..., execute })`):
  - `search_corpus({ query, top_k })` — vector search על `source_chunks` (RPC `match_chunks` הקיים) + fallback מילולי. מחזיר עד 6 קטעים מסוכמים עם `source_id`.
  - `open_source({ source_id })` — מחזיר טקסט מלא של מקור מטבלת `sources` (חתוך ל-8K תווים) כדי שהמודל יוכל לצטט מדויק.
  - `record_learning_event({ kind, source_id?, topic?, note? })` — `kind` ∈ `'studied' | 'struggled' | 'asked_followup' | 'insight'`. כותב ל-`learning_events`.
  - `recommend_next({ context })` — בוחר המלצה ע"פ היסטוריית `study_progress` + `learning_events`: המשך הפרק, מאמר קשור, או חזרה למה שלא הובן.
- **Loop control**: `stopWhen: stepCountIs(50)`.
- **Auth**: ה-handler קורא ל-Supabase דרך publishable client + bearer token של המשתמש (כמו דפוס `_authenticated`). מ-onFinish שומר הודעות לטבלת `mashpia_messages`.

### צד שרת — Server functions תומכות

- `src/lib/mashpia.functions.ts` (`createServerFn` עם `requireSupabaseAuth`):
  - `listConversations` — שיחות של המשתמש (id, title, updated_at, last_message_preview).
  - `createConversation` — שיחה חדשה, מחזירה `id`.
  - `getConversation({ id })` — מטה-דאטה + `UIMessage[]` משוחזרים מ-`mashpia_messages`.
  - `deleteConversation({ id })`.
  - `getLearningContext` — סיכום קצר של הפרופיל הלימודי לזריקה ל-system prompt בכל שיחה חדשה (מה לומד עכשיו, נושאים חוזרים, אחרון שנעצר).

### Database — מיגרציה חדשה

טבלאות (public, עם GRANTs ו-RLS):

- `mashpia_conversations`
  - `id uuid pk`, `user_id uuid` (FK `auth.users`, on delete cascade)
  - `title text` (נוצר אוטומטית מהשאלה הראשונה אחרי 1-2 turns)
  - `created_at`, `updated_at` (trigger)
  - RLS: own rows only.
- `mashpia_messages`
  - `id uuid pk`, `conversation_id uuid` (FK cascade), `user_id uuid`
  - `role text check in ('user','assistant','system')`
  - `parts jsonb` — full AI SDK `UIMessage.parts` (text + tool calls/results)
  - `created_at`
  - אינדקס על `(conversation_id, created_at)`
  - RLS: own rows only (via `user_id`).
- `learning_events`
  - `id uuid pk`, `user_id uuid`, `kind text`, `source_id uuid null` (FK `sources`), `topic text null`, `note text null`, `created_at`
  - אינדקס על `(user_id, created_at desc)`
  - RLS: own rows only; writes גם דרך service-role מתוך handler ה-tool.
- שדרוג `profiles`: עמודות `learning_level text default 'beginner'`, `interests text[] default '{}'`, `daily_minutes int default 15`.

GRANTs: `authenticated` SELECT/INSERT/UPDATE/DELETE על שלוש הטבלאות; `service_role ALL`. אין `anon`.

### Frontend — UI חדש

**ניתוב לפי `chat-agent-ui-contract`**: threads + database persistence (המשתמש בחר "משפיע AI" כמשמעותי, ופרופיל לימודי דורש DB). מבנה:

- `src/routes/_authenticated/mashpia.tsx` — דף ראשי: בוחר/יוצר שיחה ומנווט ל-`/mashpia/$conversationId`.
- `src/routes/_authenticated/mashpia.$conversationId.tsx` — דף שיחה. Layout עם sidebar רשימת שיחות + אזור הצ'אט.
- `MashpiaChatWindow` (keyed by `conversationId`):
  - שימוש ב-AI Elements: `Conversation`, `Message`/`MessageContent`/`MessageResponse`, `PromptInput`/`PromptInputTextarea`/`PromptInputFooter`/`PromptInputSubmit`, `Shimmer`, `Tool`/`ToolHeader`/`ToolContent` (כל אלה דרך `bun x ai-elements@latest add ...` לפני כתיבת UI).
  - `useChat({ id: conversationId, messages: loaded, transport: new DefaultChatTransport({ api: '/api/mashpia' }) })`.
  - Optimistic user message + Shimmer "המשפיע חושב…" כשה-status הוא `submitted`.
  - רינדור `message.parts`: טקסט עם markdown (`react-markdown`), tool calls כקלפסות סגורות (`<Tool defaultOpen={false}>`).
  - כשmsg מכיל קריאה ל-`search_corpus` או `open_source`, מציגים מתחת לטקסט "מקורות בשיחה" — לחיצה פותחת את `SourceReader` הקיים.
- `MashpiaSidebar`: רשימת שיחות, כפתור "שיחה חדשה" (יוצר, מנווט), מחיקה בכפתור נפרד (לא nested button), היילייט פעיל.
- Composer textarea ממקד עצמו: ב-mount, אחרי שליחה, אחרי גמר stream, ובמעבר שיחה.

### זהות חזותית

- לוגו זעיר חדש למשפיע (תמונה מיוצרת — נר/אות אלף סטיילז, לא `Sparkles`). מיובא מ-`src/assets/mashpia-logo.png`.
- צבעי הצ'אט: assistant ללא רקע (טקסט על הקנבס הראשי), user bubble ב-`bg-primary text-primary-foreground` כמו טוקני המערכת הקיימים.
- שומר על שפת העיצוב הקיימת (scholar-card, פונט עברי `Frank Ruhl Libre`).

### עדכון `start.ts`

- ודא ש-`attachSupabaseAuth` כבר ב-`functionMiddleware` (קיים) — אין שינוי.
- אם ה-route `/api/mashpia` קורא ל-Supabase מתוך ה-handler עם ה-bearer של המשתמש, קוראים ידנית ל-`Authorization` מ-`request.headers` ובונים supabase client לכל בקשה (לא middleware של server-fn).

---

## שלבים (לפי סדר ביצוע)

1. **מיגרציה**: enums (אם צריך), `mashpia_conversations`, `mashpia_messages`, `learning_events`, עדכון `profiles`. GRANTs + RLS + indexes + triggers.
2. **AI Gateway helper**: `src/lib/ai-gateway.server.ts` עם `createLovableAiGatewayProvider`. (החלפת ה-OpenRouter wrapper אחורה, או כשכבת ברירת מחדל.)
3. **התקנת AI Elements**: `bun x ai-elements@latest add conversation message prompt-input shimmer tool`.
4. **התקנת AI SDK חבילות**: `ai`, `@ai-sdk/react`, `@ai-sdk/openai-compatible`, `zod` (כבר קיים).
5. **Route `/api/mashpia`**: streamText + tools + onFinish persist.
6. **Server functions** ל-conversations + learning context.
7. **דפי route** `/mashpia` + `/mashpia/$conversationId` תחת `_authenticated`.
8. **קומפוננטות**: `MashpiaChatWindow`, `MashpiaSidebar`, `MashpiaSourceChip`.
9. **לוגו** מיוצר + עדכון `TopBar` עם קישור "משפיע".
10. **תרגומים** ב-`i18n.ts`: כל המחרוזות החדשות (he/en).
11. **בדיקות Playwright**: יצירת שיחה, שליחת הודעה, רענון = ההודעות חוזרות, יצירת שיחה שנייה לא דולפת ל-`/mashpia/<id1>`, לחיצה על מקור פותחת קורא.
12. **שמירה במגירה לעתיד**: לימוד יומי מותאם, חברותא חכמה, פיד "התוועדות" — אלה לא בסבב הזה.

---

## הערות טכניות

- שיחה חדשה: ה-frontend קורא `createConversation` → מקבל `id` → `navigate({ to: '/mashpia/$conversationId', params: { conversationId: id }})`. אין `useEffect` שיוצר שיחה אוטומטית בעמוד / (StrictMode).
- ID של הודעות AI SDK הם `msg_...` strings — לא מכניסים אותם לעמודת `uuid`. ה-`id` של `mashpia_messages` הוא UUID נוצר ב-DB; ה-`UIMessage.id` של ה-SDK נשמר רק אם נדרש לעמודה `text` נפרדת (כרגע לא נדרש).
- `onFinish` שומר את הודעת המשתמש + הודעת ה-assistant המלאה (כולל tool parts) בטרנזקציה הגיונית — אם insert נכשל, מחזירים שגיאה ל-stream לוג ולא מסתירים.
- שגיאות gateway: `402` (credits) ו-`429` (rate) מוצגות למשתמש ב-toast עם הודעה ברורה.
- Tool `search_corpus` משתמש ב-RPC `match_chunks` הקיים — אין שינוי במאגר העובדות.
- ה-system prompt מוזרק עם `getLearningContext` בתחילת כל שיחה חדשה; בשיחה קיימת לא חוזרים על זה אלא משתמשים בהיסטוריית ה-messages.
- מובייל: sidebar הופך ל-Drawer מתחת ל-`md`.

---

## תוצרים (Definition of Done)

- משתמש מחובר יכול להיכנס ל-`/mashpia`, ליצור שיחה, לכתוב "תסביר לי דירה בתחתונים", לקבל תשובה זורמת עם 2-3 מקורות שלחיצה עליהם פותחת את ה-Reader.
- שיחה שנייה היא URL נפרד; רענון משחזר את ההודעות.
- כשמשתמש כותב "לא הבנתי", ה-tool `record_learning_event({ kind: 'struggled' })` נקרא וניתן לראות את הרשומה ב-`learning_events`.
- המשפיע מסיים תמיד בשאלת המשך או בהצעת מקור.
- אין דליפה של הודעות בין שיחות. אין כפילויות שיחה ב-StrictMode.
- Build + typecheck ירוקים.

---

## פיצ'רים עתידיים (לא בסבב הזה — לתיעוד בלבד)

- **לימוד יומי מותאם** (חת"ת/רמב"ם/היום יום/מאמר) — דורש cron + מנוע המלצה מבוסס `learning_events`.
- **חברותא חכמה** ("מצא לי חברותא עכשיו") — דורש WebRTC + matchmaking + נוכחות חיה. בנפרד, אחרי שהמשפיע יציב.
- **פיד "התוועדות"** — תובנות שמשתמשים מפרסמים. דורש moderation.
- **מסע חסידי** — visualization של ההתקדמות (טיימליין, לא ניקוד).
