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
      chat_bans: {
        Row: {
          banned_at: string;
          banned_by: string | null;
          user_id: string;
        };
        Insert: {
          banned_at?: string;
          banned_by?: string | null;
          user_id: string;
        };
        Update: {
          banned_at?: string;
          banned_by?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_bans_banned_by_fkey";
            columns: ["banned_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_bans_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_messages: {
        Row: {
          author_avatar_path: string | null;
          author_nickname: string;
          body: string;
          created_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          author_avatar_path?: string | null;
          author_nickname?: string;
          body: string;
          created_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          author_avatar_path?: string | null;
          author_nickname?: string;
          body?: string;
          created_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
      login_tokens: {
        Row: {
          code: string;
          confirmed_at: string | null;
          consumed_at: string | null;
          created_at: string;
          expires_at: string;
          first_name: string | null;
          last_name: string | null;
          locale: string;
          telegram_id: string | null;
          telegram_username: string | null;
          token_hash: string;
        };
        Insert: {
          code: string;
          confirmed_at?: string | null;
          consumed_at?: string | null;
          created_at?: string;
          expires_at?: string;
          first_name?: string | null;
          last_name?: string | null;
          locale?: string;
          telegram_id?: string | null;
          telegram_username?: string | null;
          token_hash: string;
        };
        Update: {
          code?: string;
          confirmed_at?: string | null;
          consumed_at?: string | null;
          created_at?: string;
          expires_at?: string;
          first_name?: string | null;
          last_name?: string | null;
          locale?: string;
          telegram_id?: string | null;
          telegram_username?: string | null;
          token_hash?: string;
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
      mgr_cities: {
        Row: {
          country: string;
          id: number;
          name: string;
        };
        Insert: {
          country: string;
          id?: never;
          name: string;
        };
        Update: {
          country?: string;
          id?: never;
          name?: string;
        };
        Relationships: [];
      };
      mgr_club_seeds: {
        Row: {
          club_id: string;
          squad_seed: string;
        };
        Insert: {
          club_id: string;
          squad_seed: string;
        };
        Update: {
          club_id?: string;
          squad_seed?: string;
        };
        Relationships: [];
      };
      mgr_clubs: {
        Row: {
          budget: number;
          logo_path: string | null;
          city_id: number;
          country: string;
          created_at: string;
          id: string;
          dormant: boolean;
          dormant_since: string | null;
          elo: number;
          elo_peak: number;
          is_bot: boolean;
          league_id: string | null;
          name: string;
          primary_color: string;
          secondary_color: string;
          squad_seed: string | null;
          user_id: string | null;
        };
        Insert: {
          budget?: number;
          logo_path?: string | null;
          city_id: number;
          country?: string;
          created_at?: string;
          id?: string;
          dormant?: boolean;
          dormant_since?: string | null;
          elo?: number;
          elo_peak?: number;
          is_bot?: boolean;
          league_id?: string | null;
          name: string;
          primary_color: string;
          secondary_color: string;
          squad_seed?: string | null;
          user_id?: string | null;
        };
        Update: {
          budget?: number;
          logo_path?: string | null;
          city_id?: number;
          country?: string;
          created_at?: string;
          id?: string;
          dormant?: boolean;
          dormant_since?: string | null;
          elo?: number;
          elo_peak?: number;
          is_bot?: boolean;
          league_id?: string | null;
          name?: string;
          primary_color?: string;
          secondary_color?: string;
          squad_seed?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "mgr_clubs_city_id_fkey";
            columns: ["city_id"];
            isOneToOne: false;
            referencedRelation: "mgr_cities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mgr_clubs_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "mgr_leagues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mgr_clubs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      mgr_elo_log: {
        Row: {
          after: number;
          before: number;
          club_id: string;
          created_at: string;
          match_id: string;
        };
        Insert: {
          after: number;
          before: number;
          club_id: string;
          created_at?: string;
          match_id: string;
        };
        Update: {
          after?: number;
          before?: number;
          club_id?: string;
          created_at?: string;
          match_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mgr_elo_log_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "mgr_clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mgr_elo_log_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "mgr_matches";
            referencedColumns: ["id"];
          },
        ];
      };
      mgr_elo_matches: {
        Row: {
          match_id: string;
        };
        Insert: {
          match_id: string;
        };
        Update: {
          match_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mgr_elo_matches_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: true;
            referencedRelation: "mgr_matches";
            referencedColumns: ["id"];
          },
        ];
      };
      mgr_leagues: {
        Row: {
          created_at: string;
          first_kickoff_at: string;
          id: string;
          last_tick_at: string | null;
          number: number;
          phase: string;
          play_delay_seconds: number;
          pool_month: string | null;
          preseason_ends_at: string | null;
          season: number;
        };
        Insert: {
          created_at?: string;
          first_kickoff_at: string;
          id?: string;
          last_tick_at?: string | null;
          number?: never;
          phase?: string;
          play_delay_seconds?: never;
          pool_month?: string | null;
          preseason_ends_at?: string | null;
          season?: number;
        };
        Update: {
          created_at?: string;
          first_kickoff_at?: string;
          id?: string;
          last_tick_at?: string | null;
          number?: never;
          phase?: string;
          play_delay_seconds?: never;
          pool_month?: string | null;
          preseason_ends_at?: string | null;
          season?: number;
        };
        Relationships: [];
      };
      mgr_lineups: {
        Row: {
          club_id: string;
          formation: string;
          mentality: string;
          player_ids: string[];
          updated_at: string;
        };
        Insert: {
          club_id: string;
          formation: string;
          mentality?: string;
          player_ids: string[];
          updated_at?: string;
        };
        Update: {
          club_id?: string;
          formation?: string;
          mentality?: string;
          player_ids?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mgr_lineups_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: true;
            referencedRelation: "mgr_clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      mgr_matches: {
        Row: {
          away_auto: boolean;
          away_club_id: string;
          away_goals: number | null;
          away_lineup: Json | null;
          events: Json | null;
          home_auto: boolean;
          home_club_id: string;
          home_goals: number | null;
          home_lineup: Json | null;
          id: string;
          kickoff_at: string;
          kind: string;
          league_id: string;
          played_at: string | null;
          round: number;
          season: number;
          status: string;
        };
        Insert: {
          away_auto: boolean;
          away_club_id: string;
          away_goals?: number | null;
          away_lineup?: Json | null;
          events?: Json | null;
          home_auto: boolean;
          home_club_id: string;
          home_goals?: number | null;
          home_lineup?: Json | null;
          id?: string;
          kickoff_at: string;
          kind?: string;
          league_id: string;
          played_at?: string | null;
          round: number;
          season?: number;
          status?: string;
        };
        Update: {
          away_auto?: boolean;
          away_club_id?: string;
          away_goals?: number | null;
          away_lineup?: Json | null;
          events?: Json | null;
          home_auto?: boolean;
          home_club_id?: string;
          home_goals?: number | null;
          home_lineup?: Json | null;
          id?: string;
          kickoff_at?: string;
          kind?: string;
          league_id?: string;
          played_at?: string | null;
          round?: number;
          season?: number;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mgr_matches_away_club_id_fkey";
            columns: ["away_club_id"];
            isOneToOne: false;
            referencedRelation: "mgr_clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mgr_matches_home_club_id_fkey";
            columns: ["home_club_id"];
            isOneToOne: false;
            referencedRelation: "mgr_clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mgr_matches_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "mgr_leagues";
            referencedColumns: ["id"];
          },
        ];
      };
      mgr_player_attributes: {
        Row: {
          attribute: string;
          player_id: string;
          value: number;
        };
        Insert: {
          attribute: string;
          player_id: string;
          value: number;
        };
        Update: {
          attribute?: string;
          player_id?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "mgr_player_attributes_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "mgr_players";
            referencedColumns: ["id"];
          },
        ];
      };
      mgr_player_hidden: {
        Row: {
          player_id: string;
          potential: number;
        };
        Insert: {
          player_id: string;
          potential: number;
        };
        Update: {
          player_id?: string;
          potential?: number;
        };
        Relationships: [
          {
            foreignKeyName: "mgr_player_hidden_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: true;
            referencedRelation: "mgr_players";
            referencedColumns: ["id"];
          },
        ];
      };
      mgr_auctions: {
        Row: {
          id: string;
          league_id: string;
          player_id: string;
          seller_club_id: string;
          start_price: number;
          step_percent: number;
          nominal: number;
          status: string;
          created_at: string;
          ends_at: string;
          bid_count: number;
          best_bid: number | null;
          best_club_id: string | null;
          buyer_club_id: string | null;
          final_price: number | null;
          closed_at: string | null;
        };
        Insert: {
          id?: string;
          league_id: string;
          player_id: string;
          seller_club_id: string;
          start_price: number;
          step_percent: number;
          nominal: number;
          status?: string;
          created_at?: string;
          ends_at: string;
          bid_count?: number;
          best_bid?: number | null;
          best_club_id?: string | null;
          buyer_club_id?: string | null;
          final_price?: number | null;
          closed_at?: string | null;
        };
        Update: {
          status?: string;
          bid_count?: number;
          best_bid?: number | null;
          best_club_id?: string | null;
          buyer_club_id?: string | null;
          final_price?: number | null;
          closed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "mgr_auctions_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "mgr_players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mgr_auctions_seller_club_id_fkey";
            columns: ["seller_club_id"];
            isOneToOne: false;
            referencedRelation: "mgr_clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      mgr_bids: {
        Row: {
          id: number;
          auction_id: string;
          club_id: string;
          amount: number;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: never;
          auction_id: string;
          club_id: string;
          amount: number;
          status?: string;
          created_at?: string;
        };
        Update: {
          status?: string;
        };
        Relationships: [];
      };
      mgr_trades: {
        Row: {
          id: string;
          league_id: string;
          from_club_id: string;
          to_club_id: string;
          give_ids: string[];
          take_ids: string[];
          cash: number;
          status: string;
          created_at: string;
          expires_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          league_id: string;
          from_club_id: string;
          to_club_id: string;
          give_ids: string[];
          take_ids: string[];
          cash?: number;
        };
        Update: {
          status?: string;
          resolved_at?: string | null;
        };
        Relationships: [];
      };
      mgr_deals: {
        Row: {
          club_a: string;
          club_b: string;
          season: number;
          kind: string;
          ref: string;
          created_at: string;
        };
        Insert: {
          club_a: string;
          club_b: string;
          season: number;
          kind: string;
          ref: string;
          created_at?: string;
        };
        Update: {
          kind?: string;
        };
        Relationships: [];
      };
      mgr_transactions: {
        Row: {
          amount: number;
          balance_after: number;
          club_id: string;
          created_at: string;
          id: number;
          reason: string;
          ref: string | null;
        };
        Insert: {
          amount: number;
          balance_after: number;
          club_id: string;
          created_at?: string;
          id?: never;
          reason: string;
          ref?: string | null;
        };
        Update: {
          amount?: number;
          balance_after?: number;
          club_id?: string;
          created_at?: string;
          id?: never;
          reason?: string;
          ref?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "mgr_transactions_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "mgr_clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      mgr_player_stats: {
        Row: {
          club_id: string;
          assists: number;
          clean_sheets: number;
          goals: number;
          injuries: number;
          matches: number;
          shots: number;
          shots_on_target: number;
          league_id: string;
          player_id: string;
          season: number;
        };
        Insert: {
          club_id: string;
          assists?: number;
          clean_sheets?: number;
          goals?: number;
          injuries?: number;
          matches?: number;
          shots?: number;
          shots_on_target?: number;
          league_id: string;
          player_id: string;
          season: number;
        };
        Update: {
          club_id?: string;
          assists?: number;
          clean_sheets?: number;
          goals?: number;
          injuries?: number;
          matches?: number;
          shots?: number;
          shots_on_target?: number;
          league_id?: string;
          player_id?: string;
          season?: number;
        };
        Relationships: [
          {
            foreignKeyName: "mgr_player_stats_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "mgr_players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mgr_player_stats_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "mgr_clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      mgr_players: {
        Row: {
          academy_club_id: string | null;
          age: number;
          citizenship: string;
          club_id: string | null;
          created_at: string;
          first_name: string;
          fitness: number;
          form: number;
          id: string;
          idle_rounds: number;
          injured_until: string | null;
          last_name: string;
          morale: number;
          ovr: number;
          pool_league_id: string | null;
          position: string;
          retire_after_season: boolean;
          training_focus: string | null;
          tradable_after: string | null;
          wage: number;
          contract_until: number | null;
          contract_offer_season: number | null;
        };
        Insert: {
          academy_club_id?: string | null;
          age: number;
          citizenship: string;
          club_id?: string | null;
          created_at?: string;
          first_name: string;
          fitness?: number;
          form?: number;
          id?: string;
          idle_rounds?: number;
          injured_until?: string | null;
          last_name: string;
          morale?: number;
          ovr: number;
          pool_league_id?: string | null;
          position: string;
          retire_after_season?: boolean;
          training_focus?: string | null;
          tradable_after?: string | null;
          wage?: number;
          contract_until?: number | null;
          contract_offer_season?: number | null;
        };
        Update: {
          academy_club_id?: string | null;
          age?: number;
          citizenship?: string;
          club_id?: string | null;
          created_at?: string;
          first_name?: string;
          fitness?: number;
          form?: number;
          id?: string;
          idle_rounds?: number;
          injured_until?: string | null;
          last_name?: string;
          morale?: number;
          ovr?: number;
          pool_league_id?: string | null;
          position?: string;
          retire_after_season?: boolean;
          training_focus?: string | null;
          tradable_after?: string | null;
          wage?: number;
          contract_until?: number | null;
          contract_offer_season?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "mgr_players_academy_club_id_fkey";
            columns: ["academy_club_id"];
            isOneToOne: false;
            referencedRelation: "mgr_clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mgr_players_pool_league_id_fkey";
            columns: ["pool_league_id"];
            isOneToOne: false;
            referencedRelation: "mgr_leagues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mgr_players_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "mgr_clubs";
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
      mgr_player_career: {
        Row: {
          assists: number | null;
          clean_sheets: number | null;
          goals: number | null;
          injuries: number | null;
          matches: number | null;
          shots: number | null;
          shots_on_target: number | null;
          player_id: string | null;
          seasons: number | null;
        };
        Relationships: [];
      };
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
      chat_is_banned: { Args: { p_user: string }; Returns: boolean };
      close_season: { Args: { p_season_id: string }; Returns: undefined };
      is_admin: { Args: never; Returns: boolean };
      mgr_apply_elo: { Args: { p_match: string }; Returns: boolean };
      mgr_backfill_elo: { Args: never; Returns: number };
      mgr_join_league: { Args: { p_club: string }; Returns: string };
      mgr_my_league: { Args: never; Returns: string };
      mgr_open_league: {
        Args: { p_bots: Json; p_club: string; p_first_kickoff: string; p_matches: Json };
        Returns: string;
      };
      mgr_play_match: {
        Args: {
          p_away_goals: number;
          p_away_lineup: Json;
          p_effects: Json;
          p_events: Json;
          p_home_goals: number;
          p_home_lineup: Json;
          p_match: string;
        };
        Returns: boolean;
      };
      mgr_save_lineup: {
        Args: { p_formation: string; p_mentality: string; p_players: string[]; p_user: string };
        Returns: undefined;
      };
      mgr_set_training: { Args: { p_plans: Json; p_user: string }; Returns: undefined };
      mgr_take_bot_place: { Args: { p_bot: string; p_club: string }; Returns: string };
      mgr_apply_preseason_day: {
        Args: { p_day: string; p_effects: Json; p_league: string };
        Returns: boolean;
      };
      mgr_close_season: { Args: { p_league: string; p_replacements: Json }; Returns: boolean };
      mgr_leagues_to_close: { Args: never; Returns: string[] };
      mgr_leagues_to_open: { Args: never; Returns: string[] };
      mgr_open_season: { Args: { p_league: string; p_matches: Json }; Returns: boolean };
      mgr_request_friendly: { Args: { p_opponent?: string; p_user: string }; Returns: string };
      mgr_add_pool: {
        Args: { p_league: string; p_month: string; p_players: Json };
        Returns: boolean;
      };
      mgr_buy_free_agent: { Args: { p_player: string; p_user: string }; Returns: number };
      mgr_list_player: {
        Args: { p_player: string; p_price: number; p_step: number; p_user: string };
        Returns: string;
      };
      mgr_cancel_auction: { Args: { p_auction: string; p_user: string }; Returns: boolean };
      mgr_place_bid: {
        Args: { p_amount: number; p_auction: string; p_user: string };
        Returns: string;
      };
      mgr_due_auctions: { Args: never; Returns: string[] };
      mgr_settle_auction: { Args: { p_auction: string }; Returns: string | null };
      mgr_propose_trade: {
        Args: {
          p_cash: number;
          p_give: string[];
          p_take: string[];
          p_to_club: string;
          p_user: string;
        };
        Returns: string;
      };
      mgr_accept_trade: { Args: { p_trade: string; p_user: string }; Returns: undefined };
      mgr_close_trade: {
        Args: { p_action: string; p_trade: string; p_user: string };
        Returns: boolean;
      };
      mgr_expire_trades: { Args: never; Returns: number };
      mgr_extend_contract: {
        Args: { p_player: string; p_seasons: number; p_user: string };
        Returns: string;
      };
      mgr_terminate_contract: { Args: { p_player: string; p_user: string }; Returns: number };
      mgr_release_expired: { Args: { p_league: string }; Returns: number };
      mgr_contract_rounds: { Args: { p_player: string }; Returns: number };

      mgr_nominal: { Args: { p_age: number; p_ovr: number }; Returns: number };
      mgr_pay: {
        Args: { p_amount: number; p_club: string; p_ref: string; p_reason: string };
        Returns: number;
      };
      mgr_play_match_v2: {
        Args: {
          p_away_goals: number;
          p_away_lineup: Json;
          p_effects: Json;
          p_events: Json;
          p_home_goals: number;
          p_home_lineup: Json;
          p_match: string;
          p_money: Json;
        };
        Returns: boolean;
      };
      mgr_play_match_v3: {
        Args: {
          p_away_auto: boolean;
          p_away_goals: number;
          p_away_lineup: Json;
          p_effects: Json;
          p_events: Json;
          p_home_auto: boolean;
          p_home_goals: number;
          p_home_lineup: Json;
          p_match: string;
          p_money: Json;
        };
        Returns: boolean;
      };
      mgr_confirm_return: { Args: { p_user: string }; Returns: boolean };
      mgr_try_lease: {
        Args: { p_holder: string; p_name: string; p_seconds: number };
        Returns: boolean;
      };
      mgr_release_lease: { Args: { p_holder: string; p_name: string }; Returns: undefined };
      mgr_due_matches: {
        Args: { p_limit: number; p_now: string };
        Returns: {
          away_club_id: string;
          home_club_id: string;
          id: string;
          kickoff_at: string;
          kind: string;
        }[];
      };
      mgr_work_due: { Args: { p_now?: string }; Returns: boolean };
      mgr_overdue_count: { Args: { p_minutes: number }; Returns: number };
      mgr_alert_change: {
        Args: { p_min_seconds: number; p_name: string; p_state: string };
        Returns: boolean;
      };
      mgr_set_logo: { Args: { p_path: string; p_user: string }; Returns: undefined };
      mgr_create_club: {
        Args: {
          p_city: number;
          p_name: string;
          p_players: Json;
          p_primary: string;
          p_secondary: string;
          p_seed: string;
          p_user: string;
        };
        Returns: string;
      };
      purge_chat_messages: { Args: never; Returns: undefined };
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
