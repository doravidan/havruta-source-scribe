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