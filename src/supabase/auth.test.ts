import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resetPasswordForEmail,
  signUpWithPassword,
} from "./auth";

const { getAuthenticationRedirectUrlMock } = vi.hoisted(() => ({
  getAuthenticationRedirectUrlMock: vi.fn(() => "http://localhost:5173/"),
}));

vi.mock("../config/applicationUrl", () => ({
  getAuthenticationRedirectUrl: getAuthenticationRedirectUrlMock,
}));

function createAuthClient() {
  return {
    auth: {
      signUp: vi.fn().mockResolvedValue({
        data: { session: null, user: { id: "user-1", email: "user@example.com" } },
        error: null,
      }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    },
  } as unknown as SupabaseClient;
}

describe("Supabase auth redirects", () => {
  beforeEach(() => {
    getAuthenticationRedirectUrlMock.mockReturnValue("http://localhost:5173/");
  });

  it("passes emailRedirectTo during signup", async () => {
    const client = createAuthClient();

    await signUpWithPassword(client, "user@example.com", "secret-password");

    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "secret-password",
      options: {
        emailRedirectTo: "http://localhost:5173/",
      },
    });
  });

  it("uses the current auth redirect URL for password reset emails", async () => {
    getAuthenticationRedirectUrlMock.mockReturnValue(
      "https://kevinbroome.github.io/nexus-map/",
    );
    const client = createAuthClient();

    await resetPasswordForEmail(client, "user@example.com");

    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "user@example.com",
      {
        redirectTo: "https://kevinbroome.github.io/nexus-map/",
      },
    );
  });
});
