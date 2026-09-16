// lib/three/builders.ts
import * as THREE from "three";

// ===== HELPERS =====
function mesh(geo: THREE.BufferGeometry, color: number, opts: any = {}): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.75,
    metalness: opts.metalness ?? 0.05,
  });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function box(w: number, h: number, d: number, color: number, opts?: any) {
  return mesh(new THREE.BoxGeometry(w, h, d), color, opts);
}

function cyl(rt: number, rb: number, h: number, color: number, seg = 20, opts?: any) {
  return mesh(new THREE.CylinderGeometry(rt, rb, h, seg), color, opts);
}

function P(opts: any, key: string, fb: any) {
  return opts && opts[key] !== undefined ? opts[key] : fb;
}

function TS(opts: any, key: string, fb: any) {
  return opts && opts.themeStyle && opts.themeStyle[key] !== undefined
    ? opts.themeStyle[key]
    : fb;
}

function contactShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, "rgba(20,15,10,0.35)");
  g.addColorStop(1, "rgba(20,15,10,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

let _shadowTex: THREE.CanvasTexture | null = null;
function getShadowTex() {
  if (!_shadowTex) _shadowTex = contactShadowTexture();
  return _shadowTex;
}

export function addContactShadow(group: THREE.Group, w: number, d: number) {
  const geo = new THREE.PlaneGeometry(w * 1.35, d * 1.35);
  const mat = new THREE.MeshBasicMaterial({
    map: getShadowTex(),
    transparent: true,
    depthWrite: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.002;
  group.add(m);
}

// ===== BUILDERS =====

export function buildDoor(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const h = dims.h / 100;
  const d = dims.d / 100;
  const fc = P(opts, "frameColor", 0xf7f3ea);
  const tm = new THREE.MeshStandardMaterial({ color: fc, roughness: 0.7 });
  const tr = 0.055;

  const lin = new THREE.Mesh(new THREE.BoxGeometry(w + tr * 2, tr, d), tm);
  lin.position.set(0, h / 2 - tr / 2, 0);
  g.add(lin);

  const jl = new THREE.Mesh(new THREE.BoxGeometry(tr, h, d), tm);
  jl.position.set(-(w / 2 + tr / 2), 0, 0);
  g.add(jl);

  const jr = jl.clone();
  jr.position.x = w / 2 + tr / 2;
  g.add(jr);

  const th = new THREE.Mesh(
    new THREE.BoxGeometry(w + tr * 2, 0.02, d * 1.6),
    new THREE.MeshStandardMaterial({ color: 0xb9a88f, roughness: 0.6 }),
  );
  th.position.set(0, -h / 2 + 0.01, 0);
  g.add(th);

  const lh = h - tr - 0.02;
  const dl = box(w - 0.04, lh, 0.045, color);
  dl.position.set(0, -h / 2 + 0.02 + lh / 2, d / 2 - 0.02);
  g.add(dl);

  return g;
}

export function buildWindow(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const h = dims.h / 100;
  const d = dims.d / 100;
  const fc = P(opts, "frameColor", 0xf7f3ea);
  const gc = P(opts, "glassColor", 0xcfe0e8);
  const hc = !!P(opts, "hasCurtains", false);
  const cc = P(opts, "curtainColor", 0xd8b7ae);

  const gm = new THREE.MeshStandardMaterial({
    color: gc,
    roughness: 0.1,
    metalness: 0.1,
    emissive: gc,
    emissiveIntensity: 0.15,
    side: THREE.DoubleSide,
  });
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), gm);
  gl.position.z = -d / 2 + 0.005;
  g.add(gl);

  const fm = new THREE.MeshStandardMaterial({ color: fc, roughness: 0.7 });
  const fo = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, h + 0.12, d), fm);
  g.add(fo);

  const mv = new THREE.Mesh(new THREE.BoxGeometry(0.03, h, d + 0.01), fm);
  g.add(mv);

  const mh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d + 0.01), fm);
  g.add(mh);

  if (hc) {
    const rm = new THREE.MeshStandardMaterial({
      color: 0x8a6a4f,
      roughness: 0.5,
      metalness: 0.3,
    });
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, w + 0.3, 10),
      rm,
    );
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, h / 2 + 0.1, d / 2 + 0.06);
    g.add(rod);

    const cm = new THREE.MeshStandardMaterial({
      color: cc,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
    [-1, 1].forEach((sx) => {
      const pw = w * 0.3;
      const ph = h + 0.2;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), cm);
      p.position.set(sx * (w / 2 - pw / 2 + 0.02), 0.05, d / 2 + 0.05);
      g.add(p);
    });
  }
  return g;
}

export function buildBed(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const d = dims.d / 100;
  const h = dims.h / 100;
  const head = TS(opts, "bedHead", "box");
  const pr = TS(opts, "bedPlatform", 0.38);
  const mr = TS(opts, "mattressH", 0.18);
  const bc = P(opts, "baseColor", 0xede3cf);
  const mc = P(opts, "mattressColor", 0xfbf8f2);
  const pc = P(opts, "pillowColor", 0xffffff);
  const bh = h * pr;
  const mh = h * mr;

  const base = box(w, bh, d, bc);
  base.position.y = bh / 2;
  g.add(base);

  const mat = box(w * 0.97, mh, d * 0.95, mc, { roughness: 0.9 });
  mat.position.y = bh + mh / 2;
  g.add(mat);

  const p1 = box(w * 0.42, h * 0.08, d * 0.22, pc, { roughness: 0.95 });
  p1.position.set(-w * 0.22, bh + mh + h * 0.04, -d * 0.32);
  g.add(p1);

  const p2 = p1.clone();
  p2.position.x = w * 0.22;
  g.add(p2);

  if (head === "slats") {
    const hbH = h * 0.55;
    for (let i = 0; i < 7; i++) {
      const s = box(0.04, hbH, 0.04, color);
      s.position.set(
        -w / 2 + 0.06 + (i * (w - 0.12)) / 6,
        bh + hbH / 2,
        -d / 2 + d * 0.02,
      );
      g.add(s);
    }
    const t = box(w, 0.05, 0.05, color);
    t.position.set(0, bh + hbH, -d / 2 + d * 0.02);
    g.add(t);
    const b = box(w, 0.05, 0.05, color);
    b.position.set(0, bh + 0.025, -d / 2 + d * 0.02);
    g.add(b);
  } else if (head === "low-panel") {
    const hb = box(w * 0.98, h * 0.3, 0.04, color);
    hb.position.set(0, bh + h * 0.15, -d / 2 + 0.02);
    g.add(hb);
  } else if (head === "rattan") {
    const hbH = h * 0.55;
    const f = box(w, hbH, 0.05, color);
    f.position.set(0, bh + hbH / 2, -d / 2 + 0.025);
    g.add(f);
    const inner = box(
      w * 0.88,
      hbH * 0.85,
      0.015,
      P(opts, "accentColor", 0x8a6a4f),
      { roughness: 0.95 },
    );
    inner.position.set(0, bh + hbH / 2, -d / 2 + 0.055);
    g.add(inner);
    for (let i = 0; i < 5; i++) {
      const wv = box(w * 0.86, 0.012, 0.018, P(opts, "neutralColor", 0xe8dcc4));
      wv.position.set(0, bh + hbH * (0.15 + i * 0.18), -d / 2 + 0.065);
      g.add(wv);
    }
  } else if (head === "upholstered") {
    const hb = box(w, h * 0.55, 0.1, color, { roughness: 0.95 });
    hb.position.set(0, bh + h * 0.275, -d / 2 + 0.05);
    g.add(hb);
    for (let i = 0; i < 4; i++) {
      const btn = cyl(0.015, 0.015, 0.02, P(opts, "darkColor", 0x3a3138), 10);
      btn.rotation.x = Math.PI / 2;
      btn.position.set(-w * 0.3 + i * (w * 0.2), bh + h * 0.28, -d / 2 + 0.115);
      g.add(btn);
    }
  } else {
    const hb = box(w, h * 0.55, d * 0.06, color);
    hb.position.set(0, (h * 0.55) / 2 + bh, -d / 2 + d * 0.03);
    g.add(hb);
  }
  addContactShadow(g, w, d);
  return g;
}

