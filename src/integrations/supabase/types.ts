export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_cheers: {
        Row: {
          activity_id: string
          created_at: string
          emoji: string
          user_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          emoji?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          emoji?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_cheers_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "learning_activity"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_buckets: {
        Row: {
          bucket: string
          count: number
          user_id: string
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          user_id: string
          window_start: string
        }
        Update: {
          bucket?: string
          count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      ask_sessions: {
        Row: {
          answer: string | null
          created_at: string
          id: string
          lang: string
          latency_ms: number | null
          mode: string | null
          question: string
          source_ids: string[] | null
          user_id: string | null
        }
        Insert: {
          answer?: string | null
          created_at?: string
          id?: string
          lang: string
          latency_ms?: number | null
          mode?: string | null
          question: string
          source_ids?: string[] | null
          user_id?: string | null
        }
        Update: {
          answer?: string | null
          created_at?: string
          id?: string
          lang?: string
          latency_ms?: number | null
          mode?: string | null
          question?: string
          source_ids?: string[] | null
          user_id?: string | null
        }
        Relationships: []
      }
      chabad_crawl_queue: {
        Row: {
          attempts: number
          chabad_id: string
          enqueued_at: string
          id: string
          last_error: string | null
          processed_at: string | null
          root_id: string
          status: string
        }
        Insert: {
          attempts?: number
          chabad_id: string
          enqueued_at?: string
          id?: string
          last_error?: string | null
          processed_at?: string | null
          root_id: string
          status?: string
        }
        Update: {
          attempts?: number
          chabad_id?: string
          enqueued_at?: string
          id?: string
          last_error?: string | null
          processed_at?: string | null
          root_id?: string
          status?: string
        }
        Relationships: []
      }
      chavruta_availability: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_havruta_available: boolean
          note: string | null
          start_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_havruta_available?: boolean
          note?: string | null
          start_time: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_havruta_available?: boolean
          note?: string | null
          start_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chavruta_contact_info: {
        Row: {
          created_at: string
          phone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          phone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          phone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chavruta_matches: {
        Row: {
          created_at: string
          id: string
          overlap_day: number | null
          overlap_end: string | null
          overlap_start: string | null
          requester_accepted: boolean
          requester_id: string
          status: string
          suggested_accepted: boolean
          suggested_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          overlap_day?: number | null
          overlap_end?: string | null
          overlap_start?: string | null
          requester_accepted?: boolean
          requester_id: string
          status?: string
          suggested_accepted?: boolean
          suggested_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          overlap_day?: number | null
          overlap_end?: string | null
          overlap_start?: string | null
          requester_accepted?: boolean
          requester_id?: string
          status?: string
          suggested_accepted?: boolean
          suggested_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      chavruta_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          match_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          match_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          match_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chavruta_messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "chavruta_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      chavruta_profiles: {
        Row: {
          bio: string | null
          created_at: string
          display_name: string
          is_active: boolean
          learning_level: string
          preferred_lang: string
          time_zone: string
          topics: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          display_name: string
          is_active?: boolean
          learning_level?: string
          preferred_lang?: string
          time_zone?: string
          topics?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          display_name?: string
          is_active?: boolean
          learning_level?: string
          preferred_lang?: string
          time_zone?: string
          topics?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chavruta_queue: {
        Row: {
          enqueued_at: string
          exclude_user_id: string | null
          lang: string
          matched_session_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          enqueued_at?: string
          exclude_user_id?: string | null
          lang?: string
          matched_session_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          enqueued_at?: string
          exclude_user_id?: string | null
          lang?: string
          matched_session_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chavruta_queue_matched_session_id_fkey"
            columns: ["matched_session_id"]
            isOneToOne: false
            referencedRelation: "chavruta_study_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chavruta_study_progress: {
        Row: {
          id: string
          note: string | null
          segment_index: number
          session_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          note?: string | null
          segment_index: number
          session_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          note?: string | null
          segment_index?: number
          session_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chavruta_study_progress_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chavruta_study_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chavruta_study_questions: {
        Row: {
          answer: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          question: string
          segment_index: number
          session_id: string
        }
        Insert: {
          answer?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          question: string
          segment_index: number
          session_id: string
        }
        Update: {
          answer?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          question?: string
          segment_index?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chavruta_study_questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chavruta_study_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chavruta_study_sessions: {
        Row: {
          companion_type: string
          created_at: string
          created_by: string
          current_segment_index: number
          id: string
          match_id: string | null
          source_id: string
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          companion_type?: string
          created_at?: string
          created_by: string
          current_segment_index?: number
          id?: string
          match_id?: string | null
          source_id: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          companion_type?: string
          created_at?: string
          created_by?: string
          current_segment_index?: number
          id?: string
          match_id?: string | null
          source_id?: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chavruta_study_sessions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "chavruta_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chavruta_study_sessions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      learning_activity: {
        Row: {
          created_at: string
          id: string
          kind: string
          meta: Json
          session_id: string | null
          source_id: string | null
          source_title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          meta?: Json
          session_id?: string | null
          source_id?: string | null
          source_title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          meta?: Json
          session_id?: string | null
          source_id?: string | null
          source_title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_activity_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chavruta_study_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_activity_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          preferred_lang: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          preferred_lang?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          preferred_lang?: string
          updated_at?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          context: Json
          created_at: string
          id: string
          kind: string
          matched_patterns: string[]
          sample: string | null
          severity: string
          source: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json
          created_at?: string
          id?: string
          kind: string
          matched_patterns?: string[]
          sample?: string | null
          severity?: string
          source?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json
          created_at?: string
          id?: string
          kind?: string
          matched_patterns?: string[]
          sample?: string | null
          severity?: string
          source?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      source_chunks: {
        Row: {
          chunk_index: number
          created_at: string
          embedding: string | null
          embedding_half: unknown
          fts: unknown
          id: string
          source_id: string
          text: string
          token_count: number | null
        }
        Insert: {
          chunk_index: number
          created_at?: string
          embedding?: string | null
          embedding_half?: unknown
          fts?: unknown
          id?: string
          source_id: string
          text: string
          token_count?: number | null
        }
        Update: {
          chunk_index?: number
          created_at?: string
          embedding?: string | null
          embedding_half?: unknown
          fts?: unknown
          id?: string
          source_id?: string
          text?: string
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "source_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          char_count: number
          content_type: string | null
          created_at: string
          excerpt: string | null
          fetched_at: string | null
          fts: unknown
          id: string
          language: string
          raw_payload: Json | null
          sha256: string | null
          source_id: string
          source_provider: string
          source_url: string | null
          text: string
          title: string
          tree: string | null
          tree_parts: Json | null
          updated_at: string
        }
        Insert: {
          char_count?: number
          content_type?: string | null
          created_at?: string
          excerpt?: string | null
          fetched_at?: string | null
          fts?: unknown
          id?: string
          language?: string
          raw_payload?: Json | null
          sha256?: string | null
          source_id: string
          source_provider?: string
          source_url?: string | null
          text: string
          title: string
          tree?: string | null
          tree_parts?: Json | null
          updated_at?: string
        }
        Update: {
          char_count?: number
          content_type?: string | null
          created_at?: string
          excerpt?: string | null
          fetched_at?: string | null
          fts?: unknown
          id?: string
          language?: string
          raw_payload?: Json | null
          sha256?: string | null
          source_id?: string
          source_provider?: string
          source_url?: string | null
          text?: string
          title?: string
          tree?: string | null
          tree_parts?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      study_progress: {
        Row: {
          completed_at: string
          section: string | null
          source_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          section?: string | null
          source_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          section?: string | null
          source_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_progress_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_chavruta_match: {
        Args: { _match_id: string }
        Returns: {
          created_at: string
          id: string
          overlap_day: number | null
          overlap_end: string | null
          overlap_start: string | null
          requester_accepted: boolean
          requester_id: string
          status: string
          suggested_accepted: boolean
          suggested_user_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "chavruta_matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_hnsw_build_status: { Args: never; Returns: Json }
      admin_start_hnsw_build: {
        Args: { _maintenance_work_mem?: string }
        Returns: Json
      }
      can_access_study_realtime_channel: {
        Args: { _topic: string }
        Returns: boolean
      }
      claim_chabad_crawl_batch: {
        Args: { batch_size: number }
        Returns: {
          attempts: number
          chabad_id: string
          enqueued_at: string
          id: string
          last_error: string | null
          processed_at: string | null
          root_id: string
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "chabad_crawl_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      consume_ai_rate_limit: {
        Args: {
          _bucket: string
          _max_per_window: number
          _window_seconds?: number
        }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_chavruta_match_contact: {
        Args: { _match_id: string }
        Returns: {
          display_name: string
          phone: string
          user_id: string
        }[]
      }
      get_chavruta_match_contacts: {
        Args: { _match_ids: string[] }
        Returns: {
          display_name: string
          match_id: string
          phone: string
          user_id: string
        }[]
      }
      get_chavruta_matching_slots: {
        Args: never
        Returns: {
          day_of_week: number
          end_time: string
          start_time: string
          user_id: string
        }[]
      }
      get_community_feed: {
        Args: { _limit?: number }
        Returns: {
          cheer_count: number
          cheered_by_me: boolean
          created_at: string
          display_name: string
          id: string
          kind: string
          meta: Json
          session_id: string
          source_id: string
          source_title: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      instant_chavruta_status: { Args: never; Returns: Json }
      join_instant_chavruta: { Args: { _lang?: string }; Returns: Json }
      leave_instant_chavruta: { Args: never; Returns: undefined }
      library_browse: { Args: { _path: string[] }; Returns: Json }
      match_chunks: {
        Args: {
          match_count?: number
          min_similarity?: number
          query_embedding: string
        }
        Returns: {
          chunk_id: string
          chunk_index: number
          language: string
          similarity: number
          source_id: string
          text: string
          title: string
          tree: string
          tree_parts: Json
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      propose_chavruta_match: {
        Args: {
          _day: number
          _end: string
          _start: string
          _target_user_id: string
        }
        Returns: string
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      study_active_dates: {
        Args: { _user_id: string }
        Returns: {
          d: string
        }[]
      }
      study_section_counts: {
        Args: { _user_id: string }
        Returns: {
          done: number
          section: string
          total: number
        }[]
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
