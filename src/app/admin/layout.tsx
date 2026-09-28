"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/orders", label: "Orders & verification", exact: false },
  { href: "/admin/products", label: "Products", exact: false },
  { href: "/admin/lookbook", label: "Lookbook", exact: false },
  { href: "/admin/settings", label: "Store settings", exact: false },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { fbUser, profile, loading, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !fbUser) router.replace("/login?next=/admin");
    if (!loading && fbUser && !isAdmin) router.replace("/account");
  }, [loading, fbUser, isAdmin, router]);

  if (loading || !profile) {
    return <div className="min-h-screen bg-ink p-10"><div className="skeleton h-40 max-w-md" /></div>;
  }
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-ink text-bone">
      <div className="mx-auto flex max-w-[1500px] flex-col md:flex-row">
        <aside className="shrink-0 border-b border-bone/10 md:min-h-screen md:w-64 md:border-b-0 md:border-r">
          <div className="flex items-center justify-between p-6 md:block">
            <Link href="/" className="font-display text-2xl font-black uppercase">
              JO<span className="text-ember">.</span> <span className="text-[11px] tracking-[0.2em] opacity-50">Studio</span>
            </Link>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-4 pb-4 md:flex-col md:px-4">
            {NAV.map((n) => {
              const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "whitespace-nowrap px-4 py-2.5 text-[12px] uppercase tracking-[0.16em] transition-colors",
                    active ? "bg-bone text-ink" : "opacity-60 hover:bg-bone/10 hover:opacity-100"
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
            <Link href="/" className="mt-4 px-4 py-2.5 text-[12px] uppercase tracking-[0.16em] opacity-40 hover:opacity-80">
              ← Storefront
            </Link>
          </nav>
        </aside>
        <main className="min-w-0 flex-1 p-5 md:p-10">{children}</main>
      </div>
    </div>
  );
}