export function buildArmchair(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const d = dims.d / 100;
  const h = dims.h / 100;
  const ct = TS(opts, "chairType", "box");
  const lc = P(opts, "legColor", 0x3a3138);

  if (ct === "low-block") {
    const sh = h * 0.32;
    const seat = box(w, sh, d, color);
    seat.position.y = sh / 2;
    g.add(seat);
    const back = box(w, h * 0.42, d * 0.2, color);
    back.position.set(0, sh + h * 0.21, -d / 2 + d * 0.1);
    g.add(back);
    const al = box(w * 0.12, h * 0.16, d * 0.7, color);
    al.position.set(-w / 2 + w * 0.06, sh + h * 0.08, 0.02);
    g.add(al);
    const ar = al.clone();
    ar.position.x = w / 2 - w * 0.06;
    g.add(ar);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const leg = cyl(0.015, 0.015, 0.08, lc, 8);
      leg.position.set(sx * (w / 2 - 0.05), 0.04, sz * (d / 2 - 0.06));
      g.add(leg);
    });
  } else if (ct === "wide-arms") {
    const seat = box(w, h * 0.3, d * 0.88, color);
    seat.position.y = h * 0.32;
    g.add(seat);
    const back = box(w * 0.98, h * 0.68, d * 0.16, color);
    back.position.set(0, h * 0.68, -d / 2 + d * 0.08);
    g.add(back);
    const al = box(w * 0.16, h * 0.5, d * 0.9, color);
    al.position.set(-w / 2 + w * 0.08, h * 0.4, 0);
    g.add(al);
    const ar = al.clone();
    ar.position.x = w / 2 - w * 0.08;
    g.add(ar);
    for (let i = 0; i < 3; i++) {
      const s = box(w * 0.88, 0.02, 0.02, P(opts, "darkColor", 0x3a3138));
      s.position.set(0, h * 0.36 + i * 0.05, d / 2 - 0.01);
      g.add(s);
    }
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const leg = cyl(0.03, 0.03, h * 0.1, P(opts, "darkColor", 0x3a3138), 12);
      leg.position.set(sx * (w / 2 - 0.06), h * 0.05, sz * (d / 2 - 0.07));
      g.add(leg);
    });
  } else if (ct === "slipcover") {
    const sh = h * 0.35;
    const seat = box(w, sh, d, color, { roughness: 0.95 });
    seat.position.y = sh / 2;
    g.add(seat);
    const back = box(w, h * 0.55, d * 0.22, color, { roughness: 0.95 });
    back.position.set(0, sh + h * 0.275, -d / 2 + d * 0.11);
    g.add(back);
    const al = box(w * 0.14, h * 0.3, d * 0.78, color, { roughness: 0.95 });
    al.position.set(-w / 2 + w * 0.07, sh - h * 0.03 + h * 0.15, 0);
    g.add(al);
    const ar = al.clone();
    ar.position.x = w / 2 - w * 0.07;
    g.add(ar);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const leg = cyl(0.02, 0.02, h * 0.15, lc, 8);
      leg.position.set(sx * (w / 2 - 0.05), h * 0.075, sz * (d / 2 - 0.06));
      g.add(leg);
    });
  } else {
    const seat = box(w, h * 0.32, d * 0.85, color);
    seat.position.y = (h * 0.32) / 2 + h * 0.15;
    g.add(seat);
    const back = box(w, h * 0.62, d * 0.16, color);
    back.position.set(0, (h * 0.62) / 2 + h * 0.15 + h * 0.16, -d / 2 + d * 0.08);
    g.add(back);
    const al = box(w * 0.14, h * 0.4, d * 0.85, color);
    al.position.set(-w / 2 + w * 0.07, (h * 0.4) / 2 + h * 0.15, 0);
    g.add(al);
    const ar = al.clone();
    ar.position.x = w / 2 - w * 0.07;
    g.add(ar);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const leg = cyl(0.02, 0.02, h * 0.15, lc, 8);
      leg.position.set(sx * (w / 2 - 0.05), h * 0.075, sz * (d / 2 - 0.06));
      g.add(leg);
    });
  }
  addContactShadow(g, w, d);
  return g;
}

export function buildBench(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const d = dims.d / 100;
  const h = dims.h / 100;
  const lc = P(opts, "legColor", 0x3a3138);

  const seat = box(w, h * 0.22, d, color);
  seat.position.y = h - h * 0.11;
  g.add(seat);

  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const leg = box(0.04, h * 0.8, 0.04, lc);
    leg.position.set(sx * (w / 2 - 0.05), h * 0.4, sz * (d / 2 - 0.05));
    g.add(leg);
  });

  addContactShadow(g, w, d);
  return g;
}

