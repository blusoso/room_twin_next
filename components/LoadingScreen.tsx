// components/LoadingScreen.tsx
//
// ⭐ Loading UI กลางของแอป (ห้าม import three / store — ไฟล์นี้ถูกใช้เป็น
//    fallback ของ dynamic() ก่อนที่ chunk ของ editor จะโหลดเสร็จ)
//
//    - <LoadingScreen/>   = จอเต็มตอนบูตแอป (skeleton โครงแอป + แบรนด์ + progress)
//    - <LoadingOverlay/>  = overlay ทับแอปที่ mount อยู่ (เปิดห้องที่แชร์ / error)
//    - <InlineSpinner/>   = spinner ตัวเล็กสำหรับปุ่ม/การ์ด
"use client";
import { useEffect, useState } from "react";

export interface LoadingScreenProps {
  /** ข้อความสถานะหลัก (ไทย) */
  message?: string;
  /** คำอธิบายเพิ่มเติม (ไม่บังคับ) */
  sub?: string;
}

/**
 * จอโหลดเต็มหน้าจอ — แสดงโครงแอป (header / sidebar / viewport) เป็น skeleton
 * เพื่อให้ตอน editor ขึ้นมาแล้วภาพไม่กระโดด (ลด CLS)
 */
export default function LoadingScreen({
  message = "กำลังเตรียมห้องของคุณ…",
  sub = "โหลดโมเดล 3D และวัสดุ",
}: LoadingScreenProps) {
  return (
    <div
      className="rt-boot"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* โครงแอปตอนโหลด — กว้างเท่า layout จริงเพื่อไม่ให้ภาพกระโดด */}
      <div className="rt-boot-skel" aria-hidden="true">
        <div className="rt-skel-head rt-shimmer" />
        <div className="rt-skel-row">
          <div className="rt-skel-side rt-shimmer" />
          <div className="rt-skel-view rt-shimmer" />
        </div>
      </div>

      <div className="rt-boot-card rt-fade-in">
        <span className="rt-brand-chip" aria-hidden="true">
          🛋
        </span>
        <div className="rt-brand">
          <strong>RoomTwin</strong>
          <span>ลองแต่งก่อนซื้อจริง</span>
        </div>
        <p className="rt-boot-msg">{message}</p>
        {sub ? <p className="rt-boot-sub">{sub}</p> : null}
        <div className="rt-bar" aria-hidden="true">
          <span className="rt-bar-fill" />
        </div>
      </div>
    </div>
  );
}

export interface LoadingOverlayProps {
  /** true = แสดง overlay ; พอเป็น false จะ fade-out 260ms แล้ว unmount เอง */
  show: boolean;
  message?: string;
  sub?: string;
  /** มีค่า = แสดงการ์ด error แทนสถานะกำลังโหลด */
  error?: string;
  onRetry?: () => void;
  onBackHome?: () => void;
}

/**
 * overlay ทับแอปที่ mount อยู่แล้ว (ไม่ unmount editor)
 * ใช้ตอนเปิดลิงก์แชร์ — ระหว่างรอข้อมูลห้องจากเซิร์ฟเวอร์
 */
export function LoadingOverlay({
  show,
  message = "กำลังเปิดห้องที่แชร์…",
  sub,
  error,
  onRetry,
  onBackHome,
}: LoadingOverlayProps) {
  const [mounted, setMounted] = useState(show);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (show) {
      setMounted(true);
      setLeaving(false);
      return;
    }
    if (!mounted) return;
    // ⭐ ค่อย ๆ จางหายแล้วค่อยถอดออกจาก DOM
    setLeaving(true);
    const t = setTimeout(() => setMounted(false), 260);
    return () => clearTimeout(t);
  }, [show, mounted]);

  if (!mounted) return null;

  return (
    <div
      className={`rt-overlay${leaving ? " leaving" : ""}${
        error ? " has-error" : ""
      }`}
      role="status"
      aria-live="polite"
      aria-busy={!error}
    >
      <div className="rt-overlay-card rt-fade-in">
        {error ? (
          <>
            <span className="rt-error-icon" aria-hidden="true">
              😕
            </span>
            <strong className="rt-overlay-title">เปิดห้องไม่สำเร็จ</strong>
            <p className="rt-overlay-msg">{error}</p>
            <div className="rt-overlay-actions">
              {onRetry ? (
                <button type="button" className="rt-btn primary" onClick={onRetry}>
                  ลองอีกครั้ง
                </button>
              ) : null}
              {onBackHome ? (
                <button type="button" className="rt-btn" onClick={onBackHome}>
                  ไปห้องของฉัน
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <span className="rt-spin" aria-hidden="true" />
            <strong className="rt-overlay-title">{message}</strong>
            {sub ? <p className="rt-overlay-msg">{sub}</p> : null}
            <div className="rt-bar" aria-hidden="true">
              <span className="rt-bar-fill" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** spinner ตัวเล็ก — ใช้ในปุ่ม/การ์ดที่กำลังทำงาน */
export function InlineSpinner({ size = 14 }: { size?: number }) {
  return (
    <span
      className="rt-inline-spin"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
