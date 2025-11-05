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
      application_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
          value_encrypted: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: Json
          value_encrypted?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
          value_encrypted?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      mailcow_servers: {
        Row: {
          api_key_encrypted: string | null
          created_at: string
          host: string
          id: string
          name: string
          updated_at: string
          verify_ssl: boolean
        }
        Insert: {
          api_key_encrypted?: string | null
          created_at?: string
          host: string
          id?: string
          name: string
          updated_at?: string
          verify_ssl?: boolean
        }
        Update: {
          api_key_encrypted?: string | null
          created_at?: string
          host?: string
          id?: string
          name?: string
          updated_at?: string
          verify_ssl?: boolean
        }
        Relationships: []
      }
      plesk_servers: {
        Row: {
          created_at: string
          customer_id: string | null
          host: string
          id: string
          name: string
          password_encrypted: string | null
          port: number
          updated_at: string
          username: string
          verify_ssl: boolean
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          host: string
          id?: string
          name: string
          password_encrypted?: string | null
          port?: number
          updated_at?: string
          username: string
          verify_ssl?: boolean
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          host?: string
          id?: string
          name?: string
          password_encrypted?: string | null
          port?: number
          updated_at?: string
          username?: string
          verify_ssl?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "plesk_servers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      proxmox_nodes: {
        Row: {
          created_at: string
          host: string
          id: string
          name: string
          password_encrypted: string | null
          port: number
          realm: string
          updated_at: string
          username: string
          verify_ssl: boolean
        }
        Insert: {
          created_at?: string
          host: string
          id?: string
          name: string
          password_encrypted?: string | null
          port?: number
          realm?: string
          updated_at?: string
          username?: string
          verify_ssl?: boolean
        }
        Update: {
          created_at?: string
          host?: string
          id?: string
          name?: string
          password_encrypted?: string | null
          port?: number
          realm?: string
          updated_at?: string
          username?: string
          verify_ssl?: boolean
        }
        Relationships: []
      }
      servers: {
        Row: {
          cpu_usage: number | null
          created_at: string
          disk_total: number | null
          disk_usage: number | null
          id: string
          last_sync: string | null
          memory_total: number | null
          memory_usage: number | null
          name: string
          node: string
          status: string
          type: string
          updated_at: string
          uptime: number | null
          vmid: number
        }
        Insert: {
          cpu_usage?: number | null
          created_at?: string
          disk_total?: number | null
          disk_usage?: number | null
          id?: string
          last_sync?: string | null
          memory_total?: number | null
          memory_usage?: number | null
          name: string
          node: string
          status: string
          type: string
          updated_at?: string
          uptime?: number | null
          vmid: number
        }
        Update: {
          cpu_usage?: number | null
          created_at?: string
          disk_total?: number | null
          disk_usage?: number | null
          id?: string
          last_sync?: string | null
          memory_total?: number | null
          memory_usage?: number | null
          name?: string
          node?: string
          status?: string
          type?: string
          updated_at?: string
          uptime?: number | null
          vmid?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrypt_value: { Args: { encrypted_text: string }; Returns: string }
      encrypt_value: { Args: { plain_text: string }; Returns: string }
      get_encryption_key: { Args: never; Returns: string }
      is_admin: { Args: { check_user_id: string }; Returns: boolean }
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
