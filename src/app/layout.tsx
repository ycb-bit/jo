import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { AnnouncementBar } from "@/components/announcement-bar";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { SmoothScroll } from "@/components/smooth-scroll";
import { Toaster } from "@/components/toaster";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { AuthProvider } from "@/lib/auth-context";

const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo" });

/**
 * Canonical site origin. Set NEXT_PUBLIC_SITE_URL in the environment
 * (Settings → Environment) to the live domain, e.g. https://jostudio.com
 */
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://jostudio.example").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "JO — Cloth, made to be worn out",
    template: "%s · JO",
  },
  description:
    "JO is an independent cloth maker. Small-batch garments cut, sewn and finished by hand. Bank transfer checkout, verified by humans.",
  keywords: [
    "handmade clothing",
    "small batch garments",
    "workwear",
    "overtime",
    "independent clothing maker",
    "Ethiopia",
  ],
  authors: [{ name: "JO Studio" }],
  creator: "JO Studio",
  openGraph: {
    type: "website",
    siteName: "JO",
    title: "JO — Cloth, made to be worn out",
    description:
      "Small-batch garments cut, sewn and finished by hand. Bank transfer checkout, verified by humans.",
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "JO — Cloth, made to be worn out",
    description:
      "Small-batch garments cut, sewn and finished by hand. Bank transfer checkout, verified by humans.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  alternates: { canonical: "/" },
  category: "shopping",
};

export const viewport: Viewport = {
  themeColor: "#0d0d0d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable} suppressHydrationWarning>
      <body className="grain min-h-screen antialiased" suppressHydrationWarning>
        <AuthProvider>
          <AnalyticsTracker />
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
