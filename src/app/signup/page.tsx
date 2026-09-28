"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/store";
import { authErrorMessage } from "@/lib/auth-messages";
import { ProductArt } from "@/components/product-art";

export default function SignupPage() {
  const { signUp, signInGoogle } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password needs at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      await signUp(email, password, name);
      setOk(true);
      setTimeout(() => router.push("/account"), 550);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-[80svh] max-w-[1440px] items-center gap-16 px-5 py-16 md:grid-cols-2 md:px-10">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="mx-auto w-full max-w-md">
        <h1 className="font-display text-5xl uppercase">
          Join the list<span className="text-ember">.</span>
        </h1>
        <p className="mt-3 text-[14px] opacity-60">
          One account for orders, saved pieces and early access to drops.
        </p>

        <form onSubmit={submit} className="mt-10 space-y-6">
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="border border-ember/40 bg-ember/10 px-4 py-3 text-[12px] tracking-wide text-ember"
              role="alert"
            >
              {error}
            </motion.p>
          )}
          <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          <input className="input" type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <input className="input" type="password" required placeholder="Password (6+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <button
            disabled={busy || ok}
            className="w-full border border-ink bg-ink py-4 text-[12px] uppercase tracking-[0.22em] text-bone transition-colors hover:border-ember hover:bg-ember disabled:opacity-50"
          >
            {ok ? "Account created ✓" : busy ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-right text-[12px] opacity-60">
          <Link href="/login" className="u-link">Already have one? Sign in →</Link>
        </p>

        <div className="my-8 flex items-center gap-4 text-[10px] uppercase tracking-[0.24em] opacity-40">
          <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
        </div>

        <button
          onClick={() => signInGoogle().catch((e) => setError(authErrorMessage(e)))}
          className="w-full border border-line py-3.5 text-[12px] uppercase tracking-[0.18em] transition-colors hover:border-ink"
        >
          Continue with Google
        </button>
      </motion.div>

      <div className="relative hidden h-[560px] overflow-hidden md:block">
        <ProductArt seed="auth-panel-2" className="h-full w-full" />
        <p className="absolute bottom-8 left-8 font-display text-4xl uppercase text-bone mix-blend-difference">
          Cut once,<br />worn for years.
        </p>
      </div>
    </div>
  );
}
