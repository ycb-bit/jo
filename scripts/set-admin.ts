/**
 * Grants the admin claim to a user account.
 * Usage: npm run set-admin -- you@example.com
 * The user must have signed up once already. Run against emulators or prod per env.
 */
import * as admin from "firebase-admin";

if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  // already set via env when targeting emulators
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: npm run set-admin -- you@example.com");
  process.exit(1);
}

const app = admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "demo-jo-studio" });

(async () => {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });
  // Keep the Firestore profile in sync too
  const db = admin.firestore();
  await db.collection("users").doc(user.uid).set({ role: "admin" }, { merge: true });
  console.log(`✓ ${email} is now an admin (sign out & back in to refresh)`);
  await app.delete();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
