/**
 * Creates (or grants) an admin account on the real project via the service account.
 *
 * Credentials come from the environment (Settings → Environment):
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *
 * Admin identity also comes from the environment, so no secret is committed:
 *   ADMIN_EMAIL     — the account to create/grant
 *   ADMIN_PASSWORD  — initial password (generate a strong one; rotate after first login)
 *
 * Usage:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npm run admin:user
 */
import * as admin from "firebase-admin";

const app = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID || "jo-studio-2026",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  }),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "jo-studio-2026.firebasestorage.app",
});

const EMAIL = (process.env.ADMIN_EMAIL || "").trim();
const PASSWORD = process.env.ADMIN_PASSWORD || "";

if (!EMAIL || !PASSWORD) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD in the environment before running this script.");
  await app.delete();
  process.exit(1);
}

(async () => {
  try {
    let user;
    try {
      user = await admin.auth().getUserByEmail(EMAIL);
      console.log("user already exists:", user.uid);
    } catch {
      user = await admin.auth().createUser({
        email: EMAIL,
        password: PASSWORD,
        displayName: process.env.ADMIN_DISPLAY_NAME || "Store admin",
        emailVerified: true,
      });
      console.log("✓ created user:", user.uid);
    }
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });
    console.log("✓ admin claim set");

    const db = admin.firestore();
    await db.collection("users").doc(user.uid).set(
      {
        email: EMAIL,
        displayName: process.env.ADMIN_DISPLAY_NAME || "Store admin",
        role: "admin",
        createdAt: Date.now(),
        addresses: [],
        wishlist: [],
      },
      { merge: true }
    );
    console.log("✓ Firestore profile synced");
    console.log("\nAdmin account ready →", EMAIL);
    console.log("Change the password after the first sign-in.");
  } catch (e: any) {
    console.error("FAIL:", e.code || "", e.message?.slice(0, 200));
    process.exit(1);
  }
  await app.delete();
})();
