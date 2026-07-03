
CREATE OR REPLACE FUNCTION public.admin_start_hnsw_build(_maintenance_work_mem text DEFAULT '256MB')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _job_id bigint;
  _cmd text;
BEGIN
  IF auth.role() <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='source_chunks_embedding_half_hnsw_idx') THEN
    RETURN jsonb_build_object('status','already_exists');
  END IF;

  _cmd := format($cmd$
    DO $body$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='source_chunks_embedding_half_hnsw_idx') THEN
        PERFORM set_config('maintenance_work_mem', %L, false);
        PERFORM set_config('statement_timeout', '0', false);
        PERFORM set_config('lock_timeout', '0', false);
        PERFORM set_config('idle_in_transaction_session_timeout', '0', false);
        EXECUTE 'CREATE INDEX IF NOT EXISTS source_chunks_embedding_half_hnsw_idx ON public.source_chunks USING hnsw (embedding_half halfvec_cosine_ops)';
      END IF;
      PERFORM cron.unschedule('hnsw_source_chunks_build');
    END
    $body$;
  $cmd$, _maintenance_work_mem);

  PERFORM cron.unschedule('hnsw_source_chunks_build')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hnsw_source_chunks_build');

  SELECT cron.schedule('hnsw_source_chunks_build', '* * * * *', _cmd) INTO _job_id;

  RETURN jsonb_build_object('status','scheduled','job_id',_job_id,'maintenance_work_mem',_maintenance_work_mem);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_hnsw_build_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _exists boolean;
  _size text;
  _job_scheduled boolean;
  _last_run jsonb;
  _active jsonb;
BEGIN
  IF auth.role() <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='source_chunks_embedding_half_hnsw_idx'
  ) INTO _exists;

  IF _exists THEN
    SELECT pg_size_pretty(pg_relation_size('public.source_chunks_embedding_half_hnsw_idx'::regclass)) INTO _size;
  END IF;

  SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname='hnsw_source_chunks_build') INTO _job_scheduled;

  SELECT to_jsonb(t) FROM (
    SELECT jrd.status, jrd.return_message, jrd.start_time, jrd.end_time
    FROM cron.job j
    LEFT JOIN cron.job_run_details jrd ON jrd.jobid = j.jobid
    WHERE j.jobname = 'hnsw_source_chunks_build'
    ORDER BY jrd.start_time DESC NULLS LAST
    LIMIT 1
  ) t INTO _last_run;

  SELECT jsonb_agg(jsonb_build_object(
    'pid', pid,
    'state', state,
    'wait_event', wait_event,
    'started', xact_start,
    'query', left(query, 200)
  ))
  FROM pg_stat_activity
  WHERE query ILIKE '%source_chunks_embedding_half_hnsw%'
    AND pid <> pg_backend_pid()
  INTO _active;

  RETURN jsonb_build_object(
    'index_exists', _exists,
    'index_size', _size,
    'job_scheduled', _job_scheduled,
    'last_run', _last_run,
    'active_builds', COALESCE(_active, '[]'::jsonb)
  );
END;
$fn$;
