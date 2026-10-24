export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      admin_bootstrap: {
        Row: {
          email: string;
          nickname: string | null;
        };
        Insert: {
          email: string;
          nickname?: string | null;
        };
        Update: {
          email?: string;
          nickname?: string | null;
        };
        Relationships: [];
      };
      clubs: {
        Row: {
          created_at: string;
          id: string;
          logo_path: string | null;
          name: string;
          short_name: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          logo_path?: string | null;
          name: string;
          short_name?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          logo_path?: string | null;
          name?: string;
          short_name?: string | null;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          away_club_id: string;
          away_score: number | null;
          created_at: string;
          home_club_id: string;
          home_score: number | null;
          id: string;
          kickoff_at: string;
          status: string;
          tour_id: string;
          updated_at: string;
        };
        Insert: {
          away_club_id: string;
          away_score?: number | null;
          created_at?: string;
          home_club_id: string;
          home_score?: number | null;
          id?: string;
          kickoff_at: string;
          status?: string;
          tour_id: string;
          updated_at?: string;
        };
        Update: {
          away_club_id?: string;
          away_score?: number | null;
          created_at?: string;
          home_club_id?: string;
          home_score?: number | null;
          id?: string;
          kickoff_at?: string;
          status?: string;
          tour_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "matches_away_club_id_fkey";
            columns: ["away_club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_home_club_id_fkey";
            columns: ["home_club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_tour_id_fkey";
            columns: ["tour_id"];
            isOneToOne: false;
            referencedRelation: "tours";
            referencedColumns: ["id"];
          },
        ];
      };
      predictions: {
        Row: {
          away_score: number;
          created_at: string;
          home_score: number;
          id: string;
          match_id: string;
          points: number | null;
          result: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          away_score: number;
          created_at?: string;
          home_score: number;
          id?: string;
          match_id: string;
          points?: number | null;
          result?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          away_score?: number;
          created_at?: string;
          home_score?: number;
          id?: string;
          match_id?: string;
          points?: number | null;
          result?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "predictions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_private: {
        Row: {
          email: string | null;
          user_id: string;
        };
        Insert: {
          email?: string | null;
          user_id: string;
        };
        Update: {
          email?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_private_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          about: string | null;
          avatar_path: string | null;
          city: string | null;
          contact: string | null;
          country_code: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          last_login_at: string | null;
          nickname: string | null;
          role: string;
          updated_at: string;
          utc_offset_minutes: number;
        };
        Insert: {
          about?: string | null;
          avatar_path?: string | null;
          city?: string | null;
          contact?: string | null;
          country_code?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          last_login_at?: string | null;
          nickname?: string | null;
          role?: string;
          updated_at?: string;
          utc_offset_minutes?: number;
        };
        Update: {
          about?: string | null;
          avatar_path?: string | null;
          city?: string | null;
          contact?: string | null;
          country_code?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          last_login_at?: string | null;
          nickname?: string | null;
          role?: string;
          updated_at?: string;
          utc_offset_minutes?: number;
        };
        Relationships: [];
      };
      season_clubs: {
        Row: {
          club_id: string;
          season_id: string;
        };
        Insert: {
          club_id: string;
          season_id: string;
        };
        Update: {
          club_id?: string;
          season_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "season_clubs_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "season_clubs_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
        ];
      };
      season_standings: {
        Row: {
          created_at: string;
          exact_count: number;
          final_rank: number;
          miss_count: number;
          outcome_count: number;
          points: number;
          predictions_count: number;
          season_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          exact_count: number;
          final_rank: number;
          miss_count: number;
          outcome_count: number;
          points: number;
          predictions_count: number;
          season_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          exact_count?: number;
          final_rank?: number;
          miss_count?: number;
          outcome_count?: number;
          points?: number;
          predictions_count?: number;
          season_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "season_standings_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "season_standings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      seasons: {
        Row: {
          closed_at: string | null;
          created_at: string;
          id: string;
          name: string;
          status: string;
          tournament_id: string;
        };
        Insert: {
          closed_at?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          status?: string;
          tournament_id: string;
        };
        Update: {
          closed_at?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          status?: string;
          tournament_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "seasons_tournament_id_fkey";
            columns: ["tournament_id"];
            isOneToOne: false;
            referencedRelation: "tournaments";
            referencedColumns: ["id"];
          },
        ];
      };
      tournaments: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          kind: string;
          name: string;
          points_exact: number;
          points_outcome: number;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          kind?: string;
          name: string;
          points_exact?: number;
          points_outcome?: number;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          kind?: string;
          name?: string;
          points_exact?: number;
          points_outcome?: number;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tours: {
        Row: {
          created_at: string;
          deadline_override: string | null;
          id: string;
          number: number;
          season_id: string;
          title: string | null;
        };
        Insert: {
          created_at?: string;
          deadline_override?: string | null;
          id?: string;
          number: number;
          season_id: string;
          title?: string | null;
        };
        Update: {
          created_at?: string;
          deadline_override?: string | null;
          id?: string;
          number?: number;
          season_id?: string;
          title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tours_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      season_leaderboard: {
        Row: {
          current_rank: number | null;
          exact_count: number | null;
          final_rank: number | null;
          losses_count: number | null;
          miss_count: number | null;
          outcome_count: number | null;
          points: number | null;
          predictions_count: number | null;
          season_id: string | null;
          user_id: string | null;
          win_rate: number | null;
          wins_count: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "predictions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tours_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
        ];
      };
      tour_leaderboard: {
        Row: {
          current_rank: number | null;
          exact_count: number | null;
          miss_count: number | null;
          outcome_count: number | null;
          points: number | null;
          predictions_count: number | null;
          tour_id: string | null;
          user_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "matches_tour_id_fkey";
            columns: ["tour_id"];
            isOneToOne: false;
            referencedRelation: "tours";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "predictions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      apply_admin_bootstrap: {
        Args: { p_confirmed: boolean; p_email: string; p_user_id: string };
        Returns: undefined;
      };
      can_predict: { Args: { p_match_id: string }; Returns: boolean };
      close_season: { Args: { p_season_id: string }; Returns: undefined };
      is_admin: { Args: never; Returns: boolean };
      recalculate_season: { Args: { p_season_id: string }; Returns: undefined };
      reopen_season: { Args: { p_season_id: string }; Returns: undefined };
      set_user_role: {
        Args: { new_role: string; target: string };
        Returns: undefined;
      };
      tour_deadline: { Args: { p_tour_id: string }; Returns: string };
    };
    Enums: {
      [_ in never]: never;
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
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
