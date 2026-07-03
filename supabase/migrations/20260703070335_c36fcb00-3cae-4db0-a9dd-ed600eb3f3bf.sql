-- Per-user AI usage buckets for rate limiting expensive model calls.

CREATE TABLE IF NOT EXISTS public.ai_usage_buckets (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bucket, window_start)
);

ALTER TABLE public.ai_usage_buckets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ai_usage_buckets FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.ai_usage_buckets TO service_role;

CREATE OR REPLACE FUNCTION public.consume_ai_rate_limit(
  _bucket TEXT,
  _max_per_window INTEGER,
  _window_seconds INTEGER DEFAULT 3600
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _window_start TIMESTAMPTZ;
  _count INTEGER;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF _max_per_window < 1 OR _window_seconds < 60 THEN
    RAISE EXCEPTION 'invalid_rate_limit_config';
  END IF;

  _window_start := to_timestamp(
    floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds
  );

  INSERT INTO public.ai_usage_buckets (user_id, bucket, window_start, count)
  VALUES (_uid, _bucket, _window_start, 1)
  ON CONFLICT (user_id, bucket, window_start)
  DO UPDATE SET count = public.ai_usage_buckets.count + 1
  RETURNING count INTO _count;

  RETURN _count <= _max_per_window;
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_ai_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_ai_rate_limit(TEXT, INTEGER, INTEGER) TO authenticated;