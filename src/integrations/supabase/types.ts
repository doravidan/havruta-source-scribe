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
      source_chunks: {
        Row: {
          chunk_index: number
          created_at: string
          embedding: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
