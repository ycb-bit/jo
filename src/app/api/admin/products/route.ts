import { NextRequest } from "next/server";
import { getAuthedUser, json, errorJson } from "@/lib/api-utils";
import { getAdminApp } from "@/lib/firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Admin product management: create, update, delete, image upload. */
export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user?.admin) return errorJson("Forbidden", 403);

  const contentType = req.headers.get("content-type") || "";

  // Multipart form => product with optional images (already compressed to data URIs client-side)
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const payload = JSON.parse((form.get("payload") as string) || "{}");
    // A save carries the full image set (kept existing + newly picked).
    // Accept data URIs (primary pipeline) and legacy storage paths.
    const isImageRef = (f: unknown): f is string =>
      typeof f === "string" && (f.startsWith("data:image/") || f.startsWith("products/") || f.startsWith("lookbook/"));
    const imagesProvided = form.get("imagesSet") === "1";
    const dataUris = form.getAll("images").filter(isImageRef);

    // Firestore docs cap at 1 MiB — reject image sets that can't fit, with a
    // clear message instead of a silent failed save.
    const imageBudget = dataUris.reduce((n, u) => n + u.length, 0);
    if (imageBudget > 750_000) {
      return errorJson(
        "Images are too heavy for one product document — remove a photo or use smaller crops",
        413
      );
    }

    const db = getFirestore(await getAdminApp());

    const now = Date.now();
    const doc = {
      ...payload,
      ...(imagesProvided ? { images: dataUris } : {}),
      slug: payload.slug || slugify(payload.name || "product"),
      createdAt: payload.createdAt || now,
      updatedAt: now,
    };

    if (payload.id) {
      await db.collection("products").doc(payload.id).set(doc, { merge: true });
      return json({ ok: true, id: payload.id });
    }
    const created = await db.collection("products").add(doc);
    return json({ ok: true, id: created.id });
  }

  // JSON => update fields only (publish toggle, stock edits, delete)
  const body = await req.json().catch(() => null);
  if (!body) return errorJson("Invalid body");
  const db = getFirestore(await getAdminApp());

  if (body.action === "delete" && body.id) {
    await db.collection("products").doc(body.id).delete();
    return json({ ok: true });
  }
  if (body.action === "togglePublish" && body.id) {
    await db
      .collection("products")
      .doc(body.id)
      .update({ published: !!body.published, updatedAt: FieldValue.serverTimestamp() });
    return json({ ok: true });
  }
  if (body.id) {
    const { id, ...rest } = body;
    await db.collection("products").doc(id).set({ ...rest, updatedAt: Date.now() }, { merge: true });
    return json({ ok: true, id });
  }
  return errorJson("Unsupported operation");
}
