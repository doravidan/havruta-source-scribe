import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ id: z.string().uuid() });

export const getSource = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { getPublicServerClient } = await import("./supabase-public.server");
    const sb = getPublicServerClient();
    const { data: row, error } = await sb
      .from("sources")
      .select("id, title, tree, tree_parts, language, text, excerpt, char_count, source_url, source_provider, source_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("not_found");
    return row;
  });
