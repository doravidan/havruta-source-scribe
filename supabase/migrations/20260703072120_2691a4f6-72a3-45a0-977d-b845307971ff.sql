SET LOCAL statement_timeout = '600s';

UPDATE public.source_chunks
SET embedding_half = embedding::halfvec(3072)
WHERE embedding IS NOT NULL AND embedding_half IS NULL;