// components/modals/SaveShareModal.tsx
//
// ⭐ บันทึก / แชร์ห้อง (backend SQLite ผ่าน /api/rooms)
//
//    โครงใหม่ให้เข้าใจใน 3 วินาที:
//    1) การ์ด "ห้องที่กำลังแก้ไข" + ภาพ preview สดจากมุมกล้อง 3D
//    2) ปุ่มเดียวที่ชัดเจน (บันทึก / บันทึกทับ / บันทึกเป็นสำเนา)
//    3) กล่องลิงก์แชร์ + สวิตช์เทมเพลตสาธารณะ
//    4) การ์ดห้องที่มีภาพ preview + "แก้ไขล่าสุด …"
"use client";
import { useCallback, useEffect, useState } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { useSaveState } from "@/hooks/useSaveState";
import {
  createRoom,
  deleteRoom,
  getRoom,
  listRooms,
  listTemplates,
  updateRoom,
} from "@/lib/cloud/api";
import { setStoredActiveRoomId } from "@/lib/cloud/activeRoom";
import { saveSharedAsCopy } from "@/lib/cloud/saveCopy";
import { saveToStorage } from "@/lib/state/storage";
import { restoreSerializedState } from "@/lib/state/restore";
import { captureRoomThumbnail } from "@/lib/three/screenshot";
import { absoluteTimeTh, relativeTimeTh } from "@/lib/utils/format";
import {
  DEFAULT_ROOM_NAME,
  MAX_ROOM_NAME,
  normalizeRoomName,
  serializeSnapshotOf,
  shareUrlOf,
  type CloudRoomFull,
  type CloudRoomSummary,
} from "@/lib/shared/roomShare";
import { showToast } from "@/lib/utils/toast";
import { openConfirm, useSaveShareStore } from "./useModalStores";
import RoomCard, { RoomThumb } from "./RoomCard";

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback below */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

type Tab = "mine" | "templates";

