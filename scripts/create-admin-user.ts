/**
 * Creates Jo's admin account on the real project via the service account.
 * Also acts as an Identity Toolkit bootstrap test.
 */
import * as admin from "firebase-admin";

const app = admin.initializeApp({
  credential: admin.credential.cert(require("../jo-service-account.json")),
  storageBucket: "jo-studio-2026.firebasestorage.app",
});

const EMAIL = "cherinetyeamlak2@gmail.com";
const PASSWORD = "JoStudio!2026";

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
        displayName: "Jo",
        emailVerified: true,
      });
      console.log("✓ created user:", user.uid, EMAIL);
    }
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });
    console.log("✓ admin claim set");
    const db = admin.firestore();
    await db.collection("users").doc(user.uid).set(
      {
        email: EMAIL,
        displayName: "Jo",
        role: "admin",
        createdAt: Date.now(),
        addresses: [],
        wishlist: [],
      },
      { merge: true }
    );
    console.log("✓ Firestore profile synced");
    console.log("\nLOGIN →", EMAIL, "/", PASSWORD, "(change the password later)");
  } catch (e: any) {
    console.error("FAIL:", e.code || "", e.message?.slice(0, 200));
    process.exit(1);
  }
  await app.delete();
})();
