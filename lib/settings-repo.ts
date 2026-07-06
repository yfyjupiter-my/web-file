import "server-only";

import { getSupabaseServerClient } from "./supabase";

/**
 * The single seam for small, singleton app settings (currently just the
 * site-password override — see lib/auth.ts). Mirrors the FilesRepo pattern
 * (lib/files-repo.ts): Supabase-backed when configured, else an in-memory
 * fallback so the app still runs without infra (non-durable — resets on
 * restart, and doesn't survive a password change surviving a redeploy).
 */
export interface SettingsRepo {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

class MockSettingsRepo implements SettingsRepo {
  private values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

class SupabaseSettingsRepo implements SettingsRepo {
  async get(key: string): Promise<string | null> {
    const client = getSupabaseServerClient();
    const { data, error } = await client
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) throw new Error(`settings.get failed: ${error.message}`);
    return (data?.value as string | undefined) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const client = getSupabaseServerClient();
    const { error } = await client
      .from("app_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw new Error(`settings.set failed: ${error.message}`);
  }
}

let repo: SettingsRepo | undefined;

function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSettingsRepo(): SettingsRepo {
  repo ??= isSupabaseConfigured() ? new SupabaseSettingsRepo() : new MockSettingsRepo();
  return repo;
}
