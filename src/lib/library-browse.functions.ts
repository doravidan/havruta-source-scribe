import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  path: z.array(z.string()).max(20).default([]),
});

export type LibraryNode = {
  path: string[];
  children: { label: string; count: number }[];
  leaves: {
    id: string;
    title: string | null;
    char_count: number | null;
    language: string | null;
    tree_parts: string[] | null;
  }[];
  total: number;
};

export const browseLibrary = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<LibraryNode> => {
    const { getPublicServerClient } = await import("./supabase-public.server");
    const sb = getPublicServerClient();
    const { data: row, error } = await (sb.rpc as any)("library_browse", {
      _path: data.path,
    });
    if (error) throw new Error(error.message);
    const node = (row ?? {}) as Partial<LibraryNode>;
    return {
      path: data.path,
      children: node.children ?? [],
      leaves: node.leaves ?? [],
      total: node.total ?? 0,
    };
  });
