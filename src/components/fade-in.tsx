"use client";

import { motion } from "framer-motion";

/**
 * Entrance animation for above-the-fold content that a visitor must be able
 * to see and act on immediately.
 *
 * framer-motion drives its `animate` phase from requestAnimationFrame, and it
 * paints the `initial` styles first. For `opacity: 0` that means the content
 * is invisible until the first animation frame lands. If that frame never
 * arrives — the page mounted in a background tab (browsers pause rAF there), a
 * JS error interrupted hydration, or a stalled frame — the content stays
 * permanently blank with no error and no way forward.
 *
 * That is an acceptable risk for decoration and an unacceptable one for a
 * sign-in form, a checkout step, or an add-to-cart button. Those use
 * `<FadeIn>` (or `<FadeIn animate={false}>`) instead: the motion still plays
 * where it is safe, but the content is never gated behind a frame we do not
 * control.
 *
 * Decorative scroll-reveals (home hero, lookbook, nav dropdown) should keep
 * using `motion.*` directly — those are fine to be invisible until scrolled to.
 */
export function FadeIn({
  children,
  className,
  /** Set false for the very first paint of a page. */
  animate = true,
  y = 20,
  duration = 0.5,
}: {
  children: React.ReactNode;
  className?: string;
  animate?: boolean;
  y?: number;
  duration?: number;
}) {
  if (!animate) return <div className={className}>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
