"use client";

import Image from "next/image";
import { ProductArt } from "./product-art";
import { cn } from "@/lib/utils";

/**
 * Product imagery, in one place so cards and the detail page always agree.
 *
 * Real photos (http URLs) go through next/image: lazy loading, responsive
 * sizing, AVIF/WebP, no layout shift.
 *
 * Inline data-URIs bypass the optimizer, because next/image cannot process
 * them — they render as a plain <img> with the same box so layout is stable.
 *
 * When there is no photo at all we fall back to the deterministic
 * "fabric swatch" art, which keeps every card filled instead of empty.
 */
export function ProductImage({
  src,
  seed,
  variant = 0,
  alt,
  className,
  sizes,
  priority,
  label,
}: {
  src?: string;
  seed: string;
  variant?: number;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  label?: string;
}) {
  if (src && !src.startsWith("data:")) {
    return (
      <Image
        src={src}
        alt={alt}
        className={className}
        sizes={sizes}
        priority={priority}
        fill={className?.includes("absolute")}
      />
    );
  }

  if (src && src.startsWith("data:")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className} />;
  }

  return <ProductArt seed={seed} variant={variant} className={className} label={label} />;
}

/** Convenience: pick image N from a product, falling back to swatch art. */
export function imageAt(images: string[] | undefined, index: number): string | undefined {
  if (!images || images.length === 0) return undefined;
  return images[index] || images[0];
}

export const cardImageSizes =
  "(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 45vw";
