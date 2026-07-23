import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { getAuthenticationRedirectUrl } from "../config/applicationUrl";
import {
  AuthenticationRequiredError,
  PersistenceUnavailableError,
  UnknownRepositoryError,
} from "../persistence/repositoryErrors";

export interface AuthSessionState {
  session: Session | null;
  user: User | null;
}

export async function getAuthSessionState(
  client: SupabaseClient,
): Promise<AuthSessionState> {
  const { data, error } = await client.auth.getSession();

  if (error) {
    throw new PersistenceUnavailableError(
      "Could not read the current sign-in state.",
      { cause: error },
    );
  }

  return {
    session: data.session,
    user: data.session?.user ?? null,
  };
}

export async function signInWithPassword(
  client: SupabaseClient,
  email: string,
  password: string,
): Promise<AuthSessionState> {
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    throw new UnknownRepositoryError("Sign in failed. Check your email and password.", {
      cause: error,
    });
  }

  if (!data.session) {
    throw new AuthenticationRequiredError("Sign in did not create a session.");
  }

  return { session: data.session, user: data.session.user };
}

export async function signUpWithPassword(
  client: SupabaseClient,
  email: string,
  password: string,
): Promise<AuthSessionState> {
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: getAuthenticationRedirectUrl(),
    },
  });

  if (error) {
    throw new UnknownRepositoryError("Account creation failed.", { cause: error });
  }

  return {
    session: data.session,
    user: data.session?.user ?? data.user,
  };
}

export async function resetPasswordForEmail(
  client: SupabaseClient,
  email: string,
): Promise<void> {
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: getAuthenticationRedirectUrl(),
  });

  if (error) {
    throw new UnknownRepositoryError(
      "Password reset email could not be sent.",
      { cause: error },
    );
  }
}

export async function signOut(client: SupabaseClient): Promise<void> {
  const { error } = await client.auth.signOut();

  if (error) {
    throw new PersistenceUnavailableError("Sign out failed.", { cause: error });
  }
}

export function formatAuthUserLabel(user: User | null): string {
  if (!user) {
    return "None";
  }

  return user.email ?? user.id;
}

export function onAuthStateChanged(
  client: SupabaseClient,
  listener: (state: AuthSessionState) => void,
): () => void {
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((_event, session) => {
    listener({
      session,
      user: session?.user ?? null,
    });
  });

  return () => {
    subscription.unsubscribe();
  };
}
