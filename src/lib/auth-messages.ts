import { translate, type Lang } from "./i18n";

/**
 * Firebase auth error codes → human sentences, in the storefront language.
 * `lang` defaults to English so non-UI callers keep working unchanged.
 */
export function authErrorMessage(err: unknown, lang: Lang = "en"): string {
  const t = (key: string) => translate(lang, key);
  const code =
    typeof err === "object" && err && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found"))
    return t("auth.errWrong");
  if (code.includes("email-already-in-use")) return t("auth.errInUse");
  if (code.includes("weak-password")) return t("auth.errWeak");
  if (code.includes("too-many-requests")) return t("auth.errTooMany");
  if (code.includes("invalid-email")) return t("auth.errEmail");
  if (code.includes("network-request-failed")) return t("auth.errNetwork");
  if (code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request"))
    return t("auth.errPopup");
  if (code.includes("operation-not-allowed")) return t("auth.errMethod");
  const raw = err instanceof Error ? err.message.replace("Firebase: ", "") : "";
  return raw || t("auth.errGeneric");
}
