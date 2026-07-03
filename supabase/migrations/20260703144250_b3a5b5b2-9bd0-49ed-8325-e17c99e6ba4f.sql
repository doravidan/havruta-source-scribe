-- Trigram index on sources.text to speed up ILIKE '%...%' full-content search
CREATE INDEX IF NOT EXISTS sources_text_trgm ON public.sources USING gin (text gin_trgm_ops);

-- Composite covering common browse gate + ordering by title
CREATE INDEX IF NOT EXISTS sources_charcount_title_idx ON public.sources (char_count, title) WHERE char_count >= 200;

ANALYZE public.sources;