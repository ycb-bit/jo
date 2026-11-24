"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Back affordance for every sub page.
 *
 * `router.back()` is the right move when the visitor arrived from inside the
 * storefront. A page opened in a new tab has no history to go back to, so that
 * case falls back to the shop rather than dropping them out of the site.
 */
export function BackButton({ className }: { className?: string }) {
  const router = useRouter();
  const { t } = useT();

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/shop");
  };

  return (
    <button
      type="button"
      onClick={goBack}
      className={cn(
        "u-link mb-7 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] opacity-60 transition-opacity hover:opacity-100",
        className
      )}
    >
      ← {t("common.back")}
    </button>
  );
}
