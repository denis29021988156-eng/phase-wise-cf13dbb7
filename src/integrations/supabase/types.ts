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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      event_ai_suggestions: {
        Row: {
          created_at: string | null
          decision: string | null
          event_id: string | null
          id: string
          justification: string | null
          suggestion: string | null
        }
        Insert: {
          created_at?: string | null
          decision?: string | null
          event_id?: string | null
          id?: string
          justification?: string | null
          suggestion?: string | null
        }
        Update: {
          created_at?: string | null
          decision?: string | null
          event_id?: string | null
          id?: string
          justification?: string | null
          suggestion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_ai_suggestions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_move_suggestions: {
        Row: {
          created_at: string
          email_sent_at: string | null
          email_thread_id: string | null
          event_id: string
          id: string
          participants: string[] | null
          reason: string
          status: string
          suggested_new_end: string
          suggested_new_start: string
          suggestion_text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_sent_at?: string | null
          email_thread_id?: string | null
          event_id: string
          id?: string
          participants?: string[] | null
          reason: string
          status?: string
          suggested_new_end: string
          suggested_new_start: string
          suggestion_text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_sent_at?: string | null
          email_thread_id?: string | null
          event_id?: string
          id?: string
          participants?: string[] | null
          reason?: string
          status?: string
          suggested_new_end?: string
          suggested_new_start?: string
          suggestion_text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_move_suggestions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          end_time: string
          google_event_id: string | null
          id: string
          source: string | null
          start_time: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          end_time: string
          google_event_id?: string | null
          id?: string
          source?: string | null
          start_time: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          end_time?: string
          google_event_id?: string | null
          id?: string
          source?: string | null
          start_time?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          notification_type: string
          scheduled_for: string
          sent_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          notification_type: string
          scheduled_for: string
          sent_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          notification_type?: string
          scheduled_for?: string
          sent_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      symptom_logs: {
        Row: {
          created_at: string
          date: string
          energy: number | null
          id: string
          mood: string[] | null
          physical_symptoms: string[] | null
          sleep_quality: number | null
          stress_level: number | null
          updated_at: string
          user_id: string
          wellness_index: number | null
        }
        Insert: {
          created_at?: string
          date?: string
          energy?: number | null
          id?: string
          mood?: string[] | null
          physical_symptoms?: string[] | null
          sleep_quality?: number | null
          stress_level?: number | null
          updated_at?: string
          user_id: string
          wellness_index?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          energy?: number | null
          id?: string
          mood?: string[] | null
          physical_symptoms?: string[] | null
          sleep_quality?: number | null
          stress_level?: number | null
          updated_at?: string
          user_id?: string
          wellness_index?: number | null
        }
        Relationships: []
      }
      user_cycles: {
        Row: {
          created_at: string | null
          cycle_length: number | null
          menstrual_length: number | null
          start_date: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          cycle_length?: number | null
          menstrual_length?: number | null
          start_date: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          cycle_length?: number | null
          menstrual_length?: number | null
          start_date?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          age: number | null
          created_at: string
          height: number | null
          id: string
          name: string | null
          updated_at: string
          user_id: string
          weight: number | null
        }
        Insert: {
          age?: number | null
          created_at?: string
          height?: number | null
          id?: string
          name?: string | null
          updated_at?: string
          user_id: string
          weight?: number | null
        }
        Update: {
          age?: number | null
          created_at?: string
          height?: number | null
          id?: string
          name?: string | null
          updated_at?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: []
      }
      user_tokens: {
        Row: {
          access_token: string | null
          created_at: string | null
          expires_at: string | null
          provider: string | null
          refresh_token: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string | null
          expires_at?: string | null
          provider?: string | null
          refresh_token?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string | null
          expires_at?: string | null
          provider?: string | null
          refresh_token?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wellness_predictions: {
        Row: {
          created_at: string
          id: string
          prediction_date: string
          predictions: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          prediction_date: string
          predictions: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          prediction_date?: string
          predictions?: Json
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_ai_suggestion_content: {
        Args: {
          cycle_day: number
          cycle_length: number
          event_description?: string
          event_title: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
