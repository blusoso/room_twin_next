// components/viewport/RulerOverlay.tsx
// ⭐ โหมด 📏 ไม้บรรทัดห้อง — overlay บน viewport (ไม่ใช่ Three.js object)
//    - ไม้บรรทัดบนพื้นห้อง (ขอบหลัง + ขอบซ้าย) + ไม้บรรทัดความสูง → SVG
//    - ตอนลาก object → เส้นไกด์ 2 เส้นไปยังผนังที่ใกล้ที่สุด + ป้ายระยะ
//    - คำนวณโมเดลใหม่ทุก ~100ms, project ทุก frame (mutate DOM ตรง ๆ ไม่ setState 60Hz)
"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useRoomTwin } from "@/lib/state/store";
import { camera, renderer, isInitialized } from "@/lib/three/scene";
import { computeRuler, type RulerModel } from "@/lib/three/ruler";

/** ความถี่ในการคำนวณโมเดลไม้บรรทัดใหม่ (ms) — projection ทำทุก frame */
const MODEL_INTERVAL_MS = 100;
/** ขีดที่ห่างกันน้อยกว่านี้ (px) → ไม่ต้องวาด (กันขีดทับกันตอนซูมออก) */
const MIN_TICK_PX = 4;
/** label ที่ห่างกันน้อยกว่านี้ (px) → ไม่ต้องวาด */
const MIN_LABEL_PX = 34;
/** ถ้าพิกัดที่ project เปลี่ยนน้อยกว่านี้ (px) → ไม่ต้องเขียน DOM ซ้ำ */
const MIN_MOVE_PX = 0.2;

interface Projected {
  x: number;
  y: number;
}

const EMPTY_MODEL: RulerModel = {
  rect: null,
  baselines: [],
  ticks: [],
  labels: [],
  guides: [],
  badges: [],
  marker: null,
};

