CREATE OR REPLACE FUNCTION public.library_browse(_path text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  depth int := COALESCE(array_length(_path, 1), 0);
  prefix text;
  result jsonb;
BEGIN
  IF depth > 0 THEN
    prefix := array_to_string(_path, ' > ');
  END IF;

  WITH matched AS (
    SELECT id, title, tree_parts, char_count, language
    FROM public.sources
    WHERE depth = 0
       OR tree = prefix
       OR tree LIKE prefix || ' > %'
  ),
  children AS (
    SELECT tree_parts->>depth AS label, COUNT(*)::int AS count
    FROM matched
    WHERE jsonb_array_length(tree_parts) > depth
      AND tree_parts->>depth IS NOT NULL
    GROUP BY tree_parts->>depth
  ),
  leaves AS (
    SELECT id, title, char_count, language, tree_parts
    FROM matched
    WHERE jsonb_array_length(tree_parts) = depth
    ORDER BY title
    LIMIT 1000
  )
  SELECT jsonb_build_object(
    'path', to_jsonb(_path),
    'children', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('label', label, 'count', count) ORDER BY label) FROM children),
      '[]'::jsonb),
    'leaves', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
         'id', id, 'title', title, 'char_count', char_count,
         'language', language, 'tree_parts', tree_parts) ORDER BY title) FROM leaves),
      '[]'::jsonb),
    'total', (SELECT COUNT(*)::int FROM matched)
  )
  INTO result;
  RETURN result;
END;
$function$;

CREATE INDEX IF NOT EXISTS sources_tree_btree ON public.sources (tree text_pattern_ops);