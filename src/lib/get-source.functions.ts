import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  id: z.string().uuid(),
  lang: z.enum(["he", "en"]).default("he"),
});

function normalizeLang(lang: string | null | undefined): "he" | "en" {
  return lang === "en" ? "en" : "he";
}

export const getSource = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { getPublicServerClient } = await import("./supabase-public.server");
    const sb = getPublicServerClient();
    const { data: row, error } = await sb
      .from("sources")
      .select(
        "id, title, tree, tree_parts, language, text, excerpt, char_count, source_url, source_provider, source_id, updated_at",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("not_found");

    const sourceLang = normalizeLang(row.language);
    if (data.lang !== sourceLang) {
      const { assertAuthenticatedRequest } = await import("./assert-auth.server");
      await assertAuthenticatedRequest();
    }

    const { localizeSourceForStudy } = await import("./localize-source.server");
    return localizeSourceForStudy(row, data.lang);
  });
