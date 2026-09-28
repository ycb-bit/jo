"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { auth, db, googleProvider } from "./firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import type { AppUser } from "./types";

type AuthCtx = {
  fbUser: User | null;
  profile: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  reset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>(null as never);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [fbUser, setFbUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFbUser(u);
      if (u) {
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          const isAdminEmail = (u.email || "").toLowerCase() === (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").toLowerCase();
          await setDoc(ref, {
            uid: u.uid,
            email: u.email || "",
            displayName: u.displayName || u.email?.split("@")[0] || "Customer",
            role: isAdminEmail ? "admin" : "customer",
            createdAt: serverTimestamp(),
            addresses: [],
            wishlist: [],
          });
          const after = await getDoc(ref);
          setProfile({ ...(after.data() as AppUser), uid: u.uid });
        } else {
          setProfile({ ...(snap.data() as AppUser), uid: u.uid });
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const value: AuthCtx = {
    fbUser,
    profile,
    loading,
    isAdmin: profile?.role === "admin",
    signIn: async (email, password) => {
      await signInWithEmailAndPassword(auth, email, password);
    },
    signUp: async (email, password, name) => {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(
        doc(db, "users", cred.user.uid),
        {
          uid: cred.user.uid,
          email,
          displayName: name || email.split("@")[0],
          role: "customer",
          createdAt: serverTimestamp(),
          addresses: [],
          wishlist: [],
        },
        { merge: true }
      );
    },
    signInGoogle: async () => {
      await signInWithPopup(auth, googleProvider);
    },
    reset: async (email) => {
      await sendPasswordResetEmail(auth, email);
    },
    signOut: async () => {
      await fbSignOut(auth);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
