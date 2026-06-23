type LocalizableSource = {
  title?: string | null;
  tree?: string | null;
  tree_parts?: string[] | null;
  text?: string | null;
  language?: string | null;
};

function normalizeLang(lang: string | null | undefined): "he" | "en" {
  return lang === "en" ? "en" : "he";
}

function splitText(text: string, max = 3200) {
  const parts: string[] = [];
  let rest = text;
  while (rest.length > max) {
    const cutAt = Math.max(
      rest.lastIndexOf("\n\n", max),
      rest.lastIndexOf(". ", max),
      rest.lastIndexOf(" ", max),
    );
    const cut = cutAt > max * 0.55 ? cutAt : max;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

async function translateText(text: string, targetLang: "he" | "en", label: string) {
  if (!text.trim()) return text;
  const { chatCompletion } = await import("./ai-gateway.server");
  const system =
    targetLang === "he"
      ? "תרגם לעברית בלבד. שמור נאמנות למקור, שמות ספרים/אנשים ומונחי חסידות. אל תוסיף הסברים ואל תקצר. החזר רק את התרגום."
      : "Translate to English only. Preserve Chabad/Chassidus terms, book/person names, and paragraph structure. Do not add explanations or summaries. Return only the translation.";
  return chatCompletion({
    system,
    messages: [{ role: "user", content: `${label}:\n\n${text}` }],
    temperature: 0.1,
  });
}

export async function localizeSourceForStudy<T extends LocalizableSource>(
  source: T,
  target: "he" | "en",
) {
  const sourceLang = normalizeLang(source.language);
  if (sourceLang === target) {
    return { ...source, original_language: sourceLang, localized_language: target };
  }

  try {
    const [title, tree, treeParts, ...textParts] = await Promise.all([
      translateText(source.title ?? "", target, "Title"),
      translateText(source.tree ?? "", target, "Breadcrumb"),
      Promise.all(
        (source.tree_parts ?? []).map((part) => translateText(part, target, "Breadcrumb part")),
      ),
      ...splitText(source.text ?? "").map((part, index) =>
        translateText(part, target, `Source text part ${index + 1}`),
      ),
    ]);

    return {
      ...source,
      title: title || source.title,
      tree: tree || source.tree,
      tree_parts: treeParts.length ? treeParts : source.tree_parts,
      text: textParts.join("\n\n") || source.text,
      language: target,
      original_language: sourceLang,
      localized_language: target,
    };
  } catch (error) {
    console.warn("localizeSourceForStudy fallback", error);
    return { ...source, original_language: sourceLang, localized_language: sourceLang };
  }
}