export default function RulerOverlay() {
  const showMeasure = useRoomTwin((s) => s.showMeasure);
  const layerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!showMeasure) return;

    const layer = layerRef.current;
    const svg = svgRef.current;
    if (!layer || !svg) return;

    // element caches (keyed by id ของโมเดล → reuse ข้าม frame)
    const baseEls = new Map<string, SVGLineElement>();
    const tickEls = new Map<string, SVGLineElement>();
    const guideEls = new Map<string, SVGLineElement>();
    const labelEls = new Map<string, HTMLDivElement>();
    const guideLabelEls = new Map<string, HTMLDivElement>();
    const badgeEls = new Map<string, HTMLDivElement>();
    let markerEl: HTMLDivElement | null = null;

    // cache พิกัดที่เขียนล่าสุด (กันเขียน DOM ซ้ำทุก frame)
    const lastPos = new Map<string, Projected>();
    // dedup ต่อกลุ่มแกน
    const lastTickPx = new Map<string, Projected>();
    const lastLabelPx = new Map<string, Projected>();
    const shownTick = new Set<string>();

    const pA = new THREE.Vector3();
    const pB = new THREE.Vector3();

    let raf = 0;
    let lastModelAt = -Infinity;
    let model = EMPTY_MODEL;

    let rectW = 0;
    let rectH = 0;
    let offX = 0;
    let offY = 0;

    const project = (
      p: THREE.Vector3,
      out: Projected,
    ): Projected | null => {
      pA.copy(p).project(camera);
      if (pA.z > 1) return null;
      out.x = (pA.x * 0.5 + 0.5) * rectW;
      out.y = (-pA.y * 0.5 + 0.5) * rectH;
      return out;
    };

    const tmpA: Projected = { x: 0, y: 0 };
    const tmpB: Projected = { x: 0, y: 0 };

    const writeLine = (
      el: SVGLineElement,
      id: string,
      a: Projected,
      b: Projected,
    ) => {
      let last = lastPos.get(id);
      if (
        !last ||
        Math.abs(last.x - a.x) > MIN_MOVE_PX ||
        Math.abs(last.y - a.y) > MIN_MOVE_PX
      ) {
        el.setAttribute("x1", a.x.toFixed(1));
        el.setAttribute("y1", a.y.toFixed(1));
        last = { x: a.x, y: a.y };
        lastPos.set(id, last);
      }
      // ปลายที่สอง cache แยกด้วย key ต่อท้าย
      const id2 = id + "|b";
      const last2 = lastPos.get(id2);
      if (
        !last2 ||
        Math.abs(last2.x - b.x) > MIN_MOVE_PX ||
        Math.abs(last2.y - b.y) > MIN_MOVE_PX
      ) {
        el.setAttribute("x2", b.x.toFixed(1));
        el.setAttribute("y2", b.y.toFixed(1));
        lastPos.set(id2, { x: b.x, y: b.y });
      }
    };

    const ensureSvgLine = (
      map: Map<string, SVGLineElement>,
      id: string,
      className: string,
    ) => {
      let el = map.get(id);
      if (!el) {
        el = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line",
        );
        el.setAttribute("class", className);
        svg.appendChild(el);
        map.set(id, el);
      }
      return el;
    };

    const ensureDiv = (
      map: Map<string, HTMLDivElement>,
      id: string,
      className: string,
    ) => {
      let el = map.get(id);
      if (!el) {
        el = document.createElement("div");
        el.className = className;
        layer.appendChild(el);
        map.set(id, el);
      }
      return el;
    };

    const tick = () => {
      // ⭐ scene ยังไม่พร้อม → รอรอบถัดไป
      if (!isInitialized() || !renderer) {
        raf = requestAnimationFrame(tick);
        return;
      }

      const now = performance.now();
      if (now - lastModelAt >= MODEL_INTERVAL_MS) {
        lastModelAt = now;
        model = computeRuler();

        const rect = renderer.domElement.getBoundingClientRect();
        const lr = layer.getBoundingClientRect();
        rectW = rect.width;
        rectH = rect.height;
        offX = rect.left - lr.left;
        offY = rect.top - lr.top;

        const w = String(Math.round(rectW));
        const h = String(Math.round(rectH));
        if (svg.getAttribute("width") !== w) svg.setAttribute("width", w);
        if (svg.getAttribute("height") !== h) svg.setAttribute("height", h);
        const l = offX + "px";
        const t = offY + "px";
        if (svg.style.left !== l) svg.style.left = l;
        if (svg.style.top !== t) svg.style.top = t;
      }

      if (!model.rect) {
        raf = requestAnimationFrame(tick);
        return;
      }

      // ===== เส้นฐาน =====
      const seenBase = new Set<string>();
      for (const seg of model.baselines) {
        const a = project(seg.a, tmpA);
        const b = project(seg.b, tmpB);
        if (!a || !b) continue;
        seenBase.add(seg.id);
        const el = ensureSvgLine(baseEls, seg.id, "ruler-line base");
        writeLine(el, seg.id, a, b);
      }
      baseEls.forEach((el, id) => {
        if (seenBase.has(id)) return;
        el.remove();
        baseEls.delete(id);
      });

      // ===== ขีด (dedup ต่อกลุ่มแกน) =====
      lastTickPx.clear();
      const tickIds = new Set<string>();
      for (const seg of model.ticks) {
        tickIds.add(seg.id);

        const a = project(seg.a, tmpA);
        const b = project(seg.b, tmpB);
        if (!a || !b) continue;

        const el = ensureSvgLine(
          tickEls,
          seg.id,
          seg.major ? "ruler-line tick major" : "ruler-line tick",
        );

        const prev = lastTickPx.get(seg.group);
        const far =
          !prev || Math.hypot(a.x - prev.x, a.y - prev.y) >= MIN_TICK_PX;

        if (!far) {
          if (shownTick.has(seg.id)) {
            el.style.display = "none";
            shownTick.delete(seg.id);
          }
          continue;
        }

        lastTickPx.set(seg.group, { x: a.x, y: a.y });
        if (!shownTick.has(seg.id)) {
          el.style.display = "";
          shownTick.add(seg.id);
        }
        writeLine(el, seg.id, a, b);
      }
      tickEls.forEach((el, id) => {
        if (tickIds.has(id)) return;
        el.remove();
        tickEls.delete(id);
        shownTick.delete(id);
      });

      // ===== ตัวเลขไม้บรรทัด =====
      lastLabelPx.clear();
      for (const lb of model.labels) {
        const p = project(lb.pos, tmpA);
        if (!p) continue;

        const prev = lastLabelPx.get(lb.group);
        const far =
          !prev || Math.hypot(p.x - prev.x, p.y - prev.y) >= MIN_LABEL_PX;

        const el = ensureDiv(labelEls, lb.id, "ruler-label");
        if (el.textContent !== lb.text) el.textContent = lb.text;

        if (!far) {
          el.style.display = "none";
          continue;
        }

        lastLabelPx.set(lb.group, { x: p.x, y: p.y });
        el.style.display = "";
        el.style.left = p.x + offX + "px";
        el.style.top = p.y + offY + "px";
      }
      const labelIds = new Set(model.labels.map((l) => l.id));
      labelEls.forEach((el, id) => {
        if (labelIds.has(id)) return;
        el.remove();
        labelEls.delete(id);
      });

      // ===== เส้นไกด์ตอนลาก object =====
      const seenGuide = new Set<string>();
      for (const g of model.guides) {
        const a = project(g.a, tmpA);
        const b = project(g.b, tmpB);
        if (!a || !b) continue;

        seenGuide.add(g.id);
        const el = ensureSvgLine(guideEls, g.id, "guide-line");
        writeLine(el, g.id, a, b);

        const lp = project(g.labelPos, tmpA);
        const lab = ensureDiv(guideLabelEls, g.id, "guide-label");
        if (lab.textContent !== g.label) lab.textContent = g.label;
        if (lp) {
          lab.style.display = "";
          lab.style.left = lp.x + offX + "px";
          lab.style.top = lp.y + offY + "px";
        } else {
          lab.style.display = "none";
        }
      }
      guideEls.forEach((el, id) => {
        if (seenGuide.has(id)) return;
        el.remove();
        guideEls.delete(id);
        lastPos.delete(id);
        lastPos.delete(id + "|b");
      });
      guideLabelEls.forEach((el, id) => {
        if (seenGuide.has(id)) return;
        el.remove();
        guideLabelEls.delete(id);
      });

      // ===== ป้ายลอยกลางพื้นที่ (ขนาดโซนตอนลากย้ายโซน) =====
      const seenBadge = new Set<string>();
      for (const bd of model.badges) {
        const p = project(bd.pos, tmpA);
        if (!p) continue;

        seenBadge.add(bd.id);
        const el = ensureDiv(badgeEls, bd.id, "ruler-badge");
        if (el.textContent !== bd.text) el.textContent = bd.text;
        el.style.display = "";
        el.style.left = p.x + offX + "px";
        el.style.top = p.y + offY + "px";
      }
      badgeEls.forEach((el, id) => {
        if (seenBadge.has(id)) return;
        el.remove();
        badgeEls.delete(id);
      });

      // ===== จุด marker กลาง footprint ของ object ที่ลาก =====
      if (model.marker) {
        const mp = project(model.marker, tmpA);
        if (mp) {
          if (!markerEl) {
            markerEl = document.createElement("div");
            markerEl.className = "ruler-marker";
            layer.appendChild(markerEl);
          }
          markerEl.style.display = "";
          markerEl.style.left = mp.x + offX + "px";
          markerEl.style.top = mp.y + offY + "px";
        } else if (markerEl) {
          markerEl.style.display = "none";
        }
      } else if (markerEl) {
        markerEl.style.display = "none";
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      baseEls.forEach((el) => el.remove());
      tickEls.forEach((el) => el.remove());
      guideEls.forEach((el) => el.remove());
      labelEls.forEach((el) => el.remove());
      guideLabelEls.forEach((el) => el.remove());
      badgeEls.forEach((el) => el.remove());
      markerEl?.remove();
      baseEls.clear();
      tickEls.clear();
      guideEls.clear();
      labelEls.clear();
      guideLabelEls.clear();
      badgeEls.clear();
      lastPos.clear();
      shownTick.clear();
      markerEl = null;
    };
  }, [showMeasure]);

  if (!showMeasure) return null;

  return (
    <div className="ruler-layer" id="rulerLayer" ref={layerRef}>
      <svg className="ruler-svg" ref={svgRef} />
    </div>
  );
}
