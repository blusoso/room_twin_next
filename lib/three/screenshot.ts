// lib/three/screenshot.ts
//
// ⭐ ถ่ายภาพ preview ของห้องจาก canvas ของ Three.js
//    ใช้เป็น thumbnail ในรายการ "ห้องของฉัน" / เทมเพลต
//
//    หมายเหตุ: ต้องมี preserveDrawingBuffer = true (ตั้งไว้ใน initScene)
//    ไม่งั้น buffer อาจถูกล้างก่อนอ่านค่า → ได้ภาพเปล่า
import { MAX_PREVIEW_BYTES } from "@/lib/shared/roomShare";
import { camera, isInitialized, renderer, scene } from "./scene";

/** ขนาดภาพ preview (อัตราส่วน 8:5) */
export const THUMB_WIDTH = 480;
export const THUMB_HEIGHT = 300;

/** คุณภาพ JPEG — 0.62 ได้ภาพประมาณ 15–35 KB */
const THUMB_QUALITY = 0.62;

let thumbCanvas: HTMLCanvasElement | null = null;

function getThumbCanvas(): HTMLCanvasElement | null {
  if (thumbCanvas) return thumbCanvas;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = THUMB_WIDTH;
  c.height = THUMB_HEIGHT;
  thumbCanvas = c;
  return c;
}

/**
 * คืน data URL ของภาพ preview (JPEG) หรือ null เมื่อถ่ายไม่ได้
 *
 * ⭐ ไม่ throw เด็ดขาด — ผู้เรียกใช้ null เพื่อแสดงภาพ placeholder แทน
 *    และบันทึกห้องโดยไม่มี preview ได้ตามปกติ
 */
export function captureRoomThumbnail(): string | null {
  try {
    if (!isInitialized()) return null;

    const src = renderer?.domElement;
    if (!src || !src.width || !src.height) return null;

    // วาด frame ปัจจุบันก่อนอ่านค่า (กันภาพค้าง/ว่าง)
    renderer.render(scene, camera);

    const canvas = getThumbCanvas();
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return null;

    // ครอปกลางจอให้ได้อัตราส่วน 8:5 (cover)
    const targetAspect = THUMB_WIDTH / THUMB_HEIGHT;
    const srcAspect = src.width / src.height;

    let sx = 0;
    let sy = 0;
    let sw = src.width;
    let sh = src.height;

    if (srcAspect > targetAspect) {
      sw = Math.round(src.height * targetAspect);
      sx = Math.round((src.width - sw) / 2);
    } else if (srcAspect < targetAspect) {
      sh = Math.round(src.width / targetAspect);
      sy = Math.round((src.height - sh) / 2);
    }

    ctx.clearRect(0, 0, THUMB_WIDTH, THUMB_HEIGHT);
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, THUMB_WIDTH, THUMB_HEIGHT);

    const dataUrl = canvas.toDataURL("image/jpeg", THUMB_QUALITY);
    if (!dataUrl || dataUrl.length > MAX_PREVIEW_BYTES) return null;
    return dataUrl;
  } catch (err) {
    console.warn("[screenshot] captureRoomThumbnail failed", err);
    return null;
  }
}
