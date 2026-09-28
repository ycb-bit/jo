/** Firebase auth error codes → human sentences. */
export function authErrorMessage(err: unknown): string {
  const code =
    typeof err === "object" && err && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found"))
    return "Wrong email or password. Try again.";
  if (code.includes("email-already-in-use")) return "That email already has an account — sign in instead.";
  if (code.includes("weak-password")) return "Password needs at least 6 characters.";
  if (code.includes("too-many-requests")) return "Too many attempts. Wait a minute and try again.";
  if (code.includes("invalid-email")) return "That email doesn't look right.";
  if (code.includes("network-request-failed")) return "Connection hiccup — check your internet and try again.";
  if (code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request"))
    return "Google sign-in was closed before finishing.";
  if (code.includes("operation-not-allowed")) return "That sign-in method isn't enabled yet.";
  const raw = err instanceof Error ? err.message.replace("Firebase: ", "") : "";
  return raw || "Something went wrong — try again.";
}
