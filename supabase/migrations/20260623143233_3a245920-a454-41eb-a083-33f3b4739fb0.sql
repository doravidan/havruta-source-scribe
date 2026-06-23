CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  source TEXT,
  matched_patterns TEXT[] NOT NULL DEFAULT '{}',
  sample TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS security_events_created_at_idx ON public.security_events (created_at DESC);
CREATE INDEX IF NOT EXISTS security_events_kind_idx ON public.security_events (kind);

GRANT SELECT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read security events"
  ON public.security_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));