export const runtimeEnv = {
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "jo-studio-2026",
  saPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || "./jo-service-account.json",
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
  privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "jo-studio-2026.firebasestorage.app",
  useEmulators: process.env.FIREBASE_USE_EMULATORS === "1" || process.env.NEXT_PUBLIC_USE_EMULATORS === "1",
};

let cached: import("firebase-admin/app").App | null = null;

export async function getAdminApp() {
  if (cached) return cached;
  const { initializeApp, getApps, cert } = await import("firebase-admin/app");
  const fs = await import("fs");

  if (runtimeEnv.useEmulators) {
    // Local emulator mode: admin SDK talks to emulators without creds.
    const app = getApps()[0] || initializeApp({ projectId: runtimeEnv.projectId });
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
    process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
    cached = app;
    return app;
  }

  if (runtimeEnv.clientEmail && runtimeEnv.privateKey) {
    // Hosted mode (Vercel): credentials from env vars — no key file needed.
    const app =
      getApps()[0] ||
      initializeApp({
        credential: cert({
          projectId: runtimeEnv.projectId,
          clientEmail: runtimeEnv.clientEmail,
          privateKey: runtimeEnv.privateKey,
        }),
        storageBucket: runtimeEnv.storageBucket,
      });
    cached = app;
    return app;
  }

  if (fs.existsSync(runtimeEnv.saPath)) {
    // Local mode: service account key on disk.
    const sa = JSON.parse(fs.readFileSync(runtimeEnv.saPath, "utf8"));
    const app =
      getApps()[0] ||
      initializeApp({
        credential: cert(sa),
        storageBucket: runtimeEnv.storageBucket,
      });
    cached = app;
    return app;
  }

  throw new Error(
    `No Firebase credentials: set GOOGLE_APPLICATION_CREDENTIALS or place ${runtimeEnv.saPath}. ` +
      `For local dev set FIREBASE_USE_EMULATORS=1 instead.`
  );
}

export async function verifyIdToken(idToken: string) {
  const app = await getAdminApp();
  const { getAuth } = await import("firebase-admin/auth");
  return getAuth(app).verifyIdToken(idToken);
}
