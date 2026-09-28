/**
 * Deploys Firestore + Storage security rules to the REAL project
 * (jo-studio-2026) via the REST API, using .gcp-token.
 * Use this every time you edit firestore.rules / storage.rules.
 *
 *   node scripts/deploy-rules.js
 */
const { execFileSync } = require("child_process");
const fs = require("fs");

const TOK = fs.readFileSync(".gcp-token", "utf8").trim();
const PROJECT = "jo-studio-2026";

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

function deployRelease(service, sourceFile) {
  console.log(`\n→ ${service} (${sourceFile})`);
  const content = fs.readFileSync(sourceFile, "utf8");
  const rs = JSON.parse(
    curl(
      "firebaserules.googleapis.com",
      [
        "-X", "POST",
        "-H", "Content-Type: application/json",
        "-d", JSON.stringify({ source: { files: [{ name: sourceFile, content }] } }),
        `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/rulesets`,
      ],
      `${service} ruleset`
    )
  );
  if (rs.error) throw new Error(JSON.stringify(rs.error).slice(0, 200));
  console.log(`  ruleset ${rs.name.split("/").pop()}`);

  let rel = JSON.parse(
    curl(
      "firebaserules.googleapis.com",
      [
        "-X", "POST",
        "-H", "Content-Type: application/json",
        "-d", JSON.stringify({ name: `projects/${PROJECT}/releases/${service}`, rulesetName: rs.name }),
        `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases`,
      ],
      `${service} release`
    )
  );
  if (rel.error && rel.error.status === "ALREADY_EXISTS") {
    // Release exists — replace it: delete, then re-create.
    curl(
      "firebaserules.googleapis.com",
      [
        "-X", "DELETE",
        `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases/${service}`,
      ],
      `${service} release delete`
    );
    rel = JSON.parse(
      curl(
        "firebaserules.googleapis.com",
        [
          "-X", "POST",
          "-H", "Content-Type: application/json",
          "-d", JSON.stringify({ name: `projects/${PROJECT}/releases/${service}`, rulesetName: rs.name }),
          `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases`,
        ],
        `${service} release recreate`
      )
    );
  }
  if (rel.error) throw new Error(JSON.stringify(rel.error).slice(0, 200));
  console.log(`  release ${service} → ${String(rel.rulesetName).split("/").pop()}`);
}

deployRelease("cloud.firestore", "firestore.rules");
deployRelease("firebase.storage", "storage.rules");
console.log("\nDONE — rules are live.");