export function buildStool(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const h = dims.h / 100;
  const pc = P(opts, "poleColor", 0xb9a88f);

  const seat = cyl(w / 2, (w / 2) * 0.9, h * 0.2, color, 24);
  seat.position.y = h - h * 0.1;
  g.add(seat);

  const stem = cyl(w * 0.18, w * 0.18, h * 0.8, pc, 16);
  stem.position.y = h * 0.4;
  g.add(stem);

  addContactShadow(g, w, w);
  return g;
}

export function buildNightstand(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const d = dims.d / 100;
  const h = dims.h / 100;
  const st = TS(opts, "shelfType", "box");
  const dc = P(opts, "drawerColor", 0xf2e9dc);
  const kc = P(opts, "knobColor", 0x8a6a4f);

  if (st === "box") {
    const body = box(w, h, d, color);
    body.position.y = h / 2;
    g.add(body);
    const f = box(w * 0.94, h * 0.05, 0.015, dc);
    f.position.set(0, h * 0.85, d / 2 + 0.008);
    g.add(f);
    const k = cyl(0.008, 0.008, 0.03, kc, 10);
    k.rotation.z = Math.PI / 2;
    k.position.set(0, h * 0.85, d / 2 + 0.025);
    g.add(k);
  } else if (st === "open-woven") {
    const f = box(w, h, d, color);
    f.position.y = h / 2;
    g.add(f);
    const inner = box(w * 0.85, h * 0.75, 0.02, P(opts, "accentColor", 0x8a6a4f), {
      roughness: 0.95,
    });
    inner.position.set(0, h * 0.5, d / 2 + 0.012);
    g.add(inner);
    for (let i = 0; i < 4; i++) {
      const b = box(w * 0.9, 0.02, 0.02, dc);
      b.position.set(0, h * 0.2 + i * h * 0.2, d / 2 + 0.025);
      g.add(b);
    }
  } else if (st === "white-box") {
    const body = box(w, h, d, color);
    body.position.y = h / 2;
    g.add(body);
    const s = box(w * 0.94, 0.02, d * 0.7, dc);
    s.position.set(0, h * 0.55, 0.01);
    g.add(s);
    const k = cyl(0.008, 0.008, 0.03, kc, 10);
    k.rotation.z = Math.PI / 2;
    k.position.set(0, h * 0.3, d / 2 + 0.015);
    g.add(k);
  } else {
    const body = box(w, h, d, color);
    body.position.y = h / 2;
    g.add(body);
    const dr = box(w * 0.85, h * 0.28, 0.02, dc);
    dr.position.set(0, h * 0.65, d / 2 + 0.001);
    g.add(dr);
    const k = cyl(0.012, 0.012, 0.03, kc, 10);
    k.rotation.z = Math.PI / 2;
    k.position.set(0, h * 0.65, d / 2 + 0.02);
    g.add(k);
  }
  addContactShadow(g, w, d);
  return g;
}

export function buildWardrobe(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const d = dims.d / 100;
  const h = dims.h / 100;
  const st = TS(opts, "shelfType", "box");
  const gc = P(opts, "doorGapColor", 0x8f7c5c);
  const hc = P(opts, "handleColor", 0xe8dcc4);

  const body = box(w, h, d, color);
  body.position.y = h / 2;
  g.add(body);

  if (st === "open-thin") {
    const c = box(0.03, h * 0.95, d + 0.02, gc);
    c.position.set(0, h / 2, 0);
    g.add(c);
  } else {
    const dg = box(0.015, h * 0.9, d + 0.01, gc);
    dg.position.set(0, h / 2, 0);
    g.add(dg);
  }

  [-1, 1].forEach((sx) => {
    const hd = cyl(0.01, 0.01, h * 0.18, hc, 10);
    hd.position.set(sx * 0.03, h * 0.55, d / 2 + 0.01);
    g.add(hd);
  });

  addContactShadow(g, w, d);
  return g;
}

export function buildDressing(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const d = dims.d / 100;
  const h = dims.h / 100;
  const lc = P(opts, "legColor", color);
  const mfc = P(opts, "mirrorFrameColor", 0xc9a15a);
  const mgc = P(opts, "mirrorGlassColor", 0xcfe0e8);
  const th = h * 0.5;

  const top = box(w, th * 0.12, d, color);
  top.position.y = th;
  g.add(top);

  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const leg = box(0.03, th * 0.95, 0.03, lc);
    leg.position.set(sx * (w / 2 - 0.04), th * 0.475, sz * (d / 2 - 0.04));
    g.add(leg);
  });

  const mf = box(w * 0.5, h * 0.5, 0.02, mfc);
  mf.position.set(0, th + h * 0.25 + 0.01, -d / 2 + 0.03);
  g.add(mf);

  const mg = box(w * 0.42, h * 0.42, 0.005, mgc, {
    metalness: 0.3,
    roughness: 0.05,
  });
  mg.position.set(0, th + h * 0.25 + 0.01, -d / 2 + 0.045);
  g.add(mg);

  addContactShadow(g, w, d);
  return g;
}

export function buildBookshelf(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const d = dims.d / 100;
  const h = dims.h / 100;
  const st = TS(opts, "shelfType", "open-thin");
  const bc = P(opts, "backColor", 0xe8dcc4);

  const sl = box(0.03, h, d, color);
  sl.position.set(-w / 2 + 0.015, h / 2, 0);
  g.add(sl);

  const sr = sl.clone();
  sr.position.x = w / 2 - 0.015;
  g.add(sr);

  if (st === "box") {
    const b = box(w, h, 0.015, bc);
    b.position.set(0, h / 2, -d / 2 + 0.007);
    g.add(b);
  } else if (st === "open-woven") {
    const b = box(w, h, 0.015, P(opts, "accentColor", 0x8a6a4f), {
      roughness: 0.95,
    });
    b.position.set(0, h / 2, -d / 2 + 0.007);
    g.add(b);
    for (let i = 0; i < 6; i++) {
      const s = box(w * 0.9, 0.02, 0.02, bc);
      s.position.set(0, h * (0.1 + i * 0.15), -d / 2 + 0.02);
      g.add(s);
    }
  } else {
    const b = box(w, h, 0.015, bc);
    b.position.set(0, h / 2, -d / 2 + 0.007);
    g.add(b);
  }

  const sc = st === "box" ? 4 : 5;
  for (let i = 0; i <= sc; i++) {
    const s = box(w - 0.03, 0.02, d - 0.02, color);
    s.position.set(0, i * (h / sc), 0);
    g.add(s);
  }

  if (st !== "open-woven") {
    const bkc = [0xb8752e, 0x5f7a63, 0xc48b87, 0x8fafa0];
    for (let i = 0; i < 6; i++) {
      const bw = 0.03 + Math.random() * 0.015;
      const bh = h * 0.22 + Math.random() * h * 0.06;
      const bk = box(bw, bh, d * 0.7, bkc[i % bkc.length]);
      bk.position.set(-w / 2 + 0.06 + i * bw * 1.15, h * 0.5 + bh / 2, 0.01);
      g.add(bk);
    }
  }

  addContactShadow(g, w, d);
  return g;
}

