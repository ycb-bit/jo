/**
 * Compress an image file in the browser → JPEG data URI.
 * Long edge capped at `maxEdge`, quality tunable. Product images land
 * straight in Firestore as strings — no Storage bucket needed (free-plan
 * friendly: Firestore 1 MiB/doc limit means ~150–250 KB per image is safe).
 */
export async function compressImageToDataUri(
  file: File,
  maxEdge = 1100,
  quality = 0.72
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  let out = cv.toDataURL("image/jpeg", quality);
  // if still too heavy for a Firestore doc, squeeze harder
  if (out.length > 380_000 && quality > 0.5) {
    out = cv.toDataURL("image/jpeg", 0.5);
  }
  return out;
}
