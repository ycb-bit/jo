/**
 * One-off: grant jo-admin SA the roles it needs, with retry + DoH IP pinning
 * to survive the flaky local DNS proxy. Token read from .gcp-token.
 * Uses execFileSync with an args array (no shell) to survive Windows quoting.
 */
const { execFileSync } = require("child_process");
const fs = require("fs");

const TOK = fs.readFileSync(".gcp-token", "utf8").trim();
const HOST = "cloudresourcemanager.googleapis.com";

function realIp(host) {
  try {
    const raw = execFileSync(
      "curl",
      ["-s", "--max-time", "8", `https://dns.google/resolve?name=${host}&type=A`],
      { encoding: "utf8" }
    );
    const j = JSON.parse(raw);
    const a = (j.Answer || []).find((x) => x.type === 1);
    return a ? a.data : null;
  } catch {
    return null;
  }
}

function curlWithRetry(args, label, tries = 4) {
  let last = "";
  for (let i = 1; i <= tries; i++) {
    const full = ["-s", "--max-time", "30"];
    if (IP) full.push("--resolve", `${HOST}:443:${IP}`);
    full.push("-H", `Authorization: Bearer ${TOK}`, ...args);
    try {
      const out = execFileSync("curl", full, { encoding: "utf8" });
      if (out.trim().startsWith("<!DOCTYPE")) throw new Error("html error page");
      if (out.trim() === "") throw new Error("empty response");
      return out;
    } catch (e) {
      last = String(e.message);
      console.log(`  ${label}: attempt ${i} failed (${last.slice(0, 60)}), retrying...`);
      if (i < tries) execFileSync("sleep", ["3"]);
    }
  }
  throw new Error(`${label} failed after ${tries} tries: ${last}`);
}

console.log("resolving", HOST, "via DoH...");
const IP = realIp(HOST);
console.log("pinned IP:", IP || "(none, using system DNS)");

const getResp = curlWithRetry(
  [
    "-X", "POST",
    "-H", "Content-Type: application/json",
    "-d", "{}",
    `https://${HOST}/v1/projects/jo-studio-2026:getIamPolicy`,
  ],
  "getIamPolicy"
);
const fetched = JSON.parse(getResp);
if (fetched.error) {
  console.log("getIamPolicy error:", JSON.stringify(fetched.error).slice(0, 300));
  process.exit(1);
}
const policy = fetched; // v1 returns the Policy object directly (includes etag)
policy.bindings = policy.bindings || [];
console.log("current policy:", policy.bindings.length, "bindings, etag:", policy.etag ? "present" : "missing");

const add = (role, member) => {
  let b = policy.bindings.find((x) => x.role === role);
  if (!b) { b = { role, members: [] }; policy.bindings.push(b); }
  if (!b.members.includes(member)) b.members.push(member);
};
add("roles/firebase.admin", "serviceAccount:jo-admin@jo-studio-2026.iam.gserviceaccount.com");
add("roles/iam.serviceAccountTokenCreator", "serviceAccount:jo-admin@jo-studio-2026.iam.gserviceaccount.com");

const setResp = curlWithRetry(
  [
    "-X", "POST",
    "-H", "Content-Type: application/json",
    "-d", JSON.stringify({ policy }),
    `https://${HOST}/v1/projects/jo-studio-2026:setIamPolicy`,
  ],
  "setIamPolicy"
);
const ok = JSON.parse(setResp);
if (ok.error) {
  console.log("setIamPolicy error:", JSON.stringify(ok.error).slice(0, 300));
  process.exit(1);
}
console.log("policy updated:", (ok.bindings || []).length, "bindings");
console.log("DONE");