export function buildDesk(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const d = dims.d / 100;
  const h = dims.h / 100;
  const dt = TS(opts, "deskType", "slim");
  const lc = P(opts, "legColor", 0x3a3138);

  if (dt === "chunky") {
    const top = box(w, h * 0.1, d, color);
    top.position.y = h - h * 0.05;
    g.add(top);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const leg = box(0.06, h * 0.95, 0.06, color);
      leg.position.set(sx * (w / 2 - 0.06), h * 0.475, sz * (d / 2 - 0.06));
      g.add(leg);
    });
  } else if (dt === "straight") {
    const top = box(w, h * 0.06, d, color);
    top.position.y = h * 0.94;
    g.add(top);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const leg = box(0.045, h * 0.9, 0.045, color);
      leg.position.set(sx * (w / 2 - 0.05), h * 0.45, sz * (d / 2 - 0.05));
      g.add(leg);
    });
  } else if (dt === "whitewash") {
    const top = box(w, h * 0.05, d, color);
    top.position.y = h * 0.94;
    g.add(top);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const leg = box(0.04, h * 0.92, 0.04, color);
      leg.position.set(sx * (w / 2 - 0.05), h * 0.46, sz * (d / 2 - 0.05));
      g.add(leg);
    });
    const c = box(w * 0.85, 0.04, 0.04, color);
    c.position.set(0, h * 0.15, 0);
    g.add(c);
  } else {
    const top = box(w, h * 0.06, d, color);
    top.position.y = h * 0.94;
    g.add(top);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const leg = box(0.04, h * 0.9, 0.04, lc);
      leg.position.set(sx * (w / 2 - 0.05), h * 0.45, sz * (d / 2 - 0.05));
      g.add(leg);
    });
  }

  addContactShadow(g, w, d);
  return g;
}

export function buildOfficeChair(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const h = dims.h / 100;
  const w = dims.w / 100;
  const ct = TS(opts, "chairType", "mesh");
  const pc = P(opts, "poleColor", 0x2a2330);

  if (ct === "low-block") {
    const sh = h * 0.42;
    const seat = box(w * 0.9, h * 0.08, w * 0.9, color);
    seat.position.y = sh;
    g.add(seat);
    const back = box(w * 0.85, h * 0.42, 0.05, color);
    back.position.set(0, sh + h * 0.21, -w * 0.42);
    g.add(back);
    const p = cyl(0.02, 0.025, h * 0.4, pc, 10);
    p.position.y = h * 0.21;
    g.add(p);
    const b = cyl(w * 0.42, w * 0.42, 0.03, pc, 5);
    b.position.y = 0.015;
    g.add(b);
  } else if (ct === "wood-frame") {
    const sh = h * 0.5;
    const seat = box(w * 0.9, h * 0.06, w * 0.9, color);
    seat.position.y = sh;
    g.add(seat);
    const back = box(w * 0.85, h * 0.4, 0.05, color);
    back.position.set(0, sh + h * 0.22, -w * 0.42);
    g.add(back);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const leg = cyl(0.015, 0.015, h * 0.5, pc, 6);
      leg.position.set(sx * w * 0.38, h * 0.25, sz * w * 0.38);
      g.add(leg);
    });
  } else {
    const seat = cyl(w * 0.42, w * 0.42, h * 0.1, color, 20);
    seat.position.y = h * 0.5;
    g.add(seat);
    const back = box(w * 0.6, h * 0.45, 0.05, color, { roughness: 0.95 });
    back.position.set(0, h * 0.5 + h * 0.28, -w * 0.3);
    g.add(back);
    const p = cyl(0.02, 0.03, h * 0.42, pc, 10);
    p.position.y = h * 0.29;
    g.add(p);
    const bs = cyl(w * 0.42, w * 0.42, 0.03, pc, 5);
    bs.position.y = 0.02;
    g.add(bs);
  }

  addContactShadow(g, w, w);
  return g;
}

export function buildFloorLamp(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const h = dims.h / 100;
  const ls = TS(opts, "lampShade", "cone");
  const bc = P(opts, "baseColor", 0x3a3138);
  const pc = P(opts, "poleColor", 0xb8862b);

  if (ls === "paper-cylinder") {
    const b = cyl(w * 0.4, w * 0.4, 0.02, bc, 20);
    b.position.y = 0.01;
    g.add(b);
    const p = cyl(0.012, 0.012, h * 0.55, pc, 8);
    p.position.y = h * 0.3;
    g.add(p);
    const s = cyl(w * 0.5, w * 0.5, h * 0.42, color, 24, { roughness: 0.95 });
    s.position.y = h * 0.78;
    g.add(s);
    const c = cyl(w * 0.5, w * 0.5, 0.02, pc, 24);
    c.position.y = h * 0.99;
    g.add(c);
  } else if (ls === "woven-dome") {
    for (let i = 0; i < 3; i++) {
      const leg = cyl(0.012, 0.018, h * 0.7, pc, 6);
      const a = (i / 3) * Math.PI * 2;
      leg.position.set(Math.cos(a) * w * 0.35, h * 0.35, Math.sin(a) * w * 0.35);
      leg.rotation.z = Math.cos(a) * 0.25;
      leg.rotation.x = Math.sin(a) * 0.25;
      g.add(leg);
    }
    const s = cyl(w * 0.55, w * 0.7, h * 0.35, color, 24, { roughness: 0.95 });
    s.position.y = h * 0.82;
    g.add(s);
  } else if (ls === "drum") {
    const b = cyl(w * 0.45, w * 0.45, 0.03, bc, 20);
    b.position.y = 0.015;
    g.add(b);
    const p = cyl(0.012, 0.012, h * 0.72, pc, 8);
    p.position.y = h * 0.36;
    g.add(p);
    const s = cyl(w * 0.5, w * 0.5, h * 0.3, color, 24, { roughness: 0.95 });
    s.position.y = h * 0.87;
    g.add(s);
  } else {
    const b = cyl(w / 2, w / 2, 0.02, bc, 24);
    b.position.y = 0.01;
    g.add(b);
    const p = cyl(0.015, 0.015, h * 0.75, pc, 12);
    p.position.y = h * 0.375 + 0.02;
    g.add(p);
    const s = cyl(w * 0.5, w * 0.35, h * 0.28, color, 24, { roughness: 0.9 });
    s.position.y = h * 0.75 + h * 0.14 + 0.02;
    g.add(s);
  }

  addContactShadow(g, w, w);
  return g;
}

