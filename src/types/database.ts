// TODO(DAZBY-15): hand-written from supabase/migrations/* because the dev project was not reachable.
// Regenerate with `pnpm db:types` once the migrations are applied; do not edit by hand afterwards.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamp = string;
type Role = "user" | "admin";
type SeasonStatus = "active" | "closed";
type MatchStatus = "scheduled" | "finished" | "postponed" | "cancelled";
type PredictionResult = "exact" | "outcome" | "miss";

type Fk<
  Name extends string,
  Column extends string,
  Ref extends string,
  OneToOne extends boolean,
> = {
  foreignKeyName: Name;
  columns: [Column];
  isOneToOne: OneToOne;
  referencedRelation: Ref;
  referencedColumns: ["id"];
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          nickname: string | null;
          full_name: string | null;
          contact: string | null;
          about: string | null;
          avatar_path: string | null;
          country_code: string | null;
          city: string | null;
          utc_offset_minutes: number;
          role: Role;
          created_at: Timestamp;
          last_login_at: Timestamp | null;
          updated_at: Timestamp;
        };
        Insert: {
          id: string;
          nickname?: string | null;
          full_name?: string | null;
          contact?: string | null;
          about?: string | null;
          avatar_path?: string | null;
          country_code?: string | null;
          city?: string | null;
          utc_offset_minutes?: number;
          role?: Role;
          created_at?: Timestamp;
          last_login_at?: Timestamp | null;
          updated_at?: Timestamp;
        };
        Update: {
          id?: string;
          nickname?: string | null;
          full_name?: string | null;
          contact?: string | null;
          about?: string | null;
          avatar_path?: string | null;
          country_code?: string | null;
          city?: string | null;
          utc_offset_minutes?: number;
          role?: Role;
          created_at?: Timestamp;
          last_login_at?: Timestamp | null;
          updated_at?: Timestamp;
        };
        Relationships: [];
      };
      profile_private: {
        Row: { user_id: string; email: string | null };
        Insert: { user_id: string; email?: string | null };
        Update: { user_id?: string; email?: string | null };
        Relationships: [Fk<"profile_private_user_id_fkey", "user_id", "profiles", true>];
      };
      admin_bootstrap: {
        Row: { email: string; nickname: string | null };
        Insert: { email: string; nickname?: string | null };
        Update: { email?: string; nickname?: string | null };
        Relationships: [];
      };
      tournaments: {
        Row: {
          id: string;
          name: string;
          slug: string;
          kind: "score_prediction";
          points_exact: number;
          points_outcome: number;
          is_active: boolean;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          kind?: "score_prediction";
          points_exact?: number;
          points_outcome?: number;
          is_active?: boolean;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          kind?: "score_prediction";
          points_exact?: number;
          points_outcome?: number;
          is_active?: boolean;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Relationships: [];
      };
      seasons: {
        Row: {
          id: string;
          tournament_id: string;
          name: string;
          status: SeasonStatus;
          closed_at: Timestamp | null;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          name: string;
          status?: SeasonStatus;
          closed_at?: Timestamp | null;
          created_at?: Timestamp;
        };
        Update: {
          id?: string;
          tournament_id?: string;
          name?: string;
          status?: SeasonStatus;
          closed_at?: Timestamp | null;
          created_at?: Timestamp;
        };
        Relationships: [Fk<"seasons_tournament_id_fkey", "tournament_id", "tournaments", false>];
      };
      clubs: {
        Row: {
          id: string;
          name: string;
          short_name: string | null;
          logo_path: string | null;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          name: string;
          short_name?: string | null;
          logo_path?: string | null;
          created_at?: Timestamp;
        };
        Update: {
          id?: string;
          name?: string;
          short_name?: string | null;
          logo_path?: string | null;
          created_at?: Timestamp;
        };
        Relationships: [];
      };
      season_clubs: {
        Row: { season_id: string; club_id: string };
        Insert: { season_id: string; club_id: string };
        Update: { season_id?: string; club_id?: string };
        Relationships: [
          Fk<"season_clubs_season_id_fkey", "season_id", "seasons", false>,
          Fk<"season_clubs_club_id_fkey", "club_id", "clubs", false>,
        ];
      };
      tours: {
        Row: {
          id: string;
          season_id: string;
          number: number;
          title: string | null;
          deadline_override: Timestamp | null;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          season_id: string;
          number: number;
          title?: string | null;
          deadline_override?: Timestamp | null;
          created_at?: Timestamp;
        };
        Update: {
          id?: string;
          season_id?: string;
          number?: number;
          title?: string | null;
          deadline_override?: Timestamp | null;
          created_at?: Timestamp;
        };
        Relationships: [Fk<"tours_season_id_fkey", "season_id", "seasons", false>];
      };
      matches: {
        Row: {
          id: string;
          tour_id: string;
          home_club_id: string;
          away_club_id: string;
          kickoff_at: Timestamp;
          status: MatchStatus;
          home_score: number | null;
          away_score: number | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: string;
          tour_id: string;
          home_club_id: string;
          away_club_id: string;
          kickoff_at: Timestamp;
          status?: MatchStatus;
          home_score?: number | null;
          away_score?: number | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: {
          id?: string;
          tour_id?: string;
          home_club_id?: string;
          away_club_id?: string;
          kickoff_at?: Timestamp;
          status?: MatchStatus;
          home_score?: number | null;
          away_score?: number | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Relationships: [
          Fk<"matches_tour_id_fkey", "tour_id", "tours", false>,
          Fk<"matches_home_club_id_fkey", "home_club_id", "clubs", false>,
          Fk<"matches_away_club_id_fkey", "away_club_id", "clubs", false>,
        ];
      };
      predictions: {
        Row: {
          id: string;
          user_id: string;
          match_id: string;
          home_score: number;
          away_score: number;
          result: PredictionResult | null;
          points: number | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: string;
          user_id: string;
          match_id: string;
          home_score: number;
          away_score: number;
          result?: PredictionResult | null;
          points?: number | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: {
          id?: string;
          user_id?: string;
          match_id?: string;
          home_score?: number;
          away_score?: number;
          result?: PredictionResult | null;
          points?: number | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Relationships: [
          Fk<"predictions_user_id_fkey", "user_id", "profiles", false>,
          Fk<"predictions_match_id_fkey", "match_id", "matches", false>,
        ];
      };
      season_standings: {
        Row: {
          season_id: string;
          user_id: string;
          final_rank: number;
          points: number;
          exact_count: number;
          outcome_count: number;
          miss_count: number;
          predictions_count: number;
          created_at: Timestamp;
        };
        Insert: {
          season_id: string;
          user_id: string;
          final_rank: number;
          points: number;
          exact_count: number;
          outcome_count: number;
          miss_count: number;
          predictions_count: number;
          created_at?: Timestamp;
        };
        Update: {
          season_id?: string;
          user_id?: string;
          final_rank?: number;
          points?: number;
          exact_count?: number;
          outcome_count?: number;
          miss_count?: number;
          predictions_count?: number;
          created_at?: Timestamp;
        };
        Relationships: [
          Fk<"season_standings_season_id_fkey", "season_id", "seasons", false>,
          Fk<"season_standings_user_id_fkey", "user_id", "profiles", false>,
        ];
      };
    };
    Views: {
      season_leaderboard: {
        Row: {
          season_id: string | null;
          user_id: string | null;
          predictions_count: number | null;
          exact_count: number | null;
          outcome_count: number | null;
          miss_count: number | null;
          wins_count: number | null;
          losses_count: number | null;
          win_rate: number | null;
          points: number | null;
          current_rank: number | null;
          final_rank: number | null;
        };
        Relationships: [];
      };
      tour_leaderboard: {
        Row: {
          tour_id: string | null;
          user_id: string | null;
          predictions_count: number | null;
          exact_count: number | null;
          outcome_count: number | null;
          miss_count: number | null;
          points: number | null;
          current_rank: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_admin: { Args: never; Returns: boolean };
      set_user_role: { Args: { target: string; new_role: string }; Returns: undefined };
      tour_deadline: { Args: { p_tour_id: string }; Returns: string };
      can_predict: { Args: { p_match_id: string }; Returns: boolean };
      recalculate_season: { Args: { p_season_id: string }; Returns: undefined };
      close_season: { Args: { p_season_id: string }; Returns: undefined };
      reopen_season: { Args: { p_season_id: string }; Returns: undefined };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"];