export default function SaveShareModal() {
  const open = useSaveShareStore((s) => s.open);
  const close = useSaveShareStore((s) => s.closeSaveShare);

  const activeCloudRoomId = useRoomTwin((s) => s.activeCloudRoomId);
  const setActiveCloudRoomId = useRoomTwin((s) => s.setActiveCloudRoomId);
  const sharedRoomId = useRoomTwin((s) => s.sharedRoomId);
  const sharedRoomName = useRoomTwin((s) => s.sharedRoomName);
  const { serialize } = useSaveState();

  const [tab, setTab] = useState<Tab>("mine");
  const [name, setName] = useState(DEFAULT_ROOM_NAME);
  const [myRooms, setMyRooms] = useState<CloudRoomSummary[]>([]);
  const [templates, setTemplates] = useState<CloudRoomSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [currentPreview, setCurrentPreview] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<
    CloudRoomSummary[] | null
  > => {
    setBusy(true);
    try {
      const [mine, tpl] = await Promise.all([listRooms(), listTemplates()]);
      setMyRooms(mine);
      setTemplates(tpl);
      return mine;
    } catch (err) {
      console.error("[SaveShareModal] refresh", err);
      showToast(err instanceof Error ? err.message : "โหลดรายการไม่สำเร็จ");
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  // ⭐ ตอนเปิด modal: ถ่ายภาพมุมกล้องปัจจุบัน + ตั้งชื่อไฟล์ให้ตรงกับห้องที่ผูกอยู่
  useEffect(() => {
    if (!open) return;

    setTab("mine");
    setCurrentPreview(captureRoomThumbnail());

    const sharedName = useRoomTwin.getState().sharedRoomName;
    setName(
      sharedName
        ? `${sharedName} (สำเนา)`.slice(0, MAX_ROOM_NAME)
        : DEFAULT_ROOM_NAME,
    );

    let alive = true;
    (async () => {
      const mine = await refresh();
      if (!alive || !mine) return;
      const id = useRoomTwin.getState().activeCloudRoomId;
      const act = mine.find((r) => r.id === id);
      if (act) setName(act.name);
    })();

    return () => {
      alive = false;
    };
  }, [open, refresh]);

  // ⭐ เอา snapshot ของห้องจากเซิร์ฟเวอร์ขึ้นเป็นห้องปัจจุบันของ editor
  const applyRoom = useCallback((full: CloudRoomFull) => {
    const store = useRoomTwin.getState();
    if (full.owned) {
      store.setActiveCloudRoomId(full.id);
      setStoredActiveRoomId(full.id);
      restoreSerializedState(full.data);
      saveToStorage(full.data);
    } else {
      store.enterSharedRoom(full.id, full.name);
      restoreSerializedState(full.data);
    }
    store.resetHistory(serializeSnapshotOf(full.data));
  }, []);

  /** ⭐ ถ่ายภาพใหม่ตอนกดบันทึก เพื่อให้ preview ตรงกับสิ่งที่เพิ่งบันทึก */
  const shot = () => captureRoomThumbnail() ?? undefined;

  const handleSaveNew = async () => {
    const finalName = normalizeRoomName(name);
    const preview = shot();
    setBusy(true);
    try {
      const room = await createRoom({ name: finalName, data: serialize(), preview });
      setActiveCloudRoomId(room.id);
      setStoredActiveRoomId(room.id);
      saveToStorage(serialize());
      setName(finalName);
      if (preview) setCurrentPreview(preview);
      showToast(`บันทึก "${room.name}" แล้ว`);
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveOver = async () => {
    if (!activeCloudRoomId) return;
    const finalName = normalizeRoomName(name);
    const preview = shot();
    setBusy(true);
    try {
      await updateRoom(activeCloudRoomId, {
        name: finalName,
        data: serialize(),
        preview,
      });
      saveToStorage(serialize());
      if (preview) setCurrentPreview(preview);
      showToast("บันทึกทับไฟล์เดิมแล้ว");
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  /** ⭐ โหมดดูห้องที่แชร์ → สร้างสำเนาของตัวเองแล้วออกจากโหมดแชร์ */
  const handleSaveCopyOfShared = async () => {
    const finalName = normalizeRoomName(
      name,
      `${sharedRoomName ?? "สำเนาห้อง"} (สำเนา)`.slice(0, MAX_ROOM_NAME),
    );
    const preview = shot();
    setBusy(true);
    try {
      const room = await saveSharedAsCopy({
        name: finalName,
        data: serialize(),
        preview,
      });
      if (preview) setCurrentPreview(preview);
      showToast(`บันทึกสำเนา "${room.name}" แล้ว`);
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "บันทึกสำเนาไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = (room: CloudRoomSummary) => {
    // ไฟล์ที่ผูกกับห้องปัจจุบันอยู่แล้ว → ไม่ต้องโหลดซ้ำ
    if (!sharedRoomId && room.id === activeCloudRoomId) {
      close();
      return;
    }

    openConfirm(
      `เปิด "${room.name}" ทับห้องที่แก้อยู่? การแก้ไขที่ยังไม่บันทึกจะหายไป`,
      async () => {
        setBusy(true);
        try {
          const full = await getRoom(room.id);
          applyRoom(full);
          close();
          showToast(
            full.owned
              ? `เปิด "${full.name}" แล้ว`
              : `กำลังดูห้องที่แชร์: ${full.name}`,
          );
        } catch (err) {
          showToast(err instanceof Error ? err.message : "เปิดห้องไม่สำเร็จ");
        } finally {
          setBusy(false);
        }
      },
    );
  };

  const handleDelete = (room: CloudRoomSummary) => {
    openConfirm(`ลบไฟล์ "${room.name}"?`, async () => {
      setBusy(true);
      try {
        await deleteRoom(room.id);
        if (useRoomTwin.getState().activeCloudRoomId === room.id) {
          setActiveCloudRoomId(null);
          setStoredActiveRoomId(null);
        }
        showToast("ลบไฟล์แล้ว");
        await refresh();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
      } finally {
        setBusy(false);
      }
    });
  };

  const handleToggleTemplate = async (room: CloudRoomSummary) => {
    setBusy(true);
    try {
      await updateRoom(room.id, { isTemplate: !room.isTemplate });
      showToast(
        room.isTemplate ? "ยกเลิกเทมเพลตแล้ว" : "เผยแพร่เป็นเทมเพลตแล้ว",
      );
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "แก้ไขไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const handleRenameSubmit = async (
    room: CloudRoomSummary,
    value: string,
  ) => {
    const finalName = normalizeRoomName(value, room.name);
    setBusy(true);
    try {
      await updateRoom(room.id, { name: finalName });
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "เปลี่ยนชื่อไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const handleCopyLink = async (room: CloudRoomSummary) => {
    const ok = await copyText(shareUrlOf(room.id));
    showToast(ok ? "คัดลอกลิงก์แล้ว" : "คัดลอกไม่สำเร็จ");
  };

  const activeRoom = myRooms.find((r) => r.id === activeCloudRoomId) ?? null;
  const heroPreview = currentPreview ?? activeRoom?.preview ?? "";
  const heroName = sharedRoomId
    ? `👀 กำลังดูห้องที่แชร์: ${sharedRoomName ?? "ไม่มีชื่อ"}`
    : (activeRoom?.name ?? "ห้องนี้ยังไม่ถูกบันทึกบนเซิร์ฟเวอร์");

  return (
    <div
      className={`save-share-overlay${open ? " show" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      aria-hidden={!open}
    >
      <div className="save-share-box" role="dialog" aria-modal="true">
        <div className="ss-head">
          <h3>💾 บันทึก / แชร์ห้อง</h3>
          <button
            type="button"
            className="ss-close"
            onClick={close}
            title="ปิด"
          >
            ✕
          </button>
        </div>

        <div className="ss-body">
          {/* ===== 1) ห้องที่กำลังแก้ไข ===== */}
          <section className="ss-hero">
            <RoomThumb src={heroPreview} />
            <div className="ss-hero-info">
              <span className="ss-hero-title" title={heroName}>
                {heroName}
              </span>
              <span
                className="ss-meta"
                title={activeRoom ? absoluteTimeTh(activeRoom.updatedAt) : ""}
              >
                {activeRoom
                  ? `🕒 แก้ไขล่าสุด ${relativeTimeTh(activeRoom.updatedAt)} · ${activeRoom.itemCount} ชิ้น`
                  : sharedRoomId
                    ? "แก้ไขได้ แต่ต้องบันทึกเป็นสำเนาของตัวเอง"
                    : "กดบันทึกเพื่อเก็บขึ้นเซิร์ฟเวอร์"}
              </span>

              <input
                className="ss-input"
                value={name}
                maxLength={MAX_ROOM_NAME}
                placeholder="ตั้งชื่อไฟล์ เช่น ห้องนอน 3x4"
                onChange={(e) => setName(e.target.value)}
              />

              <div className="ss-actions">
                {sharedRoomId ? (
                  <button
                    type="button"
                    className="ss-btn primary"
                    disabled={busy}
                    onClick={handleSaveCopyOfShared}
                  >
                    📄 บันทึกเป็นสำเนาของฉัน
                  </button>
                ) : activeCloudRoomId ? (
                  <>
                    <button
                      type="button"
                      className="ss-btn primary"
                      disabled={busy}
                      onClick={handleSaveOver}
                    >
                      💾 บันทึกทับ
                    </button>
                    <button
                      type="button"
                      className="ss-btn"
                      disabled={busy}
                      onClick={handleSaveNew}
                    >
                      ＋ บันทึกเป็นไฟล์ใหม่
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="ss-btn primary"
                    disabled={busy}
                    onClick={handleSaveNew}
                  >
                    💾 บันทึกห้องนี้
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* ===== 2) ลิงก์แชร์ ===== */}
          {activeCloudRoomId ? (
            <section className="ss-linkbox">
              <span className="ss-linkbox-label">🔗 ลิงก์แชร์ให้เพื่อน</span>
              <div className="ss-linkrow">
                <input
                  className="ss-input"
                  readOnly
                  value={shareUrlOf(activeCloudRoomId)}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  className="ss-btn primary"
                  onClick={() =>
                    handleCopyLink({ id: activeCloudRoomId } as CloudRoomSummary)
                  }
                >
                  คัดลอก
                </button>
                <button
                  type="button"
                  className="ss-btn"
                  onClick={() =>
                    window.open(shareUrlOf(activeCloudRoomId), "_blank")
                  }
                >
                  เปิด
                </button>
              </div>
              {activeRoom && (
                <label className="ss-check">
                  <input
                    type="checkbox"
                    checked={activeRoom.isTemplate}
                    disabled={busy}
                    onChange={() => handleToggleTemplate(activeRoom)}
                  />
                  ★ ให้ทุกคนเห็นเป็นเทมเพลตสาธารณะ
                </label>
              )}
            </section>
          ) : (
            <section className="ss-linkbox disabled">
              🔒 บันทึกห้องก่อน แล้วลิงก์แชร์จะขึ้นที่นี่
            </section>
          )}

          {/* ===== 3) รายการห้อง ===== */}
          <div className="ss-tabs">
            <button
              type="button"
              className={`ss-tab${tab === "mine" ? " active" : ""}`}
              onClick={() => setTab("mine")}
            >
              ห้องของฉัน ({myRooms.length})
            </button>
            <button
              type="button"
              className={`ss-tab${tab === "templates" ? " active" : ""}`}
              onClick={() => setTab("templates")}
            >
              เทมเพลตสาธารณะ ({templates.length})
            </button>
          </div>

          {busy && <div className="ss-empty">กำลังโหลด…</div>}

          {tab === "mine" ? (
            myRooms.length === 0 ? (
              <div className="ss-empty">
                ยังไม่มีห้องที่บันทึกไว้ — ตั้งชื่อด้านบนแล้วกด
                &quot;บันทึกห้องนี้&quot;
              </div>
            ) : (
              <div className="ss-grid">
                {myRooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    owned
                    busy={busy}
                    active={room.id === activeCloudRoomId}
                    onOpen={handleOpen}
                    onCopyLink={handleCopyLink}
                    onRename={handleRenameSubmit}
                    onToggleTemplate={handleToggleTemplate}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )
          ) : templates.length === 0 ? (
            <div className="ss-empty">
              ยังไม่มีเทมเพลตสาธารณะ — ติ๊ก ★ ให้ห้องของคุณเพื่อเผยแพร่
            </div>
          ) : (
            <div className="ss-grid">
              {templates.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  busy={busy}
                  onOpen={handleOpen}
                  onCopyLink={handleCopyLink}
                />
              ))}
            </div>
          )}

          <p className="ss-note">
            ℹ️ เพื่อนที่เปิดลิงก์จะแก้ไขได้ แต่การแก้ไขจะไม่ทับห้องของคุณ
            จนกว่าเพื่อนจะกด &quot;บันทึกเป็นสำเนาของฉัน&quot;
          </p>
        </div>
      </div>
    </div>
  );
}
