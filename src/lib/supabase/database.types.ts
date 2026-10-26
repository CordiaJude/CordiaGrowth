export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      integrations: {
        Row: {
          created_at: string;
          created_by: string | null;
          encrypted_credentials: string | null;
          id: string;
          key_version: number | null;
          last_error: string | null;
          metadata: NonNullable<Json>;
          org_id: string;
          provider: Database["public"]["Enums"]["integration_provider"];
          site_id: string;
          status: Database["public"]["Enums"]["integration_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          encrypted_credentials?: string | null;
          id?: string;
          key_version?: number | null;
          last_error?: string | null;
          metadata?: NonNullable<Json>;
          org_id: string;
          provider: Database["public"]["Enums"]["integration_provider"];
          site_id: string;
          status?: Database["public"]["Enums"]["integration_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          encrypted_credentials?: string | null;
          id?: string;
          key_version?: number | null;
          last_error?: string | null;
          metadata?: NonNullable<Json>;
          org_id?: string;
          provider?: Database["public"]["Enums"]["integration_provider"];
          site_id?: string;
          status?: Database["public"]["Enums"]["integration_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "integrations_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "integrations_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
      job_runs: {
        Row: {
          cost_usd: number;
          created_at: string;
          error: string | null;
          external_run_id: string | null;
          finished_at: string | null;
          id: string;
          logs: NonNullable<Json>;
          org_id: string;
          output: Json | null;
          payload: NonNullable<Json>;
          runner: string;
          site_id: string | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["job_status"];
          task_id: string;
          triggered_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          cost_usd?: number;
          created_at?: string;
          error?: string | null;
          external_run_id?: string | null;
          finished_at?: string | null;
          id?: string;
          logs?: NonNullable<Json>;
          org_id: string;
          output?: Json | null;
          payload?: NonNullable<Json>;
          runner?: string;
          site_id?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["job_status"];
          task_id: string;
          triggered_by?: string | null;
        };
        Update: {
          cost_usd?: number;
          created_at?: string;
          error?: string | null;
          external_run_id?: string | null;
          finished_at?: string | null;
          id?: string;
          logs?: NonNullable<Json>;
          org_id?: string;
          output?: Json | null;
          payload?: NonNullable<Json>;
          runner?: string;
          site_id?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["job_status"];
          task_id?: string;
          triggered_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "job_runs_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_runs_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
      memberships: {
        Row: {
          created_at: string;
          org_id: string;
          role: Database["public"]["Enums"]["org_role"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          org_id: string;
          role?: Database["public"]["Enums"]["org_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          org_id?: string;
          role?: Database["public"]["Enums"]["org_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          slug: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      site_settings: {
        Row: {
          auto_publish: boolean;
          content_pieces_per_week: number;
          monthly_ai_budget_usd: number;
          org_id: string;
          site_id: string;
          updated_at: string;
          visibility_run_frequency: Database["public"]["Enums"]["run_frequency"];
          visibility_runs_per_prompt: number;
        };
        ComputedFields: never;
        Insert: {
          auto_publish?: boolean;
          content_pieces_per_week?: number;
          monthly_ai_budget_usd?: number;
          org_id: string;
          site_id: string;
          updated_at?: string;
          visibility_run_frequency?: Database["public"]["Enums"]["run_frequency"];
          visibility_runs_per_prompt?: number;
        };
        Update: {
          auto_publish?: boolean;
          content_pieces_per_week?: number;
          monthly_ai_budget_usd?: number;
          org_id?: string;
          site_id?: string;
          updated_at?: string;
          visibility_run_frequency?: Database["public"]["Enums"]["run_frequency"];
          visibility_runs_per_prompt?: number;
        };
        Relationships: [
          {
            foreignKeyName: "site_settings_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "site_settings_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: true;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
      sites: {
        Row: {
          business_type: string | null;
          city: string | null;
          cms_type: Database["public"]["Enums"]["cms_type"];
          country: string | null;
          created_at: string;
          created_by: string | null;
          domain: string;
          id: string;
          name: string;
          org_id: string;
          region: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          business_type?: string | null;
          city?: string | null;
          cms_type?: Database["public"]["Enums"]["cms_type"];
          country?: string | null;
          created_at?: string;
          created_by?: string | null;
          domain: string;
          id?: string;
          name: string;
          org_id: string;
          region?: string | null;
          updated_at?: string;
        };
        Update: {
          business_type?: string | null;
          city?: string | null;
          cms_type?: Database["public"]["Enums"]["cms_type"];
          country?: string | null;
          created_at?: string;
          created_by?: string | null;
          domain?: string;
          id?: string;
          name?: string;
          org_id?: string;
          region?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sites_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_organization: {
        Args: { p_name: string; p_slug: string };
        Returns: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          slug: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "organizations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      cms_type: "wordpress" | "webflow" | "shopify" | "squarespace" | "wix" | "custom" | "other";
      integration_provider: "gsc" | "wordpress";
      integration_status: "pending" | "connected" | "error" | "revoked";
      job_status: "queued" | "running" | "succeeded" | "failed" | "canceled";
      org_role: "owner" | "editor" | "viewer";
      run_frequency: "daily" | "weekly" | "monthly" | "manual";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      cms_type: ["wordpress", "webflow", "shopify", "squarespace", "wix", "custom", "other"],
      integration_provider: ["gsc", "wordpress"],
      integration_status: ["pending", "connected", "error", "revoked"],
      job_status: ["queued", "running", "succeeded", "failed", "canceled"],
      org_role: ["owner", "editor", "viewer"],
      run_frequency: ["daily", "weekly", "monthly", "manual"],
    },
  },
} as const;
