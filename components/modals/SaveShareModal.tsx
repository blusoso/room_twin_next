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
import { useCallback, useEffect, useRef, useState } from "react";
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
import { applyCloudRoom } from "@/lib/cloud/sharedRoomBoot";
import { saveSharedAsCopy } from "@/lib/cloud/saveCopy";
import { saveToStorage } from "@/lib/state/storage";
import { captureRoomThumbnail } from "@/lib/three/screenshot";
import { absoluteTimeTh, relativeTimeTh } from "@/lib/utils/format";
import {
  DEFAULT_ROOM_NAME,
  MAX_ROOM_NAME,
  normalizeRoomName,
  shareUrlOf,
  type CloudRoomFull,
  type CloudRoomSummary,
} from "@/lib/shared/roomShare";
import { showToast } from "@/lib/utils/toast";
import { openConfirm, useSaveShareStore } from "./useModalStores";
import RoomCard, { RoomCardSkeleton, RoomThumb } from "./RoomCard";
import {
  Button,
  IconButton,
  Modal,
  EmptyState,
  SegmentedControl,
} from "@/components/ui";

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
  /**
   * ⭐ รายการแยกต่อแท็บ — null = ยังไม่โหลด
   *    โหลดเฉพาะแท็บที่ผู้ใช้กำลังดู (เดิมยิง listRooms + listTemplates พร้อมกันทุกครั้งที่เปิด)
   */
  const [lists, setLists] = useState<Record<Tab, CloudRoomSummary[] | null>>({
    mine: null,
    templates: null,
  });
  const [loadingTab, setLoadingTab] = useState<Tab | null>(null);
  const [listError, setListError] = useState<{
    tab: Tab;
    message: string;
  } | null>(null);
  /** การ์ดที่กำลังเปิดอยู่ (โชว์ spinner เฉพาะใบนั้น) */
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [currentPreview, setCurrentPreview] = useState<string | null>(null);

  // ⭐ ref คู่กับ state เพื่ออ่านค่าล่าสุดใน callback โดยไม่ทำให้ deps เปลี่ยน
  const listsRef = useRef(lists);
  useEffect(() => {
    listsRef.current = lists;
  }, [lists]);
  const inFlightTabRef = useRef<Tab | null>(null);
  const loadSeqRef = useRef(0);

  /**
   * ⭐ โหลดรายการของ "แท็บเดียว" — ใช้ cache ถ้าโหลดแล้ว (force = โหลดใหม่)
   *    ผลลัพธ์ที่มาถึงช้ากว่าจะถูกทิ้ง (seq guard) จึงสลับแท็บเร็ว ๆ ได้ปลอดภัย
   */
  const loadTab = useCallback(
    async (target: Tab, opts?: { force?: boolean }): Promise<void> => {
      if (inFlightTabRef.current === target) return;
      if (!opts?.force && listsRef.current[target] !== null) return;

      const seq = ++loadSeqRef.current;
      inFlightTabRef.current = target;
      setLoadingTab(target);
      setListError(null);

      try {
        const rooms =
          target === "mine" ? await listRooms() : await listTemplates();
        if (seq !== loadSeqRef.current) return;
        setLists((prev) => ({ ...prev, [target]: rooms }));
      } catch (err) {
        if (seq !== loadSeqRef.current) return;
        console.error("[SaveShareModal] load", target, err);
        setListError({
          tab: target,
          message: err instanceof Error ? err.message : "โหลดรายการไม่สำเร็จ",
        });
      } finally {
        if (seq === loadSeqRef.current) {
          inFlightTabRef.current = null;
          setLoadingTab(null);
        }
      }
    },
    [],
  );

  /** สลับแท็บ + โหลดครั้งแรกของแท็บนั้น */
  const switchTab = useCallback(
    (next: Tab) => {
      setTab(next);
      setListError(null);
      if (listsRef.current[next] === null) loadTab(next);
    },
    [loadTab],
  );

  // ⭐ ตอนเปิด modal: ถ่ายภาพมุมกล้องปัจจุบัน + ตั้งชื่อไฟล์ให้ตรงกับห้องที่ผูกอยู่
  useEffect(() => {
    if (!open) return;

    setTab("mine");
    setListError(null);
    setCurrentPreview(captureRoomThumbnail());

    const sharedName = useRoomTwin.getState().sharedRoomName;
    setName(
      sharedName
        ? `${sharedName} (สำเนา)`.slice(0, MAX_ROOM_NAME)
        : DEFAULT_ROOM_NAME,
    );

    let alive = true;
    (async () => {
      await loadTab("mine");
      if (!alive) return;
      const id = useRoomTwin.getState().activeCloudRoomId;
      const act = (listsRef.current.mine ?? []).find((r) => r.id === id);
      if (act) setName(act.name);
    })();

    return () => {
      alive = false;
    };
  }, [open, loadTab]);

  /** ⭐ เอา snapshot ของห้องจากเซิร์ฟเวอร์ขึ้นเป็นห้องปัจจุบันของ editor */
  const applyRoom = useCallback((full: CloudRoomFull) => {
    applyCloudRoom(full);
  }, []);

  /** ⭐ ถ่ายภาพใหม่ตอนกดบันทึก เพื่อให้ preview ตรงกับสิ่งที่เพิ่งบันทึก */
  const shot = () => captureRoomThumbnail() ?? undefined;

  const handleSaveNew = async () => {
    const finalName = normalizeRoomName(name);
    const preview = shot();
    setBusy(true);
    try {
      const room = await createRoom({
        name: finalName,
        data: serialize(),
        preview,
      });
      setActiveCloudRoomId(room.id);
      setStoredActiveRoomId(room.id);
      saveToStorage(serialize());
      setName(finalName);
      if (preview) setCurrentPreview(preview);
      showToast(`บันทึก "${room.name}" แล้ว`);
      await loadTab("mine", { force: true });
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
      await loadTab("mine", { force: true });
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
      await loadTab("mine", { force: true });
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
        setOpeningId(room.id);
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
          setOpeningId(null);
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
        await loadTab("mine", { force: true });
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
      // ⭐ สมาชิกของทั้งสองแท็บเปลี่ยน → โหลดใหม่เท่าที่เคยโหลดไว้
      await loadTab("mine", { force: true });
      if (listsRef.current.templates !== null) {
        await loadTab("templates", { force: true });
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "แก้ไขไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const handleRenameSubmit = async (room: CloudRoomSummary, value: string) => {
    const finalName = normalizeRoomName(value, room.name);
    setBusy(true);
    try {
      await updateRoom(room.id, { name: finalName });
      await loadTab("mine", { force: true });
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

  const myRooms = lists.mine;
  const templates = lists.templates;
  const activeRoom =
    (myRooms ?? []).find((r) => r.id === activeCloudRoomId) ?? null;
  const heroPreview = currentPreview ?? activeRoom?.preview ?? "";
  const heroName = sharedRoomId
    ? `👀 กำลังดูห้องที่แชร์: ${sharedRoomName ?? "ไม่มีชื่อ"}`
    : (activeRoom?.name ?? "ห้องนี้ยังไม่ถูกบันทึกบนเซิร์ฟเวอร์");

  // ⭐ สถานะของแท็บที่กำลังแสดง (โหลดเฉพาะแท็บนี้)
  const currentList = lists[tab];
  const tabLoading = currentList === null || loadingTab === tab;
  const tabError = listError?.tab === tab ? listError : null;
  const mineLoading = lists.mine === null;

  return (
    <Modal
      open={open}
      onClose={close}
      overlayClass="save-share-overlay"
      boxClass="save-share-box"
    >
      <div className="ss-head">
        <h3>💾 บันทึก / แชร์ห้อง</h3>
        <IconButton label="ปิด" size="md" onClick={close}>
          ✕
        </IconButton>
      </div>

      <div className="ss-body" aria-busy={loadingTab !== null}>
        {/* ===== 1) ห้องที่กำลังแก้ไข ===== */}
        <section className="ss-hero">
          <RoomThumb src={heroPreview} />
          <div className="ss-hero-info">
            <span className="ss-hero-title" title={heroName}>
              {heroName}
            </span>
            {mineLoading && !sharedRoomId ? (
              // ⭐ ระหว่างโหลดรายการ "ห้องของฉัน" — skeleton แทนข้อความที่อาจกระพริบผิด
              <span className="ss-hero-skel rt-shimmer" aria-hidden="true" />
            ) : (
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
            )}

            <input
              className="ss-input"
              value={name}
              maxLength={MAX_ROOM_NAME}
              placeholder="ตั้งชื่อไฟล์ เช่น ห้องนอน 3x4"
              onChange={(e) => setName(e.target.value)}
            />

            <div className="ss-actions">
              {sharedRoomId ? (
                <Button
                  variant="copper"
                  size="md"
                  disabled={busy}
                  onClick={handleSaveCopyOfShared}
                >
                  📄 บันทึกเป็นสำเนาของฉัน
                </Button>
              ) : activeCloudRoomId ? (
                <>
                  <Button
                    variant="copper"
                    size="md"
                    disabled={busy}
                    onClick={handleSaveOver}
                  >
                    💾 บันทึกทับ
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={busy}
                    onClick={handleSaveNew}
                  >
                    ＋ บันทึกเป็นไฟล์ใหม่
                  </Button>
                </>
              ) : (
                <Button
                  variant="copper"
                  size="md"
                  disabled={busy}
                  onClick={handleSaveNew}
                >
                  💾 บันทึกห้องนี้
                </Button>
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
              <Button
                variant="copper"
                size="md"
                onClick={() =>
                  handleCopyLink({
                    id: activeCloudRoomId,
                  } as CloudRoomSummary)
                }
              >
                คัดลอก
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() =>
                  window.open(shareUrlOf(activeCloudRoomId), "_blank")
                }
              >
                เปิด
              </Button>
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

        {/* ===== 3) รายการห้อง (โหลดเฉพาะแท็บที่กำลังดู) ===== */}
        <SegmentedControl
          containerClass="ss-tabs"
          optionClass="ss-tab"
          value={tab}
          onChange={switchTab}
          options={[
            {
              value: "mine",
              label: `ห้องของฉัน (${myRooms ? myRooms.length : "…"})`,
            },
            {
              value: "templates",
              label: `เทมเพลตสาธารณะ (${templates ? templates.length : "…"})`,
            },
          ]}
        />

        {tabError ? (
          <div className="ss-error">
            <span className="ss-error-text">⚠️ {tabError.message}</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadTab(tab, { force: true })}
            >
              ลองอีกครั้ง
            </Button>
          </div>
        ) : tabLoading ? (
          // ⭐ skeleton การ์ดห้อง 4 ใบ ระหว่างโหลดรายการ
          <div className="ss-grid" aria-hidden="true">
            <RoomCardSkeleton />
            <RoomCardSkeleton />
            <RoomCardSkeleton />
            <RoomCardSkeleton />
          </div>
        ) : tab === "mine" ? (
          (currentList ?? []).length === 0 ? (
            <EmptyState
              icon="💾"
              title="ยังไม่มีห้องที่บันทึกไว้"
              sub='ตั้งชื่อด้านบนแล้วกด "บันทึกห้องนี้"'
            />
          ) : (
            <div className="ss-grid">
              {(currentList ?? []).map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  owned
                  busy={busy}
                  opening={openingId === room.id}
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
        ) : (currentList ?? []).length === 0 ? (
          <EmptyState
            icon="⭐"
            title="ยังไม่มีเทมเพลตสาธารณะ"
            sub="ติ๊ก ★ ให้ห้องของคุณเพื่อเผยแพร่"
          />
        ) : (
          <div className="ss-grid">
            {(currentList ?? []).map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                busy={busy}
                opening={openingId === room.id}
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
    </Modal>
  );
}
