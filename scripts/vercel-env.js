/**
 * Pushes all production env vars to the linked Vercel project via the REST API.
 * curl-based (immune to the local proxy problems that stall `npx vercel`).
 * Reads .env.local + jo-service-account.json — never leaves the machine.
 *
 *   node scripts/vercel-env.js
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

function parseEnv(pathName) {
  const out = {};
  for (const line of fs.readFileSync(pathName, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  return out;
}

function cliToken() {
  const candidates = [
    path.join(os.homedir(), "AppData", "Roaming", "com.vercel.cli", "Data", "auth.json"),
    path.join(os.homedir(), "AppData", "Roaming", "com.vercel.cli", "auth.json"),
    path.join(os.homedir(), ".vercel", "auth.json"),
    path.join(os.homedir(), ".local", "share", "com.vercel.cli", "auth.json"),
  ];
  for (const c of candidates) {
    try {
      const t = JSON.parse(fs.readFileSync(c, "utf8")).token;
      if (t) return t;
    } catch {}
  }
  throw new Error("No Vercel token found — run `npx vercel login` once.");
}

function curl(url, method, body) {
  const args = ["-s", "--max-time", "30", "-X", method, "-H", `Authorization: Bearer ${TOKEN}`];
  if (body) args.push("-H", "Content-Type: application/json", "-d", JSON.stringify(body));
  args.push(url);
  return JSON.parse(execFileSync("curl", args, { maxBuffer: 10 * 1024 * 1024 }).toString());
}

const env = parseEnv(".env.local");
const sa = JSON.parse(fs.readFileSync("jo-service-account.json", "utf8"));
const TOKEN = cliToken();

const { projectId, orgId: teamId } = JSON.parse(fs.readFileSync(".vercel/project.json", "utf8"));
const BASE = `https://api.vercel.com/v10/projects/${projectId}/env?teamId=${teamId}&upsert=true`;

const vars = {
  NEXT_PUBLIC_FIREBASE_API_KEY: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID || "jo-studio-2026",
  FIREBASE_CLIENT_EMAIL: sa.client_email,
  // Must carry literal \n — src/lib/firebase-admin.ts un-escapes it at boot.
  FIREBASE_PRIVATE_KEY: sa.private_key.replace(/\n/g, "\\n"),
  NEXT_PUBLIC_ADMIN_EMAIL: env.NEXT_PUBLIC_ADMIN_EMAIL || "cherinetyeamlak2@gmail.com",
};

let failed = 0;
for (const [name, value] of Object.entries(vars)) {
  if (!value) {
    console.error("MISSING VALUE FOR:", name);
    failed++;
    continue;
  }
  try {
    curl(BASE, "POST", {
      key: name,
      value,
      type: name.startsWith("NEXT_PUBLIC_") ? "plain" : "encrypted",
      target: ["production", "preview"],
    });
    console.log("SET:", name);
  } catch (e) {
    console.error("FAILED:", name, e instanceof Error ? e.message.split("\n")[0] : e);
    failed++;
  }
}
process.exit(failed ? 1 : 0);