export function buildTableLamp(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const h = dims.h / 100;
  const lb = TS(opts, "lampBase", "metal");
  const bc = P(opts, "baseColor", 0xe0d4bc);
  const pc = P(opts, "poleColor", 0xc9a15a);

  if (lb === "thin-metal") {
    const b = cyl(w * 0.25, w * 0.25, 0.01, pc, 20);
    b.position.y = 0.005;
    g.add(b);
    const st = cyl(0.008, 0.008, h * 0.6, pc, 8);
    st.position.y = h * 0.3;
    g.add(st);
    const sh = h * 0.42;
    const s = cyl(w * 0.5, w * 0.5, sh, color, 24, { roughness: 0.95 });
    s.position.y = h * 0.6 + sh / 2;
    g.add(s);
  } else if (lb === "rattan") {
    const b = cyl(w * 0.42, w * 0.42, h * 0.4, bc, 16, { roughness: 0.95 });
    b.position.y = h * 0.2;
    g.add(b);
    for (let i = 0; i < 3; i++) {
      const r = cyl(w * 0.45, w * 0.45, 0.01, pc, 16);
      r.position.y = h * 0.1 + i * h * 0.1;
      g.add(r);
    }
    const sh = h * 0.4;
    const s = cyl(w * 0.5, w * 0.4, sh, color, 24, { roughness: 0.95 });
    s.position.y = h * 0.4 + sh / 2;
    g.add(s);
  } else if (lb === "ceramic-white") {
    const b = cyl(w * 0.35, w * 0.4, h * 0.35, bc, 20, { roughness: 0.6 });
    b.position.y = h * 0.175;
    g.add(b);
    const n = cyl(0.01, 0.01, h * 0.2, pc, 8);
    n.position.y = h * 0.35 + h * 0.1;
    g.add(n);
    const sh = h * 0.4;
    const s = cyl(w * 0.5, w * 0.42, sh, color, 24, { roughness: 0.95 });
    s.position.y = h * 0.55 + sh / 2;
    g.add(s);
  } else {
    const b = cyl(w * 0.32, w * 0.36, h * 0.14, bc, 20);
    b.position.y = h * 0.07;
    g.add(b);
    const st = cyl(0.012, 0.012, h * 0.35, pc, 10);
    st.position.y = h * 0.14 + h * 0.175;
    g.add(st);
    const s = cyl(w * 0.38, w * 0.26, h * 0.42, color, 20, { roughness: 0.9 });
    s.position.y = h * 0.14 + h * 0.35 + h * 0.21;
    g.add(s);
  }

  addContactShadow(g, w, w);
  return g;
}

export function buildMirror(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const d = dims.d / 100;
  const h = dims.h / 100;
  const gc = P(opts, "glassColor", 0xcfe0e8);
  const fc = P(opts, "footColor", 0x3a3138);

  const f = box(w, h, d, color);
  f.position.y = h / 2;
  g.add(f);

  const gl = box(w * 0.82, h * 0.9, 0.008, gc, {
    metalness: 0.3,
    roughness: 0.05,
  });
  gl.position.set(0, h / 2, d / 2 - 0.005);
  g.add(gl);

  const ft = box(w * 0.5, 0.03, d * 2, fc);
  ft.position.y = 0.015;
  g.add(ft);

  addContactShadow(g, w, d * 2);
  return g;
}

export function buildWallArt(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const d = dims.d / 100;
  const h = dims.h / 100;
  const cc = P(opts, "canvasColor", 0xd8b7ae);
  const ac = P(opts, "accentColor", 0x8fafa0);

  const f = box(w, h, d, color);
  g.add(f);

  const ca = box(w * 0.86, h * 0.86, 0.01, cc, { roughness: 0.9 });
  ca.position.set(0, 0, d / 2 + 0.006);
  g.add(ca);

  const st = box(w * 0.86, h * 0.22, 0.012, ac);
  st.position.set(0, -h * 0.15, d / 2 + 0.007);
  g.add(st);

  return g;
}

export function buildPlant(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const h = dims.h / 100;
  const pt = TS(opts, "potType", "ceramic");
  const tc = P(opts, "trunkColor", 0x6b4a2e);

  if (pt === "clay-simple") {
    const pot = cyl(w * 0.42, w * 0.42, h * 0.32, color, 20, { roughness: 0.95 });
    pot.position.y = h * 0.16;
    g.add(pot);
  } else if (pt === "terracotta") {
    const pot = cyl(w * 0.48, w * 0.35, h * 0.32, color, 20, { roughness: 0.95 });
    pot.position.y = h * 0.16;
    g.add(pot);
    const r = cyl(w * 0.5, w * 0.5, 0.02, color, 20);
    r.position.y = h * 0.32;
    g.add(r);
  } else if (pt === "ceramic-white") {
    const pot = cyl(w * 0.38, w * 0.38, h * 0.36, color, 24, { roughness: 0.4 });
    pot.position.y = h * 0.18;
    g.add(pot);
    const ft = cyl(w * 0.24, w * 0.24, 0.01, P(opts, "darkColor", 0x3a3138), 20);
    ft.position.y = 0.005;
    g.add(ft);
  } else {
    const pot = cyl(w * 0.42, w * 0.32, h * 0.3, color, 20);
    pot.position.y = h * 0.15;
    g.add(pot);
  }

  const tk = cyl(0.012, 0.016, h * 0.35, tc, 8);
  tk.position.y = h * 0.3 + h * 0.17;
  g.add(tk);

  const lc = [0x5e7c55, 0x6f8e63, 0x51694a];
  for (let i = 0; i < 5; i++) {
    const s = mesh(new THREE.SphereGeometry(w * 0.24, 8, 8), lc[i % lc.length], {
      roughness: 0.9,
    });
    const a = (i / 5) * Math.PI * 2;
    s.position.set(
      Math.cos(a) * w * 0.14,
      h * 0.75 + Math.sin(i) * 0.03,
      Math.sin(a) * w * 0.14,
    );
    s.scale.setScalar(0.9 + Math.random() * 0.3);
    g.add(s);
  }

  addContactShadow(g, w, w);
  return g;
}

