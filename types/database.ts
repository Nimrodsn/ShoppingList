// Shape of `supabase gen types typescript --linked`. Regenerate with `pnpm gen:types`
// after every migration instead of editing this file by hand.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      households: {
        Row: {
          id: string;
          name: string;
          secret_slug: string;
          cookie_generation: number;
          realtime_key: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name?: string;
          secret_slug: string;
          cookie_generation?: number;
          realtime_key?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          secret_slug?: string;
          cookie_generation?: number;
          realtime_key?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          household_id: string;
          key: string;
          name: string;
          emoji: string;
          color: string;
          position: number;
          is_archived: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          key: string;
          name: string;
          emoji?: string;
          color?: string;
          position?: number;
          is_archived?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          key?: string;
          name?: string;
          emoji?: string;
          color?: string;
          position?: number;
          is_archived?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      lists: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          emoji: string;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          emoji?: string;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          name?: string;
          emoji?: string;
          position?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lists_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      catalog_items: {
        Row: {
          id: string;
          household_id: string | null;
          name: string;
          name_norm: string;
          aliases: string[];
          aliases_norm: string[] | null;
          category_key: string;
          default_unit: string;
          emoji: string | null;
          use_count: number;
          last_used_at: string | null;
          is_staple: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id?: string | null;
          name: string;
          aliases?: string[];
          aliases_norm?: string[] | null;
          category_key?: string;
          default_unit?: string;
          emoji?: string | null;
          use_count?: number;
          last_used_at?: string | null;
          is_staple?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string | null;
          name?: string;
          aliases?: string[];
          aliases_norm?: string[] | null;
          category_key?: string;
          default_unit?: string;
          emoji?: string | null;
          use_count?: number;
          last_used_at?: string | null;
          is_staple?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "catalog_items_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      items: {
        Row: {
          id: string;
          client_id: string | null;
          household_id: string;
          list_id: string;
          category_id: string | null;
          catalog_item_id: string | null;
          name: string;
          name_norm: string;
          quantity: number | null;
          unit: string | null;
          note: string | null;
          is_checked: boolean;
          is_urgent: boolean;
          position: number;
          added_by: string | null;
          checked_by: string | null;
          checked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id?: string | null;
          household_id: string;
          list_id: string;
          category_id?: string | null;
          catalog_item_id?: string | null;
          name: string;
          quantity?: number | null;
          unit?: string | null;
          note?: string | null;
          is_checked?: boolean;
          is_urgent?: boolean;
          position?: number;
          added_by?: string | null;
          checked_by?: string | null;
          checked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string | null;
          household_id?: string;
          list_id?: string;
          category_id?: string | null;
          catalog_item_id?: string | null;
          name?: string;
          quantity?: number | null;
          unit?: string | null;
          note?: string | null;
          is_checked?: boolean;
          is_urgent?: boolean;
          position?: number;
          added_by?: string | null;
          checked_by?: string | null;
          checked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "items_catalog_item_id_fkey";
            columns: ["catalog_item_id"];
            isOneToOne: false;
            referencedRelation: "catalog_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "items_household_id_category_id_fkey";
            columns: ["household_id", "category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["household_id", "id"];
          },
          {
            foreignKeyName: "items_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "items_household_id_list_id_fkey";
            columns: ["household_id", "list_id"];
            isOneToOne: false;
            referencedRelation: "lists";
            referencedColumns: ["household_id", "id"];
          },
        ];
      };
      purchase_history: {
        Row: {
          id: string;
          client_id: string | null;
          household_id: string;
          name: string;
          category_key: string | null;
          quantity: number | null;
          unit: string | null;
          purchased_at: string;
          purchased_by: string | null;
        };
        Insert: {
          id?: string;
          client_id?: string | null;
          household_id: string;
          name: string;
          category_key?: string | null;
          quantity?: number | null;
          unit?: string | null;
          purchased_at?: string;
          purchased_by?: string | null;
        };
        Update: {
          id?: string;
          client_id?: string | null;
          household_id?: string;
          name?: string;
          category_key?: string | null;
          quantity?: number | null;
          unit?: string | null;
          purchased_at?: string;
          purchased_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_history_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      default_categories: {
        Row: {
          key: string;
          name: string;
          emoji: string;
          color: string;
          position: number;
        };
        Insert: {
          key: string;
          name: string;
          emoji: string;
          color: string;
          position: number;
        };
        Update: {
          key?: string;
          name?: string;
          emoji?: string;
          color?: string;
          position?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      normalize_he: {
        Args: { txt: string };
        Returns: string;
      };
      new_secret_slug: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      create_household: {
        Args: { p_name?: string };
        Returns: {
          id: string;
          secret_slug: string;
          realtime_key: string;
        }[];
      };
      rotate_household_secrets: {
        Args: { p_household_id: string };
        Returns: {
          secret_slug: string;
          cookie_generation: number;
          realtime_key: string;
        }[];
      };
      match_catalog: {
        Args: {
          p_household_id: string;
          p_query: string;
          p_limit?: number;
        };
        Returns: {
          id: string;
          name: string;
          category_key: string;
          default_unit: string;
          emoji: string | null;
          is_staple: boolean;
          score: number;
        }[];
      };
      bump_catalog_usage: {
        Args: { p_household_id: string; p_names: string[] };
        Returns: undefined;
      };
      suggest_forgotten: {
        Args: { p_household_id: string; p_limit?: number };
        Returns: {
          name: string;
          category_key: string | null;
          avg_days: number;
          days_since: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
