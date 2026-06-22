CREATE OR REPLACE FUNCTION public.library_browse(_path text[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  depth int := COALESCE(array_length(_path, 1), 0);
  result jsonb;
BEGIN
  WITH matched AS (
    SELECT id, title, tree_parts, char_count, language
    FROM public.sources
    WHERE jsonb_array_length(tree_parts) >= depth
      AND (
        depth = 0
        OR (
          SELECT bool_and((tree_parts->>(i - 1)) = _path[i])
          FROM generate_series(1, GREATEST(depth, 1)) AS i
          WHERE depth > 0
        ) IS NOT FALSE
      )
  ),
  children AS (
    SELECT
      tree_parts->>depth AS label,
      COUNT(*)::int AS count
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
      (SELECT jsonb_agg(jsonb_build_object('label', label, 'count', count) ORDER BY label)
       FROM children), '[]'::jsonb),
    'leaves', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
         'id', id, 'title', title, 'char_count', char_count,
         'language', language, 'tree_parts', tree_parts) ORDER BY title)
       FROM leaves), '[]'::jsonb),
    'total', (SELECT COUNT(*)::int FROM matched)
  )
  INTO result;
  RETURN result;
END;
$$;