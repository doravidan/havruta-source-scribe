-- Add a study-oriented taxonomy over raw source rows.
-- The raw imported path stays intact in tree/tree_parts; these columns make the UI behave like
-- books -> volumes/sections -> real learning units (sichot, maamarim, chapters), while hiding TOC/page noise.

ALTER TABLE public.sources
  ADD COLUMN IF NOT EXISTS book_title TEXT,
  ADD COLUMN IF NOT EXISTS volume_title TEXT,
  ADD COLUMN IF NOT EXISTS unit_title TEXT,
  ADD COLUMN IF NOT EXISTS unit_type TEXT DEFAULT 'source',
  ADD COLUMN IF NOT EXISTS learning_path JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_learning_unit BOOLEAN NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.refresh_source_learning_taxonomy()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.sources s
  SET
    is_learning_unit = COALESCE(char_count, 0) >= 250
      AND NOT (
        coalesce(title, '') || ' ' || coalesce(tree, '') ~* '(תוכן\s*ענינים|תוכן העניינים|מפתח|לוח|שער הספר|שער|הקדמת המו"?ל|פתח דבר|עמוד\s*\d+|^עמוד$|^page\b|contents|index|table of contents|title page)'
      ),
    book_title = COALESCE(
      NULLIF(tree_parts->>CASE WHEN tree_parts->>0 ~* '^(ספרי|מאגר|חב"?ד|chabad|rebbe|אוצר|כתבי)' THEN 1 ELSE 0 END, ''),
      title
    ),
    volume_title = NULLIF(tree_parts->>CASE WHEN tree_parts->>0 ~* '^(ספרי|מאגר|חב"?ד|chabad|rebbe|אוצר|כתבי)' THEN 2 ELSE 1 END, ''),
    unit_title = COALESCE(NULLIF(title, ''), NULLIF(tree_parts->>(jsonb_array_length(tree_parts)-1), '')),
    unit_type = CASE
      WHEN coalesce(tree, '') || ' ' || coalesce(title, '') ~* '(ליקוטי שיחות|לקוטי שיחות|שיחה|sicha|sichah)' THEN 'sicha'
      WHEN coalesce(tree, '') || ' ' || coalesce(title, '') ~* '(מאמר|באתי לגני|maamar)' THEN 'maamar'
      WHEN coalesce(tree, '') || ' ' || coalesce(title, '') ~* '(תניא|פרק|שער היחוד|אגרת|chapter)' THEN 'chapter'
      ELSE 'source'
    END,
    learning_path = to_jsonb(
      array_remove(ARRAY[
        COALESCE(NULLIF(tree_parts->>CASE WHEN tree_parts->>0 ~* '^(ספרי|מאגר|חב"?ד|chabad|rebbe|אוצר|כתבי)' THEN 1 ELSE 0 END, ''), title),
        NULLIF(tree_parts->>CASE WHEN tree_parts->>0 ~* '^(ספרי|מאגר|חב"?ד|chabad|rebbe|אוצר|כתבי)' THEN 2 ELSE 1 END, ''),
        COALESCE(NULLIF(title, ''), NULLIF(tree_parts->>(jsonb_array_length(tree_parts)-1), ''))
      ], NULL)
    )
  WHERE jsonb_array_length(coalesce(tree_parts, '[]'::jsonb)) > 0;
END;
$$;

SELECT public.refresh_source_learning_taxonomy();

CREATE INDEX IF NOT EXISTS sources_learning_unit_idx ON public.sources (is_learning_unit, unit_type, book_title);
CREATE INDEX IF NOT EXISTS sources_learning_path_gin ON public.sources USING GIN (learning_path);
CREATE INDEX IF NOT EXISTS sources_book_title_trgm ON public.sources USING GIN (book_title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS sources_unit_title_trgm ON public.sources USING GIN (unit_title gin_trgm_ops);
