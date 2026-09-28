import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  eslint: { ignoreDuringBuilds: true },
  images: {
    // Firebase Storage download URLs are signed and long-lived per object, so
    // we allow that host through the optimizer. Keeping optimization on
    // (rather than `unoptimized: true`) is what gives us lazy loading,
    // responsive sizing and no layout shift on real product photography.
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
    // Legacy inline data-URI swatches bypass the optimizer in ProductImage;
    // this keeps next/image from rejecting them if one is ever passed through.
    dangerouslyAllowSVG: false,
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
