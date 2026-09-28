import { NextRequest } from "next/server";
import { getAuthedUser, json, errorJson } from "@/lib/api-utils";
import { getAdminApp } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

export const runtime = "nodejs";

/** Admin lookbook management: register frames, delete them. */
export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user?.admin) return errorJson("Forbidden", 403);

  const { action, id, imagePath, title } = await req.json().catch(() => ({}));
  const app = await getAdminApp();
  const dbo = getFirestore(app);

  if (action === "create") {
    // Primary pipeline: compressed data URI straight into Firestore.
    // Legacy Storage paths (lookbook/…) still accepted for backwards compat.
    const isDataUri = typeof imagePath === "string" && imagePath.startsWith("data:image/");
    const isStoragePath = typeof imagePath === "string" && imagePath.startsWith("lookbook/");
    if (!isDataUri && !isStoragePath) {
      return errorJson("imagePath must be a data URI or a lookbook/ storage path", 400);
    }
    // Firestore doc limit is 1 MiB — reject frames that won't fit.
    if (isDataUri && imagePath.length > 900_000) {
      return errorJson("Image too large after compression — try a smaller crop", 413);
    }
    const ref = dbo.collection("lookbook").doc();
    await ref.set({
      imagePath,
      title: typeof title === "string" && title.trim() ? title.trim() : null,
      createdAt: Date.now(),
    });
    return json({ ok: true, id: ref.id });
  }

  if (action === "delete") {
    if (typeof id !== "string") return errorJson("id required", 400);
    await dbo.collection("lookbook").doc(id).delete();
    return json({ ok: true });
  }

  return errorJson("Unknown action", 400);
}