export function buildRoundRug(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const rt = TS(opts, "rugType", "flat");

  const r = cyl(w / 2, w / 2, 0.015, color, 32, { roughness: 0.95 });
  r.position.y = 0.0075;
  g.add(r);

  if (rt === "jute" || rt === "flat") {
    for (let i = 0; i < 8; i++) {
      const ring = cyl(
        w / 2 - i * 0.015,
        w / 2 - i * 0.015,
        0.016,
        P(opts, "darkColor", 0x3a3138),
        32,
      );
      ring.position.y = 0.008;
      (ring.material as THREE.MeshStandardMaterial).opacity = 0.15;
      (ring.material as THREE.MeshStandardMaterial).transparent = true;
      g.add(ring);
    }
  } else if (rt === "tassel") {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const t = cyl(0.008, 0.008, 0.05, P(opts, "accentColor", 0xc4886e), 6);
      t.position.set((Math.cos(a) * w) / 2, 0.03, (Math.sin(a) * w) / 2);
      g.add(t);
    }
    const inner = cyl(
      w * 0.35,
      w * 0.35,
      0.016,
      P(opts, "neutralColor", 0xf5f0e6),
      32,
    );
    inner.position.y = 0.009;
    g.add(inner);
  } else if (rt === "striped") {
    for (let i = 0; i < 6; i++) {
      const s = cyl(
        w / 2 - i * 0.012,
        w / 2 - i * 0.012,
        0.016,
        P(opts, "accentColor", 0xa8c8dc),
        32,
      );
      s.position.y = 0.008;
      (s.material as THREE.MeshStandardMaterial).opacity = i % 2 ? 0.6 : 0;
      (s.material as THREE.MeshStandardMaterial).transparent = true;
      if ((s.material as THREE.MeshStandardMaterial).opacity > 0) g.add(s);
    }
  }
  return g;
}

export function buildRectRug(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const d = dims.d / 100;
  const rt = TS(opts, "rugType", "flat");

  const r = box(w, 0.015, d, color, { roughness: 0.95 });
  r.position.y = 0.0075;
  g.add(r);

  if (rt === "striped") {
    for (let i = 0; i < 8; i++) {
      const s = box(w, 0.016, d * 0.08, P(opts, "accentColor", 0xa8c8dc));
      s.position.set(0, 0.008, -d / 2 + d * (0.06 + i * 0.11));
      g.add(s);
    }
  } else if (rt === "tassel") {
    for (let i = 0; i < 12; i++) {
      const t1 = cyl(0.008, 0.008, 0.05, P(opts, "accentColor", 0xc4886e), 6);
      t1.position.set(-w / 2 + i * (w / 11), 0.03, -d / 2);
      g.add(t1);
      const t2 = cyl(0.008, 0.008, 0.05, P(opts, "accentColor", 0xc4886e), 6);
      t2.position.set(-w / 2 + i * (w / 11), 0.03, d / 2);
      g.add(t2);
    }
  } else {
    for (let i = 0; i < 6; i++) {
      const s = box(w * 0.98, 0.016, d * 0.02, P(opts, "darkColor", 0x3a3138));
      s.position.set(0, 0.008, -d / 2 + d * (0.1 + i * 0.16));
      (s.material as THREE.MeshStandardMaterial).transparent = true;
      (s.material as THREE.MeshStandardMaterial).opacity = 0.12;
      g.add(s);
    }
  }
  return g;
}

export function buildPouf(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const h = dims.h / 100;

  const body = cyl(w / 2, (w / 2) * 0.92, h, color, 24, { roughness: 0.9 });
  body.position.y = h / 2;
  g.add(body);

  addContactShadow(g, w, w);
  return g;
}

