/**
 * One-off production setup for jo-studio-2026:
 *  1. Create a key for the jo-admin service account → jo-service-account.json
 *  2. Enable Email/Password sign-in (Identity Toolkit admin v2)
 *  3. Print the auth config summary (providers + authorized domains)
 * Resilient: execFileSync curl with args array (no cmd.exe mangling),
 * retries, and DoH IP pinning per host.
 */
const { execFileSync } = require("child_process");
const fs = require("fs");

const TOK = fs.readFileSync(".gcp-token", "utf8").trim();
const SA = "jo-admin@jo-studio-2026.iam.gserviceaccount.com";

const ipCache = new Map();
function realIp(host) {
  if (ipCache.has(host)) return ipCache.get(host);
  try {
    const raw = execFileSync(
      "curl",
      ["-s", "--max-time", "8", `https://dns.google/resolve?name=${host}&type=A`],
      { encoding: "utf8" }
    );
    const j = JSON.parse(raw);
    const a = (j.Answer || []).find((x) => x.type === 1);
    const ip = a ? a.data : null;
    ipCache.set(host, ip);
    return ip;
  } catch {
    ipCache.set(host, null);
    return null;
  }
}

function curl(host, args, label, tries = 4) {
  let last = "";
  const IP = realIp(host);
  for (let i = 1; i <= tries; i++) {
    const full = ["-s", "--max-time", "40"];
    if (IP) full.push("--resolve", `${host}:443:${IP}`);
    full.push("-H", `Authorization: Bearer ${TOK}`, ...args);
    try {
      const out = execFileSync("curl", full, { encoding: "utf8" });
      if (out.trim().startsWith("<!DOCTYPE")) throw new Error("html error page");
      if (out.trim() === "") throw new Error("empty response");
      return out;
    } catch (e) {
      last = String(e.message);
      console.log(`  ${label}: attempt ${i} failed (${last.slice(0, 70)}), retrying...`);
      if (i < tries) execFileSync("sleep", ["3"]);
    }
  }
  throw new Error(`${label} failed after ${tries} tries: ${last}`);
}

// ── 1. Service account key ──────────────────────────────────────────────
console.log("1) creating service account key...");
const keyResp = curl(
  "iam.googleapis.com",
  [
    "-X", "POST",
    "-H", "Content-Type: application/json",
    "-d", "{}",
    `https://iam.googleapis.com/v1/projects/jo-studio-2026/serviceAccounts/${SA}/keys`,
  ],
  "createKey"
);
const key = JSON.parse(keyResp);
if (key.error) {
  console.log("createKey error:", JSON.stringify(key.error).slice(0, 300));
  process.exit(1);
}
fs.writeFileSync("jo-service-account.json", Buffer.from(key.privateKeyData, "base64"));
const saJson = JSON.parse(fs.readFileSync("jo-service-account.json", "utf8"));
console.log(
  "   key written → jo-service-account.json (type:", saJson.type + ",",
  "project:", saJson.project_id + ")"
);

// ── 2. Enable email/password sign-in ────────────────────────────────────
console.log("2) enabling email/password sign-in...");
const cfgResp = curl(
  "identitytoolkit.googleapis.com",
  ["https://identitytoolkit.googleapis.com/admin/v2/projects/jo-studio-2026/config"],
  "getConfig"
);
const cfg = JSON.parse(cfgResp);
if (cfg.error) {
  console.log("getConfig error:", JSON.stringify(cfg.error).slice(0, 300));
  process.exit(1);
}
const signIn = { ...(cfg.signIn || {}) };
signIn.email = {
  enabled: true,
  ...(signIn.email || {}),
  passwordRequired: true,
};
fs.writeFileSync(
  ".auth-config.json",
  JSON.stringify({ signIn }, null, 2)
);
const patchResp = curl(
  "identitytoolkit.googleapis.com",
  [
    "-X", "PATCH",
    "-H", "Content-Type: application/json",
    "-d", JSON.stringify({ signIn }),
    "https://identitytoolkit.googleapis.com/admin/v2/projects/jo-studio-2026/config?updateMask=signIn.email",
  ],
  "patchConfig"
);
const patched = JSON.parse(patchResp);
if (patched.error) {
  console.log("patchConfig error:", JSON.stringify(patched.error).slice(0, 300));
  process.exit(1);
}
console.log("   email/password:", patched.signIn?.email?.enabled === true ? "ENABLED" : "NOT enabled");

// ── 3. Summary ──────────────────────────────────────────────────────────
console.log("3) authorized domains:", (patched.authorizedDomains || []).slice(0, 6).join(", "));
console.log("DONE");
