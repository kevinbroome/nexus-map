export type RepositoryMode = "local" | "supabase";

export interface AppEnvironment {
  repositoryMode: RepositoryMode;
  supabase?: {
    url: string;
    publishableKey: string;
  };
}
