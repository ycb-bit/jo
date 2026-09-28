import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { AnnouncementBar } from "@/components/announcement-bar";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { SmoothScroll } from "@/components/smooth-scroll";
import { Toaster } from "@/components/toaster";
import { AuthProvider } from "@/lib/auth-context";

const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo" });

export const metadata: Metadata = {
  title: "JO — Cloth, made to be worn out",
  description:
    "JO is an independent cloth maker. Small-batch garments cut, sewn and finished by hand. Bank transfer checkout, verified by humans.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable} suppressHydrationWarning>
      <body className="grain min-h-screen antialiased" suppressHydrationWarning>
        <AuthProvider>
          <SmoothScroll>
            <AnnouncementBar />
            <Nav />
            <main>{children}</main>
            <Footer />
          </SmoothScroll>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
