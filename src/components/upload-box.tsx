"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The dashed "drop photos here" box used by every uploader in the admin desk
 * (lookbook frames and product images). A real button wrapping a hidden input,
 * so it has a hit area people can actually see and click, plus drag-and-drop.
 */
export function UploadBox({
  onFiles,
  multiple = false,
  accept = "image/*",
  label = "Drop photos here or click to browse",
  hint,
  dark = false,
  disabled = false,
  className,
  children,
}: {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  label?: string;
  hint?: string;
  /** Admin desk is the dark surface; storefront forms are light. */
  dark?: boolean;
  disabled?: boolean;
  className?: string;
  /** Rendered under the box — previews, budget bars, hints. */
  children?: React.ReactNode;
}) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const take = (list: FileList | null) => {
    if (!list || disabled) return;
    const files = Array.from(list);
    if (files.length) onFiles(files);
  };

  return (
    <div
      className={className}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files);
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex w-full flex-col items-center justify-center border border-dashed p-8 text-center transition-colors",
          over
            ? "border-ember bg-ember/10"
            : dark
              ? "border-bone/30 hover:border-bone"
              : "border-line hover:border-ink",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <span className="text-[13px] opacity-70">
          {over ? "Drop it here" : label}
        </span>
        {hint && <span className="mt-1 text-[11px] opacity-40">{hint}</span>}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />

      {children}
    </div>
  );
}