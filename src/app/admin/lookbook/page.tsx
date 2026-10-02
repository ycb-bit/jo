"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { useToast } from "@/lib/store";
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { compressImageToDataUri } from "@/lib/image-compress";
import { LookImage } from "@/components/look-image";
import { UploadBox } from "@/components/upload-box";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { Look } from "@/lib/types";

export default function AdminLookbook() {
  const { toast } = useToast();
  const [looks, setLooks] = useState<Look[]>([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uri, setUri] = useState<string | null>(null); // compressed, ready to save
  const [busy, setBusy] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Look | null>(null);

  useEffect(() => {
    const q = query(collection(db, "lookbook"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (s) => setLooks(s.docs.map((d) => ({ id: d.id, ...d.data() })) as Look[]));
  }, []);

  // compress the moment a photo is picked — instant feedback, no surprise at save time
  const onPick = async (f: File | null) => {
    setFile(f);
    setUri(null);
    if (!f) return;
    setCompressing(true);
    try {
      setUri(await compressImageToDataUri(f));
    } catch {
      toast("Couldn't read that image", "err");
    } finally {
      setCompressing(false);
    }
  };

  const upload = async () => {
    if (!uri) {
      toast("Pick a photo first", "err");
      return;
    }
    setBusy(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/lookbook", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "create", imagePath: uri, title: title.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");
      toast("Added to the album ✓");
      setTitle("");
      setFile(null);
      setUri(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "err");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (l: Look) => {
    setBusy(true);
    try {
      await deleteDoc(doc(db, "lookbook", l.id));
      toast("Frame removed");
      setPendingDelete(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl uppercase">Lookbook</h1>
          <p className="mt-1 text-[13px] opacity-60">{looks.length} frames in the album</p>
        </div>
      </div>

      {/* Uploader */}
      <div className="mt-8 border border-bone/15 p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] opacity-60">Add to the album</p>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
          <div className="space-y-4 text-[13px]">
            <label className="block">
              <span className="opacity-60">Caption (optional)</span>
              <input
                className="mt-1 w-full border-b border-bone/25 bg-transparent py-2 outline-none focus:border-bone"
                placeholder="e.g. Cutting the Ember overshirts"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <div>
              <span className="opacity-60">Photo * — auto-compressed, stored in the database (no bucket)</span>
              <UploadBox
                dark
                className="mt-2"
                disabled={compressing || busy}
                label={file ? file.name : "Drop a photo here or click to browse"}
                hint="JPG / PNG / HEIC — one frame at a time"
                onFiles={(files) => onPick(files[0] || null)}
              >
                {compressing && <p className="mt-3 text-[11px] text-ember">Compressing…</p>}
                {uri && !compressing && (
                  <div className="mt-4 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={uri} alt="Preview" className="h-16 w-16 object-cover" />
                    <span className="text-[11px] text-ember">
                      Ready — {(uri.length / 1024).toFixed(0)} KB after compression
                    </span>
                  </div>
                )}
              </UploadBox>
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={upload}
              disabled={busy || compressing}
              className="h-11 w-full bg-ember px-8 text-[11px] uppercase tracking-[0.2em] text-bone hover:opacity-90 disabled:opacity-50 md:w-auto"
            >
              {busy ? "Saving…" : compressing ? "Compressing…" : "Add frame"}
            </button>
          </div>
        </div>
      </div>

      {/* Album grid */}
      {looks.length > 0 ? (
        <ul className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          {looks.map((l) => (
            <li key={l.id} className="group relative">
              <LookImage path={l.imagePath} alt={l.title || "Lookbook frame"} className="aspect-square w-full" />
              <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-ink/80 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="max-w-[70%] truncate text-[10px] uppercase tracking-[0.16em] text-bone/90">
                  {l.title || "Untitled"}
                </span>
                <button
                  onClick={() => setPendingDelete(l)}
                  className="text-[10px] uppercase tracking-[0.16em] text-bone/70 hover:text-red-400"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-12 text-center text-[13px] opacity-50">No frames yet — add the first one above.</p>
      )}

      {/* Deleting a frame is permanent — make the operator say so first. */}
      <ConfirmDialog
        open={!!pendingDelete}
        title="Remove this frame?"
        intro={
          pendingDelete ? (
            <>
              <strong className="font-medium">{pendingDelete.title || "Untitled frame"}</strong>{" "}
              will disappear from the lookbook on the home page and /lookbook. This cannot be
              undone.
            </>
          ) : null
        }
        confirmWord={pendingDelete?.title?.trim() || "delete"}
        confirmLabel="Remove frame"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove(pendingDelete)}
        busy={busy}
      />
    </div>
  );
}
