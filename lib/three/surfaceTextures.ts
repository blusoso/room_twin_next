// lib/three/surfaceTextures.ts
import * as THREE from "three";
import { FLOOR_PALETTES } from "@/lib/data/constants";

export function makeFloorCanvas(styleId: string, size: number): HTMLCanvasElement {
  const S = size;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  const p = FLOOR_PALETTES[styleId] || FLOOR_PALETTES.wood;

  if (styleId === "wood" || styleId === "walnut") {
    ctx.fillStyle = p.base;
    ctx.fillRect(0, 0, S, S);
    const planks = 8;
    const ph = S / planks;
    for (let i = 0; i < planks; i++) {
      ctx.strokeStyle = p.line;
      ctx.lineWidth = S / 256;
      ctx.beginPath();
      ctx.moveTo(0, i * ph);
      ctx.lineTo(S, i * ph);
      ctx.stroke();
      for (let j = 0; j < 3; j++) {
        ctx.beginPath();
        const x = (j * (S / 3) + (i % 2) * (S / 6)) % S;
        ctx.moveTo(x, i * ph);
        ctx.lineTo(x, (i + 1) * ph);
        ctx.strokeStyle = p.fine;
        ctx.lineWidth = S / 340;
        ctx.stroke();
      }
    }
  } else if (styleId === "tile") {
    ctx.fillStyle = p.base;
    ctx.fillRect(0, 0, S, S);
    const n = 4;
    const ts = S / n;
    ctx.strokeStyle = p.line;
    ctx.lineWidth = S / 128;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * ts);
      ctx.lineTo(S, i * ts);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i * ts, 0);
      ctx.lineTo(i * ts, S);
      ctx.stroke();
    }
    ctx.strokeStyle = p.fine;
    ctx.lineWidth = S / 512;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        ctx.strokeRect(
          i * ts + S / 64,
          j * ts + S / 64,
          ts - S / 32,
          ts - S / 32,
        );
  } else if (styleId === "marble") {
    ctx.fillStyle = p.base;
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 22; i++) {
      ctx.strokeStyle = `rgba(160,150,130,${0.12 + Math.random() * 0.22})`;
      ctx.lineWidth = (0.6 + Math.random() * 1.6) * (S / 512);
      ctx.beginPath();
      let x = Math.random() * S;
      let y = Math.random() * S;
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (Math.random() - 0.5) * S * 0.24;
        y += (Math.random() - 0.5) * S * 0.24;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (styleId === "concrete") {
    ctx.fillStyle = p.base;
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 6000; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
      ctx.fillRect(Math.random() * S, Math.random() * S, 2, 2);
    }
    for (let i = 0; i < 3000; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`;
      ctx.fillRect(Math.random() * S, Math.random() * S, 2, 2);
    }
  } else if (styleId === "carpet") {
    ctx.fillStyle = p.base;
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 20000; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
      ctx.fillRect(Math.random() * S, Math.random() * S, 1, 1);
    }
    for (let i = 0; i < 20000; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.1})`;
      ctx.fillRect(Math.random() * S, Math.random() * S, 1, 1);
    }
  }
  return c;
}

export function makeFloorTexture(
  styleId: string,
  roomW: number,
  roomD: number,
  anisotropy = 1,
): THREE.CanvasTexture {
  const c = makeFloorCanvas(styleId, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(roomW / 1.4, roomD / 1.4);
  tex.anisotropy = anisotropy;
  return tex;
}