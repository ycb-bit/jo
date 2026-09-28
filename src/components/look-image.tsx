"use client";

import { useEffect, useState } from "react";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "@/lib/firebase";

/**
 * Renders a lookbook frame. Primary pipeline: compressed data-URI straight
 * from Firestore (no bucket). Legacy storage paths still resolve via
 * getDownloadURL for old frames. Skeleton while resolving, quiet fallback
 * if the object is gone.
 */
export function LookImage({
  path,
  alt,
  className,
}: {
  path: string;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setUrl(null);
    setFailed(false);

    if (path.startsWith("data:image/")) {
      setUrl(path);
      return () => {
        alive = false;
      };
    }

    getDownloadURL(ref(storage, path))
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [path]);

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-bone-dim ${className || ""}`}>
        <span className="text-[10px] uppercase tracking-[0.2em] opacity-40">Frame missing</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className || ""}`}>
      {!url && <div className="skeleton absolute inset-0" />}
      {url && <img src={url} alt={alt} className="card-img h-full w-full object-cover" />}
    </div>
  );
}
