"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * The centerpiece: a square of woven fabric floating mid-air, tilted diagonal,
 * rippling on its own — a lab-display hologram of cloth. Spins as you scroll.
 * No mouse needed. Real 3D lighting + procedural weave micro-texture
 * (warp/weft threads, gap shadows, slubs, ember accent threads, twill sheen).
 */

function makeWeaveTexture(): THREE.CanvasTexture {
  const S = 256;
  const cv = document.createElement("canvas");
  cv.width = S;
  cv.height = S;
  const c = cv.getContext("2d")!;
  // rich terracotta dye — saturated rust, never grey
  const grad = c.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0, "#D96F35");
  grad.addColorStop(0.5, "#BC4E20");
  grad.addColorStop(1, "#8F3410");
  c.fillStyle = grad;
  c.fillRect(0, 0, S, S);
  const TH = 5; // thread pitch
  for (let x = 0; x < S; x += TH) {
    const l = Math.sin(x * 12.9898) * 14;
    c.fillStyle = `rgb(${222 + l | 0},${102 + l * 0.6 | 0},${46 + l * 0.4 | 0})`; // warp: saturated rust
    c.fillRect(x, 0, TH - 1, S);
    c.fillStyle = "rgba(74,22,6,0.42)"; // thread gap shadow — deep umber
    c.fillRect(x + TH - 1, 0, 1, S);
  }
  for (let y = 0; y < S; y += TH) {
    c.fillStyle = "rgba(70,20,6,0.20)";
    c.fillRect(0, y, S, 1);
    c.fillStyle = "rgba(255,208,150,0.34)"; // weft highlight — peach light
    c.fillRect(0, y + 1, S, 1);
  }
  for (let i = 0; i < 130; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    c.fillStyle = `rgba(${(120 + Math.random() * 50) | 0},${(38 + Math.random() * 26) | 0},${(10 + Math.random() * 14) | 0},0.14)`;
    c.fillRect(x, y, 2 + Math.random() * 4, 1);
  }
  c.fillStyle = "rgba(255,180,120,0.4)";
  c.fillRect(0, 96, S, 1.6);
  c.fillStyle = "rgba(255,180,120,0.22)";
  c.fillRect(0, 208, S, 1.3);
  c.strokeStyle = "rgba(255,238,214,0.06)";
  c.lineWidth = 2;
  for (let i = -S; i < S; i += 12) {
    c.beginPath();
    c.moveTo(i, 0);
    c.lineTo(i + S, S);
    c.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.anisotropy = 4;
  return tex;
}

function ClothPanel() {
  const mesh = useRef<THREE.Mesh>(null);
  const wire = useRef<THREE.Mesh>(null);
  const viewport = useThree((s) => s.viewport);
  const geo = useMemo(() => new THREE.PlaneGeometry(3.1, 3.1, 76, 76), []);
  const tex = useMemo(() => makeWeaveTexture(), []);
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array), [geo]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pos = geo.attributes.position;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const y = base[i * 3 + 1];
      arr[i * 3 + 2] =
        Math.sin(x * 1.9 + t * 0.8) * 0.16 +
        Math.sin(y * 2.3 - t * 0.62) * 0.12 +
        Math.sin((x + y) * 3.0 + t * 1.1) * 0.05 +
        Math.sin(x * 6.5 - y * 4.5 + t * 1.9) * 0.02;
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    // idle float + drift, PLUS scroll-linked spin (reads live scrollY — no re-renders)
    const scroll =
      typeof window !== "undefined"
        ? Math.min(1, Math.max(0, window.scrollY / Math.max(1, window.innerHeight)))
        : 0;
    const rz = 0.5 + Math.sin(t * 0.11) * 0.05 - scroll * 0.85;
    const rx = -0.16 + Math.sin(t * 0.17) * 0.06 + scroll * 0.35;
    const ry = 0.34 + Math.sin(t * 0.13) * 0.07 + scroll * 1.1;
    const fy = Math.sin(t * 0.45) * 0.08 - scroll * 0.4;
    if (mesh.current) {
      mesh.current.rotation.set(rx, ry, rz);
      mesh.current.position.y = fy;
    }
    if (wire.current) {
      wire.current.rotation.set(rx, ry, rz);
      wire.current.position.y = fy;
    }
  });

  // big presence, but still fits with air on any screen
  const fit = Math.max(0.62, Math.min(1.05, viewport.width / 3.1));

  return (
    <group scale={fit}>
      <mesh ref={mesh} geometry={geo}>
        {/* semi-transparent so the type behind reads through the weave */}
        <meshStandardMaterial
          map={tex}
          side={THREE.DoubleSide}
          roughness={0.85}
          metalness={0.02}
          transparent
          opacity={0.92}
        />
      </mesh>
      {/* faint hologram wireframe — the lab-display read */}
      <mesh ref={wire} geometry={geo} scale={1.004}>
        <meshBasicMaterial color="#141311" wireframe transparent opacity={0.05} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function HeroCloth() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5.6], fov: 42 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
      frameloop={typeof document !== "undefined" && document.hidden ? "never" : "always"}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 4, 5]} intensity={1.7} color="#FFE8D2" />
      <directionalLight position={[-4, -2, 3]} intensity={0.9} color="#C8501E" />
      <ClothPanel />
    </Canvas>
  );
}
