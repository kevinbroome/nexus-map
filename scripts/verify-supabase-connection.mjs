import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    throw new Error(".env.local not found");
  }

  const values = {};

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    values[trimmed.slice(0, separator).trim()] = trimmed
      .slice(separator + 1)
      .trim();
  }

  return values;
}

async function main() {
  const env = loadEnvLocal();
  const url = env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("FAIL: Missing VITE_SUPABASE_URL or publishable key in .env.local");
    process.exit(1);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    console.error("FAIL: VITE_SUPABASE_URL is not a valid URL");
    process.exit(1);
  }

  const healthResponse = await fetch(`${url}/auth/v1/health`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });

  if (!healthResponse.ok) {
    console.error(
      `FAIL: Supabase auth health check returned HTTP ${healthResponse.status}`,
    );
    process.exit(1);
  }

  console.log("OK: Supabase project reachable");
  console.log(`OK: Project host ${parsedUrl.host}`);
  console.log(`OK: auth/v1/health returned HTTP ${healthResponse.status}`);
  console.log(`OK: VITE_WORLD_REPOSITORY=${env.VITE_WORLD_REPOSITORY ?? "local"}`);
  console.log(
    "NOTE: Browser client initialisation is verified when running npm run dev (dev diagnostics panel).",
  );
}

main().catch((error) => {
  console.error("FAIL:", error instanceof Error ? error.message : error);
  process.exit(1);
});
