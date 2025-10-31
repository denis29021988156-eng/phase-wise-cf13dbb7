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
      ai_error_notifications: {
        Row: {
          created_at: string
          error_type: string
          id: string
          message: string
          metadata: Json | null
          notified: boolean | null
          notified_at: string | null
          operation_type: string | null
          resolved: boolean | null
          resolved_at: string | null
          severity: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_type: string
          id?: string
          message: string
          metadata?: Json | null
          notified?: boolean | null
          notified_at?: string | null
          operation_type?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          severity: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_type?: string
          id?: string
          message?: string
          metadata?: Json | null
          notified?: boolean | null
          notified_at?: string | null
          operation_type?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          severity?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_operation_metrics: {
        Row: {
          created_at: string
          error_details: string | null
          execution_time_ms: number | null
          id: string
          metadata: Json | null
          operation_type: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_details?: string | null
          execution_time_ms?: number | null
          id?: string
          metadata?: Json | null
          operation_type: string
          status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_details?: string | null
          execution_time_ms?: number | null
          id?: string
          metadata?: Json | null
          operation_type?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_retry_logs: {
        Row: {
          attempt_number: number
          created_at: string
          error_message: string | null
          http_status: number | null
          id: string
          metadata: Json | null
          operation_type: string
          user_id: string
        }
        Insert: {
          attempt_number: number
          created_at?: string
          error_message?: string | null
          http_status?: number | null
          id?: string
          metadata?: Json | null
          operation_type: string
          user_id: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          error_message?: string | null
          http_status?: number | null
          id?: string
          metadata?: Json | null
          operation_type?: string
          user_id?: string
        }
        Relationships: []
      }
      api_rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          request_count: number
          user_id: string
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          request_count?: number
          user_id: string
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          request_count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
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
      energy_reference: {
        Row: {
          afternoon: number
          base: number
          category: string
          created_at: string
          evening: number
          event_name: string
          follicular: number
          id: string
          luteal: number
          menstrual: number
          morning: number
          ovulation: number
          stress_coefficient: number
        }
        Insert: {
          afternoon: number
          base: number
          category: string
          created_at?: string
          evening: number
          event_name: string
          follicular: number
          id?: string
          luteal: number
          menstrual: number
          morning: number
          ovulation: number
          stress_coefficient: number
        }
        Update: {
          afternoon?: number
          base?: number
          category?: string
          created_at?: string
          evening?: number
          event_name?: string
          follicular?: number
          id?: string
          luteal?: number
          menstrual?: number
          morning?: number
          ovulation?: number
          stress_coefficient?: number
        }
        Relationships: []
      }
      event_actions: {
        Row: {
          action_type: string
          created_at: string
          event_id: string
          id: string
          metadata: Json | null
          new_end_time: string | null
          new_start_time: string | null
          old_end_time: string | null
          old_start_time: string | null
          reason: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          event_id: string
          id?: string
          metadata?: Json | null
          new_end_time?: string | null
          new_start_time?: string | null
          old_end_time?: string | null
          old_start_time?: string | null
          reason?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          event_id?: string
          id?: string
          metadata?: Json | null
          new_end_time?: string | null
          new_start_time?: string | null
          old_end_time?: string | null
          old_start_time?: string | null
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_actions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
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
          microsoft_event_id: string | null
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
          microsoft_event_id?: string | null
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
          microsoft_event_id?: string | null
          source?: string | null
          start_time?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      google_calendar_watch_channels: {
        Row: {
          channel_id: string
          channel_token: string | null
          created_at: string | null
          expiration: string
          id: string
          resource_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          channel_token?: string | null
          created_at?: string | null
          expiration: string
          id?: string
          resource_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          channel_token?: string | null
          created_at?: string | null
          expiration?: string
          id?: string
          resource_id?: string
          updated_at?: string | null
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
          blood_pressure_diastolic: number | null
          blood_pressure_systolic: number | null
          created_at: string
          date: string
          energy: number | null
          had_sex: boolean | null
          id: string
          mood: string[] | null
          physical_symptoms: string[] | null
          sleep_quality: number | null
          stress_level: number | null
          updated_at: string
          user_id: string
          weight: number | null
          wellness_index: number | null
        }
        Insert: {
          blood_pressure_diastolic?: number | null
          blood_pressure_systolic?: number | null
          created_at?: string
          date?: string
          energy?: number | null
          had_sex?: boolean | null
          id?: string
          mood?: string[] | null
          physical_symptoms?: string[] | null
          sleep_quality?: number | null
          stress_level?: number | null
          updated_at?: string
          user_id: string
          weight?: number | null
          wellness_index?: number | null
        }
        Update: {
          blood_pressure_diastolic?: number | null
          blood_pressure_systolic?: number | null
          created_at?: string
          date?: string
          energy?: number | null
          had_sex?: boolean | null
          id?: string
          mood?: string[] | null
          physical_symptoms?: string[] | null
          sleep_quality?: number | null
          stress_level?: number | null
          updated_at?: string
          user_id?: string
          weight?: number | null
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
      user_event_coefficients: {
        Row: {
          base_coefficient: number
          category: string | null
          created_at: string
          cycle_follicular: number | null
          cycle_luteal: number | null
          cycle_menstrual: number | null
          cycle_ovulation: number | null
          event_title: string
          id: string
          is_ai_generated: boolean | null
          stress_coefficient: number | null
          time_afternoon: number | null
          time_evening: number | null
          time_morning: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          base_coefficient: number
          category?: string | null
          created_at?: string
          cycle_follicular?: number | null
          cycle_luteal?: number | null
          cycle_menstrual?: number | null
          cycle_ovulation?: number | null
          event_title: string
          id?: string
          is_ai_generated?: boolean | null
          stress_coefficient?: number | null
          time_afternoon?: number | null
          time_evening?: number | null
          time_morning?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          base_coefficient?: number
          category?: string | null
          created_at?: string
          cycle_follicular?: number | null
          cycle_luteal?: number | null
          cycle_menstrual?: number | null
          cycle_ovulation?: number | null
          event_title?: string
          id?: string
          is_ai_generated?: boolean | null
          stress_coefficient?: number | null
          time_afternoon?: number | null
          time_evening?: number | null
          time_morning?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          age: number | null
          created_at: string
          email: string | null
          height: number | null
          id: string
          language: string | null
          name: string | null
          timezone: string | null
          updated_at: string
          user_id: string
          weight: number | null
        }
        Insert: {
          age?: number | null
          created_at?: string
          email?: string | null
          height?: number | null
          id?: string
          language?: string | null
          name?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
          weight?: number | null
        }
        Update: {
          age?: number | null
          created_at?: string
          email?: string | null
          height?: number | null
          id?: string
          language?: string | null
          name?: string | null
          timezone?: string | null
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
          provider: string
          refresh_token: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string | null
          expires_at?: string | null
          provider?: string
          refresh_token?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string | null
          expires_at?: string | null
          provider?: string
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
      cleanup_old_ai_logs: { Args: never; Returns: undefined }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      cleanup_old_rejected_suggestions: { Args: never; Returns: undefined }
      generate_ai_suggestion_content: {
        Args: {
          cycle_day: number
          cycle_length: number
          event_description?: string
          event_title: string
        }
        Returns: string
      }
      get_ai_stats: { Args: { days_back?: number }; Returns: Json }
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
