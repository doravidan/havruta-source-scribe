CREATE TABLE public.chabad_crawl_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chabad_id text NOT NULL UNIQUE,
  root_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  enqueued_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX idx_chabad_queue_pending ON public.chabad_crawl_queue(status, enqueued_at) WHERE status IN ('pending','failed');

GRANT SELECT ON public.chabad_crawl_queue TO authenticated;
GRANT ALL ON public.chabad_crawl_queue TO service_role;

ALTER TABLE public.chabad_crawl_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read crawl queue"
  ON public.chabad_crawl_queue
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.claim_chabad_crawl_batch(batch_size int)
RETURNS SETOF public.chabad_crawl_queue
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.chabad_crawl_queue
  SET status = 'processing', attempts = attempts + 1
  WHERE id IN (
    SELECT id FROM public.chabad_crawl_queue
    WHERE status IN ('pending', 'failed')
      AND attempts < 5
    ORDER BY enqueued_at ASC
    LIMIT GREATEST(1, LEAST(batch_size, 50))
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

REVOKE ALL ON FUNCTION public.claim_chabad_crawl_batch(int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_chabad_crawl_batch(int) TO service_role;