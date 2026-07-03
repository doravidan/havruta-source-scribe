SET LOCAL statement_timeout = '600s';

UPDATE public.source_chunks
SET embedding_half = embedding::halfvec(3072)
WHERE id IN (
  SELECT id FROM public.source_chunks
  WHERE embedding IS NOT NULL AND embedding_half IS NULL
  LIMIT 5000
);