export function buildPendantLamp(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const h = dims.h / 100;
  const cc = P(opts, "cordColor", 0x3a3138);
  const bc = P(opts, "bulbColor", 0xffe9b8);

  const cn = cyl(w * 0.22, w * 0.26, 0.03, cc, 16);
  cn.position.y = -0.015;
  g.add(cn);

  const ch = h * 0.5;
  const c = cyl(0.007, 0.007, ch, cc, 8);
  c.position.y = -0.03 - ch / 2;
  g.add(c);

  const sh = h - 0.03 - ch;
  const s = cyl(w * 0.5, w * 0.22, sh, color, 24, { roughness: 0.85 });
  s.position.y = -0.03 - ch - sh / 2;
  g.add(s);

  const b = mesh(new THREE.SphereGeometry(w * 0.12, 12, 12), bc, {
    roughness: 0.3,
  });
  (b.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0xffce7a);
  (b.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.55;
  b.position.y = -0.03 - ch - sh * 0.3;
  g.add(b);

  return g;
}

export function buildCeilingFan(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const h = dims.h / 100;
  const mc = P(opts, "motorColor", 0x4a4550);
  const rc = P(opts, "rodColor", 0x3a3138);

  const cn = cyl(w * 0.07, w * 0.09, 0.03, rc, 16);
  cn.position.y = -0.015;
  g.add(cn);

  const rh = h * 0.35;
  const r = cyl(0.012, 0.012, rh, rc, 8);
  r.position.y = -0.03 - rh / 2;
  g.add(r);

  const mh = h * 0.22;
  const m = cyl(w * 0.11, w * 0.13, mh, mc, 20);
  m.position.y = -0.03 - rh - mh / 2;
  g.add(m);

  const by = -0.03 - rh - mh * 0.9;
  for (let i = 0; i < 4; i++) {
    const bl = box(w * 0.42, 0.012, w * 0.11, color, { roughness: 0.7 });
    const a = (i / 4) * Math.PI * 2;
    bl.position.set(Math.cos(a) * w * 0.24, by, Math.sin(a) * w * 0.24);
    bl.rotation.y = a;
    g.add(bl);
  }
  return g;
}

export function buildDownlight(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const h = dims.h / 100;
  const tc = P(opts, "trimColor", 0x3a3138);

  const tr = cyl(w / 2, w / 2, h * 0.4, tc, 20);
  tr.position.y = -h * 0.2;
  g.add(tr);

  const l = mesh(
    new THREE.CylinderGeometry(w * 0.42, w * 0.42, h * 0.35, 20),
    color,
    { roughness: 0.4 },
  );
  (l.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0xffefc7);
  (l.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.45;
  l.position.y = -h * 0.4 - h * 0.175;
  g.add(l);

  return g;
}

export function buildHangingPlant(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const h = dims.h / 100;
  const cc = P(opts, "cordColor", 0x3a3138);

  const cn = cyl(w * 0.05, w * 0.07, 0.02, cc, 12);
  cn.position.y = -0.01;
  g.add(cn);

  const ch = h * 0.4;
  [-1, 1].forEach((sx) => {
    const c = cyl(0.006, 0.006, ch, cc, 6);
    c.position.set(sx * w * 0.12, -0.01 - ch / 2, 0);
    c.rotation.z = sx * 0.12;
    g.add(c);
  });

  const ph = h * 0.28;
  const pot = cyl(w * 0.32, w * 0.22, ph, color, 20);
  pot.position.y = -0.01 - ch - ph / 2;
  g.add(pot);

  const lc = [0x5e7c55, 0x6f8e63, 0x4c6344];
  for (let i = 0; i < 5; i++) {
    const s = mesh(new THREE.SphereGeometry(w * 0.16, 8, 8), lc[i % lc.length], {
      roughness: 0.9,
    });
    const a = (i / 5) * Math.PI * 2;
    s.position.set(
      Math.cos(a) * w * 0.12,
      -0.01 - ch - ph * 0.35 + (i % 2) * 0.02,
      Math.sin(a) * w * 0.12,
    );
    g.add(s);
  }
  for (let i = 0; i < 3; i++) {
    const vl = h * 0.16 + (i % 2) * h * 0.07;
    const v = cyl(0.006, 0.004, vl, lc[i % lc.length], 6);
    const a = (i / 3) * Math.PI * 2 + 0.6;
    v.position.set(
      Math.cos(a) * w * 0.2,
      -0.01 - ch - ph - vl / 2 + 0.02,
      Math.sin(a) * w * 0.2,
    );
    g.add(v);
  }
  return g;
}

// ============================================================
// ⭐ Curtain (ม่านแขวนผนัง)
// ============================================================

export function buildCurtain(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const d = dims.d / 100;
  const h = dims.h / 100;
  const fc = P(opts, "foldColor", 0xc9a88f);

  // Rod (ราวม่าน)
  const rodMat = new THREE.MeshStandardMaterial({
    color: 0x8a6a4f,
    roughness: 0.4,
    metalness: 0.3,
  });
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, w + 0.12, 10),
    rodMat,
  );
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, h / 2, 0);
  g.add(rod);

  // Rod end caps
  [-1, 1].forEach((sx) => {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 8, 8),
      rodMat,
    );
    cap.position.set(sx * (w / 2 + 0.06), h / 2, 0);
    g.add(cap);
  });

  // Curtain fabric — multiple vertical folds
  const fabricMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  const foldMat = new THREE.MeshStandardMaterial({
    color: fc,
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  const foldCount = Math.max(3, Math.round(w / 0.25));
  const foldW = w / foldCount;
  const fabricH = h * 0.95;

  for (let i = 0; i < foldCount; i++) {
    const x = -w / 2 + foldW * (i + 0.5);
    const isAccent = i % 3 === 1;
    const m = isAccent ? foldMat : fabricMat;
    // Each fold is a slightly curved plane (simulate drape)
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(foldW * 1.05, fabricH, 1, 4),
      m,
    );
    // Slight sine wave for drape effect
    const geo = panel.geometry;
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const py = pos.getY(k);
      const t = (py + fabricH / 2) / fabricH; // 0 at bottom, 1 at top
      // Wider at bottom, narrower at top (natural drape)
      pos.setX(k, pos.getX(k) * (0.85 + 0.15 * t));
      // Subtle fold curvature
      pos.setZ(k, Math.sin(t * Math.PI) * 0.012 * (i % 2 === 0 ? 1 : -1));
    }
    geo.computeVertexNormals();
    panel.position.set(x, 0, d / 2 + 0.005);
    g.add(panel);
  }

  // Weighted bottom hem
  const hem = box(w, 0.015, d + 0.01, 0x6b5a42);
  hem.position.set(0, -h / 2 + 0.008, 0);
  g.add(hem);

  return g;
}

// ============================================================
// ⭐ AC (แอร์ติดผนัง)
// ============================================================

export function buildAc(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const d = dims.d / 100;
  const h = dims.h / 100;
  const vc = P(opts, "ventColor", 0x4a4550);

  // Main body — slightly tapered front
  const body = box(w, h, d, color, { roughness: 0.5, metalness: 0.05 });
  body.position.y = 0;
  g.add(body);

  // Front panel (slightly protruding)
  const front = box(w * 0.96, h * 0.85, 0.008, color, {
    roughness: 0.4,
    metalness: 0.08,
  });
  front.position.set(0, 0, d / 2 + 0.004);
  g.add(front);

  // Bottom vent strip (air outlet)
  const ventMat = new THREE.MeshStandardMaterial({
    color: vc,
    roughness: 0.6,
    metalness: 0.1,
  });
  const vent = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.82, h * 0.12, 0.01),
    ventMat,
  );
  vent.position.set(0, -h / 2 + h * 0.14, d / 2 + 0.006);
  g.add(vent);

  // Vent louvers (3 horizontal slats)
  for (let i = 0; i < 3; i++) {
    const louver = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.78, 0.004, 0.012),
      ventMat,
    );
    louver.position.set(
      0,
      -h / 2 + h * 0.08 + i * h * 0.04,
      d / 2 + 0.012,
    );
    louver.rotation.x = -0.3;
    g.add(louver);
  }

  // Top brand strip
  const strip = box(w * 0.3, 0.008, 0.006, 0x888888);
  strip.position.set(0, h * 0.3, d / 2 + 0.005);
  g.add(strip);

  // Side edges (subtle detail)
  [-1, 1].forEach((sx) => {
    const edge = box(0.008, h * 0.9, d * 0.95, color, {
      roughness: 0.45,
      metalness: 0.06,
    });
    edge.position.set(sx * (w / 2 - 0.004), 0, 0);
    g.add(edge);
  });

  return g;
}

// ============================================================
// ⭐ Column (เสาโครงสร้าง) — เรียบๆ
// ============================================================

export function buildColumn(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const d = dims.d / 100;
  const h = dims.h / 100;

  // Simple box only
  const pillar = box(w, h, d, color);
  pillar.position.y = h / 2;
  g.add(pillar);

  addContactShadow(g, w, d);
  return g;
}

