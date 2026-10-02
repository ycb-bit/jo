"use client";

import { useEffect, useState } from "react";

/**
 * Confirm-before-delete for anything irreversible in the admin desk.
 *
 * A plain window.confirm() is too easy to click through, and a single button
 * is worse. When `confirmWord` is set the destructive button stays disabled
 * until the operator types that exact word.
 */
export function ConfirmDialog({
  open,
  title,
  intro,
  confirmWord,
  confirmLabel = "Delete permanently",
  onConfirm,
  onCancel,
  busy = false,
  children,
}: {
  open: boolean;
  title: string;
  intro: React.ReactNode;
  /** Type this exactly to arm the destructive button. */
  confirmWord?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  /** Extra detail (price, stock, photos) shown above the confirm field. */
  children?: React.ReactNode;
}) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  if (!open) return null;

  const ready = !confirmWord || typed.trim() === confirmWord.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-5 backdrop-blur-sm">
      <div className="w-full max-w-md border border-bone/20 bg-ink p-7 text-bone">
        <h2 className="font-display text-2xl uppercase">{title}</h2>
        <div className="mt-3 text-[13px] leading-relaxed opacity-75">{intro}</div>

        {children}

        {confirmWord && (
          <>
            <label className="mt-5 block text-[11px] uppercase tracking-[0.18em] opacity-60">
              Type <span className="text-bone">{confirmWord}</span> to confirm
            </label>
            <input
              className="input mt-2"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-label="Confirmation"
            />
          </>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border border-bone/30 px-4 py-3 text-[11px] uppercase tracking-[0.2em] opacity-70 hover:opacity-100"
          >
            Keep it
          </button>
          <button
            onClick={onConfirm}
            disabled={busy || !ready}
            className="flex-1 bg-ember px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-bone hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}