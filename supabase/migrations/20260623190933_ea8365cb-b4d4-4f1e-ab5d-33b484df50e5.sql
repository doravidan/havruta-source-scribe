ALTER TABLE public.chavruta_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chavruta_study_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.chavruta_study_progress REPLICA IDENTITY FULL;
ALTER TABLE public.chavruta_study_questions REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='chavruta_messages') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.chavruta_messages';
  END IF;
END $$;