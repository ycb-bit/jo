/**
 * JO — Design tokens
 * Bone / ink editorial palette with a single ember accent.
 */
export const COLORS = {
  bone: "#EFEBE3",
  boneDim: "#E3DED3",
  ink: "#141311",
  inkSoft: "#2A2824",
  ember: "#C8501E",
  emberDeep: "#8F3410",
  line: "rgba(20,19,17,0.14)",
} as const;

/** Store currency. Every price in the catalogue and every order is ETB. */
export const CURRENCY = "ETB";

/** Free-shipping threshold in ETB, shared so the banner and PDP never disagree. */
export const FREE_SHIPPING_THRESHOLD = 15000;
