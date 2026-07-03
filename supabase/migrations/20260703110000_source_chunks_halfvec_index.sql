-- Add halfvec column + HNSW index for scalable semantic search at 3072 dimensions.

ALTER TABLE public.source_chunks
  ADD COLUMN IF NOT EXISTS embedding_half halfvec(3072);

UPDATE public.source_chunks
SET embedding_half = embedding::halfvec(3072)
WHERE embedding IS NOT NULL AND embedding_half IS NULL;

CREATE OR REPLACE FUNCTION public.sync_source_chunk_embedding_half()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.embedding IS NOT NULL THEN
    NEW.embedding_half := NEW.embedding::halfvec(3072);
  ELSE
    NEW.embedding_half := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS source_chunks_embedding_half_sync ON public.source_chunks;
CREATE TRIGGER source_chunks_embedding_half_sync
  BEFORE INSERT OR UPDATE OF embedding ON public.source_chunks
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_source_chunk_embedding_half();

CREATE INDEX IF NOT EXISTS source_chunks_embedding_half_hnsw_idx
  ON public.source_chunks
  USING hnsw (embedding_half halfvec_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector(3072),
  match_count INTEGER DEFAULT 8,
  min_similarity FLOAT DEFAULT 0.0
)
RETURNS TABLE (
  chunk_id UUID,
  source_id UUID,
  chunk_index INTEGER,
  text TEXT,
  similarity FLOAT,
  title TEXT,
  tree TEXT,
  tree_parts JSONB,
  language TEXT
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT c.id, c.source_id, c.chunk_index, c.text,
         1 - (c.embedding_half <=> query_embedding::halfvec(3072)) AS similarity,
         s.title, s.tree, s.tree_parts, s.language
  FROM public.source_chunks c
  JOIN public.sources s ON s.id = c.source_id
  WHERE c.embedding_half IS NOT NULL
    AND 1 - (c.embedding_half <=> query_embedding::halfvec(3072)) >= min_similarity
  ORDER BY c.embedding_half <=> query_embedding::halfvec(3072)
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_chunks(vector, integer, float) TO anon, authenticated;
