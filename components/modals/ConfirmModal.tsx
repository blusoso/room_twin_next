// components/modals/ConfirmModal.tsx
"use client";
import { useConfirmStore } from "./useModalStores";

export default function ConfirmModal() {
  const open = useConfirmStore((s) => s.open);
  const message = useConfirmStore((s) => s.message);
  const closeConfirm = useConfirmStore((s) => s.closeConfirm);
  const confirm = useConfirmStore((s) => s.confirm);

  return (
    <div
      className={`confirm-overlay${open ? " show" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeConfirm();
      }}
      aria-hidden={!open}
    >
      <div className="confirm-box" role="dialog" aria-modal="true">
        <div
          className="confirm-msg"
          dangerouslySetInnerHTML={{ __html: message }}
        />
        <div className="confirm-actions">
          <button
            type="button"
            className="confirm-cancel"
            onClick={closeConfirm}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            className="confirm-ok"
            onClick={confirm}
          >
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
}