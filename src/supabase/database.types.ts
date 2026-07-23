export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type WorldsRow = {
  id: string;
  user_id: string;
  name: string;
  world_data: Json;
  world_version: number;
  revision: number;
  created_at: string;
  updated_at: string;
} & Record<string, unknown>;

export type WorldsInsert = {
  id: string;
  user_id: string;
  name: string;
  world_data: Json;
  world_version: number;
  revision?: number;
} & Record<string, unknown>;

export type WorldsUpdate = {
  name?: string;
  world_data?: Json;
  world_version?: number;
  revision?: number;
} & Record<string, unknown>;

/** Hand-maintained schema mirror for Supabase PostgREST. */
export interface NexusDatabase {
  public: {
    Tables: {
      worlds: {
        Row: WorldsRow;
        Insert: WorldsInsert;
        Update: WorldsUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
