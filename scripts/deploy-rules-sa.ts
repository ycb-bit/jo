/**
 * Deploys Firestore + Storage security rules to the live project.
 *
 * Uses the service account from the environment (Settings → Environment) to
 * mint an OAuth token, so it no longer needs a hand-copied .gcp-token.
 *
 *   npx tsx scripts/deploy-rules-sa.ts
 */
import * as admin from "firebase-admin";
import { createSign } from "crypto";
import { readFileSync } from "fs";

const PROJECT = process.env.FIREBASE_PROJECT_ID || "jo-studio-2026";

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: PROJECT,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}

const API = `https://firebaserules.googleapis.com/v1/projects/${PROJECT}`;

/**
 * firebase-admin 13 dropped its getAccessToken helper, so mint the OAuth token
 * straight from the service-account key (the standard JWT bearer exchange).
 */
function b64url(input: Buffer | string) {
  return Buffer.from(input as never).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function accessToken(): Promise<string> {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || "";
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) throw new Error("Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY first");

  const iat = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      iat,
      exp: iat + 3600,
    })
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const assertion = `${header}.${claims}.${signer.sign(privateKey, "base64url")}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const json = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(`token exchange failed: ${json.error || ""} ${json.error_description || res.status}`);
  }
  return json.access_token;
}

async function call(method: string, url: string, body?: unknown) {
  const access_token = await accessToken();
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${access_token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: res.status, json };
}

async function deployRelease(service: string, sourceFile: string) {
  const content = readFileSync(sourceFile, "utf8");

  const ruleset = await call("POST", `${API}/rulesets`, {
    source: { files: [{ name: sourceFile, content }] },
  });
  if (ruleset.status >= 300) {
    throw new Error(`ruleset rejected (${ruleset.status}): ${JSON.stringify(ruleset.json).slice(0, 300)}`);
  }
  const rulesetName: string = ruleset.json.name;
  console.log(`  ruleset created — ${rulesetName.split("/").pop()}`);

  let release = await call("POST", `${API}/releases`, {
    name: `projects/${PROJECT}/releases/${service}`,
    rulesetName,
  });

  if (release.status >= 300 && release.json?.error?.status === "ALREADY_EXISTS") {
    console.log("  release existed — replacing it");
    await call("DELETE", `${API}/releases/${service}`);
    release = await call("POST", `${API}/releases`, {
      name: `projects/${PROJECT}/releases/${service}`,
      rulesetName,
    });
  }

  if (release.status >= 300) {
    throw new Error(`release failed (${release.status}): ${JSON.stringify(release.json).slice(0, 300)}`);
  }
  console.log(`  ✓ ${sourceFile} is live for ${service} (ruleset ${String(release.json.rulesetName).split("/").pop()})`);
}

(async () => {
  console.log(`project: ${PROJECT}`);
  for (const [service, file] of [
    ["cloud.firestore", "firestore.rules"],
    ["firebase.storage", "storage.rules"],
  ] as const) {
    console.log(`\n→ ${service} (${file})`);
    try {
      await deployRelease(service, file);
    } catch (e) {
      console.error(`  ✗ ${service}: ${e instanceof Error ? e.message : String(e)}`);
      process.exitCode = 1;
    }
  }
  process.exit(process.exitCode || 0);
})();