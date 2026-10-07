"use client";

import { ProductArt } from "./product-art";

/**
 * Thumbnail for a cart/order line.
 *
 * Cart lines carry the product's first photo (`image`), but older carts
 * (persisted before photos were attached) and image-less products have
 * nothing — for those, fall back to the deterministic fabric swatch keyed
 * on the slug, so the thumbnail is never an empty box.
 */
export function CartThumb({
  image,
  seed,
  className,
}: {
  image?: string;
  seed: string;
  className?: string;
}) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- data-URI product photos
      <img src={image} alt="" className={className} />
    );
  }
  return <ProductArt seed={seed} className={className} />;
}