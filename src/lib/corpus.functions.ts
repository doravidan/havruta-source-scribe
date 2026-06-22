import { createServerFn } from "@tanstack/react-start";

export const corpusStats = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicServerClient } = await import("./supabase-public.server");
  const sb = getPublicServerClient();
  const [s, c] = await Promise.all([
    sb.from("sources").select("char_count", { count: "exact" }),
    sb.from("source_chunks").select("id", { count: "exact", head: true }),
  ]);
  const totalChars = (s.data ?? []).reduce((a, r: any) => a + (r.char_count ?? 0), 0);
  return {
    sources: s.count ?? 0,
    chunks: c.count ?? 0,
    chars: totalChars,
    ok: !s.error && !c.error,
  };
});
