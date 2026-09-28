"use client";

import { useMemo } from "react";

function mulberry(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic "fabric swatch" art derived from the product slug.
 * Reads like an editorial textile study, not a stock photo.
 */
export function ProductArt({
  seed,
  label,
  variant = 0,
  className,
}: {
  seed: string;
  label?: string;
  variant?: number;
  className?: string;
}) {
  const art = useMemo(() => {
    const rnd = mulberry(hashStr(seed) + variant * 7919);
    const palettes: [string, string, string][] = [
      ["#E3DED3", "#C8501E", "#141311"],
      ["#D8D2C4", "#8F3410", "#2A2824"],
      ["#EFE7D8", "#B4551F", "#1A1917"],
      ["#DCD6C9", "#A03E14", "#232019"],
      ["#E8E2D4", "#C8501E", "#3B3830"],
    ];
    const [bg, accent, ink] = palettes[Math.floor(rnd() * palettes.length)];
    const weft = 26 + Math.floor(rnd() * 22);
    const skew = (rnd() - 0.5) * 10;
    const drift = (rnd() - 0.5) * 26;
    const arcs = Array.from({ length: 3 + Math.floor(rnd() * 3) }, () => ({
      cx: 15 + rnd() * 70,
      cy: 15 + rnd() * 70,
      r: 12 + rnd() * 38,
      w: 0.5 + rnd() * 1.6,
      o: 0.25 + rnd() * 0.55,
    }));
    const lines = Array.from({ length: weft }, (_, i) => ({
      y: (i / weft) * 110 - 5,
      x1: -5 + (i % 3) * drift * 0.4,
      x2: 105 - ((i + 1) % 3) * drift * 0.4,
      w: 0.35 + rnd() * 0.9,
      o: 0.14 + rnd() * 0.4,
      accent: rnd() > 0.86,
    }));
    return { bg, accent, ink, skew, lines, arcs };
  }, [seed, variant]);

  return (
    <div className={`relative overflow-hidden ${className || ""}`} aria-label={label || "Product artwork"}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="card-img h-full w-full"
      >
        <rect width="100" height="100" fill={art.bg} />
        <g transform={`rotate(${art.skew} 50 50)`}>
          {art.lines.map((l, i) => (
            <line
              key={i}
              x1={l.x1}
              y1={l.y}
              x2={l.x2}
              y2={l.y + 4}
              stroke={l.accent ? art.accent : art.ink}
              strokeWidth={l.w}
              opacity={l.o}
            />
          ))}
        </g>
        {art.arcs.map((a, i) => (
          <circle
            key={i}
            cx={a.cx}
            cy={a.cy}
            r={a.r}
            fill="none"
            stroke={i % 2 ? art.accent : art.ink}
            strokeWidth={a.w}
            opacity={a.o * 0.7}
          />
        ))}
        <rect width="100" height="100" fill="url(#vig)" opacity="0.5" />
        <defs>
          <radialGradient id="vig" cx="50%" cy="42%" r="75%">
            <stop offset="60%" stopColor="transparent" />
            <stop offset="100%" stopColor={art.ink} stopOpacity="0.18" />
          </radialGradient>
        </defs>
      </svg>
      {label && (
        <span className="absolute bottom-3 left-3 bg-ink/85 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-bone">
          {label}
        </span>
      )}
    </div>
  );
}
