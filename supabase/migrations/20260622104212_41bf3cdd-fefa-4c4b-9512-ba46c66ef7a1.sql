
-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  preferred_lang TEXT NOT NULL DEFAULT 'he' CHECK (preferred_lang IN ('he','en')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Trigger to auto-create profile + role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, preferred_lang)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'he'
  ) ON CONFLICT (id) DO NOTHING;

  IF NEW.email = 'avidandor@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- sources
CREATE TABLE public.sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_provider TEXT NOT NULL DEFAULT 'manual',
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  tree TEXT,
  tree_parts JSONB DEFAULT '[]'::jsonb,
  content_type TEXT DEFAULT 'text',
  language TEXT NOT NULL DEFAULT 'he',
  text TEXT NOT NULL,
  excerpt TEXT,
  char_count INTEGER NOT NULL DEFAULT 0,
  raw_payload JSONB,
  source_url TEXT,
  sha256 TEXT,
  fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fts tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(tree,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(text,'')), 'C')
  ) STORED,
  UNIQUE (source_provider, source_id)
);
GRANT SELECT ON public.sources TO anon, authenticated;
GRANT ALL ON public.sources TO service_role;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read sources" ON public.sources FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write sources" ON public.sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX sources_fts_idx ON public.sources USING GIN (fts);
CREATE INDEX sources_title_trgm ON public.sources USING GIN (title gin_trgm_ops);
CREATE INDEX sources_tree_trgm ON public.sources USING GIN (tree gin_trgm_ops);
CREATE INDEX sources_charcount_idx ON public.sources (char_count);
CREATE TRIGGER sources_touch BEFORE UPDATE ON public.sources FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- source_chunks
CREATE TABLE public.source_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  token_count INTEGER,
  embedding vector(3072),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fts tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(text,''))) STORED,
  UNIQUE (source_id, chunk_index)
);
GRANT SELECT ON public.source_chunks TO anon, authenticated;
GRANT ALL ON public.source_chunks TO service_role;
ALTER TABLE public.source_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read chunks" ON public.source_chunks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write chunks" ON public.source_chunks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX chunks_source_idx ON public.source_chunks (source_id);
CREATE INDEX chunks_fts_idx ON public.source_chunks USING GIN (fts);
-- Note: HNSW index requires <=2000 dim; we use halfvec or skip index for 3072 dim and rely on sequential scan for small corpus.
-- Use ivfflat? Also limited to 2000. So no ANN index; for small corpora exact scan is fine.

-- ask_sessions
CREATE TABLE public.ask_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  lang TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  source_ids UUID[] DEFAULT '{}',
  mode TEXT,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.ask_sessions TO anon, authenticated;
GRANT SELECT ON public.ask_sessions TO authenticated;
GRANT ALL ON public.ask_sessions TO service_role;
ALTER TABLE public.ask_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone insert ask" ON public.ask_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "users read own asks" ON public.ask_sessions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- match_chunks RPC (exact cosine; fine for seed corpus)
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
         1 - (c.embedding <=> query_embedding) AS similarity,
         s.title, s.tree, s.tree_parts, s.language
  FROM public.source_chunks c
  JOIN public.sources s ON s.id = c.source_id
  WHERE c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) >= min_similarity
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_chunks(vector, integer, float) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;
