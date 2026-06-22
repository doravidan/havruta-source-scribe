-- Chavruta social/matching layer.
CREATE TABLE IF NOT EXISTS public.chavruta_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  bio TEXT DEFAULT '',
  learning_level TEXT NOT NULL DEFAULT 'beginner' CHECK (learning_level IN ('beginner','intermediate','advanced')),
  preferred_lang TEXT NOT NULL DEFAULT 'he' CHECK (preferred_lang IN ('he','en','both')),
  topics TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chavruta_contact_info (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL CHECK (length(phone) BETWEEN 7 AND 32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chavruta_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_havruta_available BOOLEAN NOT NULL DEFAULT true,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (start_time < end_time)
);

CREATE TABLE IF NOT EXISTS public.chavruta_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suggested_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'chatting' CHECK (status IN ('chatting','accepted','declined','cancelled')),
  overlap_day INTEGER CHECK (overlap_day BETWEEN 0 AND 6),
  overlap_start TIME,
  overlap_end TIME,
  requester_accepted BOOLEAN NOT NULL DEFAULT false,
  suggested_accepted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (requester_id <> suggested_user_id),
  UNIQUE (requester_id, suggested_user_id)
);

CREATE TABLE IF NOT EXISTS public.chavruta_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.chavruta_matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chavruta_availability_user_idx ON public.chavruta_availability(user_id);
CREATE INDEX IF NOT EXISTS chavruta_availability_time_idx ON public.chavruta_availability(day_of_week, start_time, end_time);
CREATE INDEX IF NOT EXISTS chavruta_matches_participants_idx ON public.chavruta_matches(requester_id, suggested_user_id);
CREATE INDEX IF NOT EXISTS chavruta_messages_match_idx ON public.chavruta_messages(match_id, created_at);

CREATE TRIGGER chavruta_profiles_touch BEFORE UPDATE ON public.chavruta_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER chavruta_contact_info_touch BEFORE UPDATE ON public.chavruta_contact_info FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER chavruta_availability_touch BEFORE UPDATE ON public.chavruta_availability FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER chavruta_matches_touch BEFORE UPDATE ON public.chavruta_matches FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.chavruta_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chavruta_availability TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.chavruta_contact_info TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.chavruta_matches TO authenticated;
GRANT SELECT, INSERT ON public.chavruta_messages TO authenticated;
GRANT ALL ON public.chavruta_profiles, public.chavruta_contact_info, public.chavruta_availability, public.chavruta_matches, public.chavruta_messages TO service_role;

ALTER TABLE public.chavruta_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chavruta_contact_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chavruta_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chavruta_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chavruta_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read active chavruta profiles" ON public.chavruta_profiles
  FOR SELECT TO authenticated USING (is_active OR user_id = auth.uid());
CREATE POLICY "users insert own chavruta profile" ON public.chavruta_profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users update own chavruta profile" ON public.chavruta_profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "users manage own contact" ON public.chavruta_contact_info
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "auth read chavruta availability" ON public.chavruta_availability
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own availability" ON public.chavruta_availability
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users update own availability" ON public.chavruta_availability
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users delete own availability" ON public.chavruta_availability
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "participants read matches" ON public.chavruta_matches
  FOR SELECT TO authenticated USING (requester_id = auth.uid() OR suggested_user_id = auth.uid());
CREATE POLICY "users create own matches" ON public.chavruta_matches
  FOR INSERT TO authenticated WITH CHECK (requester_id = auth.uid());
CREATE POLICY "participants update matches" ON public.chavruta_matches
  FOR UPDATE TO authenticated USING (requester_id = auth.uid() OR suggested_user_id = auth.uid());

CREATE POLICY "participants read messages" ON public.chavruta_messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.chavruta_matches m
      WHERE m.id = match_id AND (m.requester_id = auth.uid() OR m.suggested_user_id = auth.uid())
    )
  );
CREATE POLICY "participants send messages" ON public.chavruta_messages
  FOR INSERT TO authenticated WITH CHECK (
    sender_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.chavruta_matches m
      WHERE m.id = match_id AND (m.requester_id = auth.uid() OR m.suggested_user_id = auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.propose_chavruta_match(
  _target_user_id UUID,
  _day INTEGER,
  _start TIME,
  _end TIME
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
  _a UUID := auth.uid();
  _left UUID;
  _right UUID;
BEGIN
  IF _a IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _target_user_id = _a THEN RAISE EXCEPTION 'cannot_match_self'; END IF;
  _left := LEAST(_a, _target_user_id);
  _right := GREATEST(_a, _target_user_id);

  INSERT INTO public.chavruta_matches (requester_id, suggested_user_id, overlap_day, overlap_start, overlap_end)
  VALUES (_left, _right, _day, _start, _end)
  ON CONFLICT (requester_id, suggested_user_id) DO UPDATE
    SET status = CASE WHEN public.chavruta_matches.status IN ('declined','cancelled') THEN 'chatting' ELSE public.chavruta_matches.status END,
        overlap_day = EXCLUDED.overlap_day,
        overlap_start = EXCLUDED.overlap_start,
        overlap_end = EXCLUDED.overlap_end,
        updated_at = now()
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_chavruta_match(_match_id UUID)
RETURNS public.chavruta_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _m public.chavruta_matches;
  _a UUID := auth.uid();
BEGIN
  IF _a IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  UPDATE public.chavruta_matches
  SET requester_accepted = CASE WHEN requester_id = _a THEN true ELSE requester_accepted END,
      suggested_accepted = CASE WHEN suggested_user_id = _a THEN true ELSE suggested_accepted END,
      status = CASE
        WHEN (requester_id = _a OR requester_accepted) AND (suggested_user_id = _a OR suggested_accepted) THEN 'accepted'
        ELSE 'chatting'
      END,
      updated_at = now()
  WHERE id = _match_id AND (requester_id = _a OR suggested_user_id = _a)
  RETURNING * INTO _m;

  IF _m.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN _m;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_chavruta_match_contact(_match_id UUID)
RETURNS TABLE(user_id UUID, display_name TEXT, phone TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH m AS (
    SELECT * FROM public.chavruta_matches
    WHERE id = _match_id
      AND status = 'accepted'
      AND (requester_id = auth.uid() OR suggested_user_id = auth.uid())
  ), other_user AS (
    SELECT CASE WHEN requester_id = auth.uid() THEN suggested_user_id ELSE requester_id END AS id FROM m
  )
  SELECT p.user_id, p.display_name, c.phone
  FROM other_user o
  JOIN public.chavruta_profiles p ON p.user_id = o.id
  JOIN public.chavruta_contact_info c ON c.user_id = o.id;
$$;

GRANT EXECUTE ON FUNCTION public.propose_chavruta_match(UUID, INTEGER, TIME, TIME) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_chavruta_match(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chavruta_match_contact(UUID) TO authenticated;