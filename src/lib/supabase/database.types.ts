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
      brand_profiles: {
        Row: {
          aliases: string[];
          brand_name: string;
          org_id: string;
          own_domains: string[];
          site_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          aliases?: string[];
          brand_name: string;
          org_id: string;
          own_domains?: string[];
          site_id: string;
          updated_at?: string;
        };
        Update: {
          aliases?: string[];
          brand_name?: string;
          org_id?: string;
          own_domains?: string[];
          site_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_profiles_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_profiles_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: true;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
      competitors: {
        Row: {
          aliases: string[];
          created_at: string;
          created_by: string | null;
          domain: string | null;
          id: string;
          name: string;
          org_id: string;
          site_id: string;
        };
        ComputedFields: never;
        Insert: {
          aliases?: string[];
          created_at?: string;
          created_by?: string | null;
          domain?: string | null;
          id?: string;
          name: string;
          org_id: string;
          site_id: string;
        };
        Update: {
          aliases?: string[];
          created_at?: string;
          created_by?: string | null;
          domain?: string | null;
          id?: string;
          name?: string;
          org_id?: string;
          site_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "competitors_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "competitors_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
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
      llm_usage: {
        Row: {
          cost_usd: number;
          created_at: string;
          id: string;
          input_tokens: number;
          job_run_id: string | null;
          model: string;
          org_id: string;
          output_tokens: number;
          provider: string;
          purpose: string;
          search_requests: number;
          site_id: string | null;
          visibility_run_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          cost_usd?: number;
          created_at?: string;
          id?: string;
          input_tokens?: number;
          job_run_id?: string | null;
          model: string;
          org_id: string;
          output_tokens?: number;
          provider: string;
          purpose: string;
          search_requests?: number;
          site_id?: string | null;
          visibility_run_id?: string | null;
        };
        Update: {
          cost_usd?: number;
          created_at?: string;
          id?: string;
          input_tokens?: number;
          job_run_id?: string | null;
          model?: string;
          org_id?: string;
          output_tokens?: number;
          provider?: string;
          purpose?: string;
          search_requests?: number;
          site_id?: string | null;
          visibility_run_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "llm_usage_job_run_id_fkey";
            columns: ["job_run_id"];
            isOneToOne: false;
            referencedRelation: "job_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "llm_usage_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "llm_usage_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "llm_usage_visibility_run_id_fkey";
            columns: ["visibility_run_id"];
            isOneToOne: false;
            referencedRelation: "visibility_runs";
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
          visibility_providers: string[];
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
          visibility_providers?: string[];
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
          visibility_providers?: string[];
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
      visibility_prompts: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          org_id: string;
          rationale: string | null;
          site_id: string;
          source: Database["public"]["Enums"]["prompt_source"];
          status: Database["public"]["Enums"]["prompt_status"];
          text: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          org_id: string;
          rationale?: string | null;
          site_id: string;
          source?: Database["public"]["Enums"]["prompt_source"];
          status?: Database["public"]["Enums"]["prompt_status"];
          text: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          org_id?: string;
          rationale?: string | null;
          site_id?: string;
          source?: Database["public"]["Enums"]["prompt_source"];
          status?: Database["public"]["Enums"]["prompt_status"];
          text?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "visibility_prompts_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visibility_prompts_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
      visibility_results: {
        Row: {
          answer_text: string | null;
          brand_mentioned: boolean | null;
          brand_position: number | null;
          cited_domains: string[];
          cited_urls: string[];
          competitors_mentioned: string[];
          cost_usd: number;
          created_at: string;
          entities: NonNullable<Json>;
          error: string | null;
          id: string;
          latency_ms: number | null;
          listed_count: number | null;
          model: string;
          org_id: string;
          our_domain_cited: boolean;
          parse_status: Database["public"]["Enums"]["parse_status"];
          prompt_id: string;
          provider: string;
          run_id: string;
          sample_index: number;
          site_id: string;
          status: Database["public"]["Enums"]["result_status"];
        };
        ComputedFields: never;
        Insert: {
          answer_text?: string | null;
          brand_mentioned?: boolean | null;
          brand_position?: number | null;
          cited_domains?: string[];
          cited_urls?: string[];
          competitors_mentioned?: string[];
          cost_usd?: number;
          created_at?: string;
          entities?: NonNullable<Json>;
          error?: string | null;
          id?: string;
          latency_ms?: number | null;
          listed_count?: number | null;
          model: string;
          org_id: string;
          our_domain_cited?: boolean;
          parse_status?: Database["public"]["Enums"]["parse_status"];
          prompt_id: string;
          provider: string;
          run_id: string;
          sample_index: number;
          site_id: string;
          status: Database["public"]["Enums"]["result_status"];
        };
        Update: {
          answer_text?: string | null;
          brand_mentioned?: boolean | null;
          brand_position?: number | null;
          cited_domains?: string[];
          cited_urls?: string[];
          competitors_mentioned?: string[];
          cost_usd?: number;
          created_at?: string;
          entities?: NonNullable<Json>;
          error?: string | null;
          id?: string;
          latency_ms?: number | null;
          listed_count?: number | null;
          model?: string;
          org_id?: string;
          our_domain_cited?: boolean;
          parse_status?: Database["public"]["Enums"]["parse_status"];
          prompt_id?: string;
          provider?: string;
          run_id?: string;
          sample_index?: number;
          site_id?: string;
          status?: Database["public"]["Enums"]["result_status"];
        };
        Relationships: [
          {
            foreignKeyName: "visibility_results_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visibility_results_prompt_id_fkey";
            columns: ["prompt_id"];
            isOneToOne: false;
            referencedRelation: "visibility_prompts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visibility_results_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "visibility_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visibility_results_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
      visibility_runs: {
        Row: {
          completed_calls: number;
          cost_usd: number;
          created_at: string;
          created_by: string | null;
          error: string | null;
          estimated_cost_usd: number;
          failed_calls: number;
          finished_at: string | null;
          id: string;
          job_run_id: string | null;
          org_id: string;
          planned_calls: number;
          prompt_count: number;
          providers: string[];
          samples_per_prompt: number;
          site_id: string;
          started_at: string | null;
          status: Database["public"]["Enums"]["visibility_run_status"];
          trigger: Database["public"]["Enums"]["run_trigger"];
        };
        ComputedFields: never;
        Insert: {
          completed_calls?: number;
          cost_usd?: number;
          created_at?: string;
          created_by?: string | null;
          error?: string | null;
          estimated_cost_usd?: number;
          failed_calls?: number;
          finished_at?: string | null;
          id?: string;
          job_run_id?: string | null;
          org_id: string;
          planned_calls?: number;
          prompt_count?: number;
          providers?: string[];
          samples_per_prompt?: number;
          site_id: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["visibility_run_status"];
          trigger?: Database["public"]["Enums"]["run_trigger"];
        };
        Update: {
          completed_calls?: number;
          cost_usd?: number;
          created_at?: string;
          created_by?: string | null;
          error?: string | null;
          estimated_cost_usd?: number;
          failed_calls?: number;
          finished_at?: string | null;
          id?: string;
          job_run_id?: string | null;
          org_id?: string;
          planned_calls?: number;
          prompt_count?: number;
          providers?: string[];
          samples_per_prompt?: number;
          site_id?: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["visibility_run_status"];
          trigger?: Database["public"]["Enums"]["run_trigger"];
        };
        Relationships: [
          {
            foreignKeyName: "visibility_runs_job_run_id_fkey";
            columns: ["job_run_id"];
            isOneToOne: false;
            referencedRelation: "job_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visibility_runs_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visibility_runs_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
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
      site_ai_spend_this_month: { Args: { p_site_id: string }; Returns: number };
      visibility_cited_domains: {
        Args: { p_from: string; p_limit?: number; p_site_id: string; p_to: string };
        Returns: {
          answers: number;
          citations: number;
          domain: string;
          providers: string[];
        }[];
      };
      visibility_prompt_stats: {
        Args: { p_from: string; p_site_id: string; p_to: string };
        Returns: {
          best_position: number;
          brand_mentions: number;
          prompt_id: string;
          provider: string;
          samples: number;
          top_competitors: string[];
        }[];
      };
      visibility_trend: {
        Args: { p_bucket?: string; p_from: string; p_site_id: string; p_to: string };
        Returns: {
          brand_mentions: number;
          bucket: string;
          competitor_mentions: number;
          first_at: string;
          last_at: string;
          provider: string;
          samples: number;
        }[];
      };
    };
    Enums: {
      cms_type: "wordpress" | "webflow" | "shopify" | "squarespace" | "wix" | "custom" | "other";
      integration_provider: "gsc" | "wordpress";
      integration_status: "pending" | "connected" | "error" | "revoked";
      job_status: "queued" | "running" | "succeeded" | "failed" | "canceled";
      org_role: "owner" | "editor" | "viewer";
      parse_status: "parsed" | "failed" | "skipped";
      prompt_source: "manual" | "suggested";
      prompt_status: "active" | "paused" | "suggested";
      result_status: "ok" | "error" | "refused";
      run_frequency: "daily" | "weekly" | "monthly" | "manual";
      run_trigger: "manual" | "scheduled";
      visibility_run_status: "queued" | "running" | "completed" | "partial" | "failed" | "budget_blocked";
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
      parse_status: ["parsed", "failed", "skipped"],
      prompt_source: ["manual", "suggested"],
      prompt_status: ["active", "paused", "suggested"],
      result_status: ["ok", "error", "refused"],
      run_frequency: ["daily", "weekly", "monthly", "manual"],
      run_trigger: ["manual", "scheduled"],
      visibility_run_status: ["queued", "running", "completed", "partial", "failed", "budget_blocked"],
    },
  },
} as const;