// ============================================================
// ⭐ Partition (ฉากกั้นห้อง) — เรียบๆ ใช้สีเดียวกับผนัง
// ============================================================

export function buildPartition(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const d = dims.d / 100;
  const h = dims.h / 100;

  // Simple panel only
  const panel = box(w, h, d, color);
  panel.position.y = h / 2;
  g.add(panel);

  addContactShadow(g, w, d);
  return g;
}

// ============================================================
// ⭐ Stairs (บันไดตรงพื้นฐาน)
// ============================================================

export function buildStairs(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const d = dims.d / 100;
  const h = dims.h / 100;

  const treadColor = P(opts, "treadColor", 0xd9c7a8);

  // จำนวนขั้น — สูงประมาณ 18 ซม./ขั้น
  const stepCount = Math.max(3, Math.round(h / 0.18));
  const stepH = h / stepCount;
  const stepD = d / stepCount;

  for (let i = 0; i < stepCount; i++) {
    const topY = (i + 1) * stepH;
    const z = -d / 2 + (i + 0.5) * stepD;

    // Solid step block
    const step = box(w, topY, stepD, color);
    step.position.set(0, topY / 2, z);
    g.add(step);

    // Tread (พื้นเหยียบด้านบน) — accent color
    const tread = box(w + 0.02, 0.03, stepD, treadColor);
    tread.position.set(0, topY + 0.015, z);
    g.add(tread);
  }

  addContactShadow(g, w, d);
  return g;
}

// ============================================================
// ⭐ Sliding Door (ประตูระเบียง) — 2 บาน + กระจก
// ============================================================

export function buildSlidingDoor(dims: any, color: number, opts: any = {}) {
  const g = new THREE.Group();
  const w = dims.w / 100;
  const h = dims.h / 100;
  const d = dims.d / 100;

  const frameColor = P(opts, "frameColor", 0xf7f3ea);
  const glassColor = P(opts, "glassColor", 0xcfe0e8);

  const tr = 0.05; // frame thickness

  // ===== Outer frame =====
  const frameMat = new THREE.MeshStandardMaterial({
    color: frameColor,
    roughness: 0.7,
  });

  // Top
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(w + tr * 2, tr, d),
    frameMat,
  );
  top.position.set(0, h / 2 - tr / 2, 0);
  g.add(top);

  // Bottom (threshold)
  const bottom = new THREE.Mesh(
    new THREE.BoxGeometry(w + tr * 2, tr * 0.6, d * 1.2),
    frameMat,
  );
  bottom.position.set(0, -h / 2 + tr * 0.3, 0);
  g.add(bottom);

  // Left / Right
  const left = new THREE.Mesh(new THREE.BoxGeometry(tr, h, d), frameMat);
  left.position.set(-w / 2 - tr / 2, 0, 0);
  g.add(left);

  const right = new THREE.Mesh(new THREE.BoxGeometry(tr, h, d), frameMat);
  right.position.set(w / 2 + tr / 2, 0, 0);
  g.add(right);

  // ===== 2 panels: 1 fixed + 1 sliding =====
  const panelW = w / 2;
  const panelH = h - tr * 0.6 - tr;

  // Glass material
  const glassMat = new THREE.MeshStandardMaterial({
    color: glassColor,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.55,
    emissive: glassColor,
    emissiveIntensity: 0.08,
    side: THREE.DoubleSide,
  });

  // Panel frame material
  const panelFrameMat = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.6,
  });

  // Build a single panel (frame + glass + handle)
  const buildPanel = (offsetX: number, offsetZ: number, hasHandle: boolean) => {
    const panel = new THREE.Group();
    const pf = tr * 0.6; // panel frame thickness

    // Panel frame (4 sides)
    const pTop = new THREE.Mesh(
      new THREE.BoxGeometry(panelW, pf, d * 0.6),
      panelFrameMat,
    );
    pTop.position.set(0, panelH / 2 - pf / 2, 0);
    panel.add(pTop);

    const pBot = new THREE.Mesh(
      new THREE.BoxGeometry(panelW, pf, d * 0.6),
      panelFrameMat,
    );
    pBot.position.set(0, -panelH / 2 + pf / 2, 0);
    panel.add(pBot);

    const pLeft = new THREE.Mesh(
      new THREE.BoxGeometry(pf, panelH, d * 0.6),
      panelFrameMat,
    );
    pLeft.position.set(-panelW / 2 + pf / 2, 0, 0);
    panel.add(pLeft);

    const pRight = new THREE.Mesh(
      new THREE.BoxGeometry(pf, panelH, d * 0.6),
      panelFrameMat,
    );
    pRight.position.set(panelW / 2 - pf / 2, 0, 0);
    panel.add(pRight);

    // Glass
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(
        panelW - pf * 2,
        panelH - pf * 2,
      ),
      glassMat,
    );
    glass.position.z = 0.001;
    panel.add(glass);

    // Handle (vertical bar)
    if (hasHandle) {
      const handleMat = new THREE.MeshStandardMaterial({
        color: 0x8a8a8a,
        roughness: 0.3,
        metalness: 0.7,
      });
      const handle = new THREE.Mesh(
        new THREE.BoxGeometry(0.025, 0.25, 0.03),
        handleMat,
      );
      handle.position.set(panelW / 2 - pf - 0.04, 0, d * 0.35);
      panel.add(handle);
    }

    panel.position.set(offsetX, -tr * 0.3, offsetZ);
    return panel;
  };

  // Fixed panel (back track)
  const fixedPanel = buildPanel(-panelW / 2, -d * 0.15, false);
  g.add(fixedPanel);

  // Sliding panel (front track, slightly overlapping center)
  const slidingPanel = buildPanel(panelW / 2, d * 0.15, true);
  g.add(slidingPanel);

  // Center divider (between the 2 tracks)
  const centerDiv = new THREE.Mesh(
    new THREE.BoxGeometry(tr * 0.5, h * 0.98, d * 0.8),
    frameMat,
  );
  centerDiv.position.set(0, 0, 0);
  g.add(centerDiv);

  // ===== Track (top rail) =====
  const trackMat = new THREE.MeshStandardMaterial({
    color: 0x8a8a8a,
    roughness: 0.4,
    metalness: 0.5,
  });
  const track = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.98, 0.03, d * 0.9),
    trackMat,
  );
  track.position.set(0, h / 2 - tr * 0.5, 0);
  g.add(track);

  return g;
}