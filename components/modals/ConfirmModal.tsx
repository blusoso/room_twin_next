// components/modals/ConfirmModal.tsx
"use client";
import { useConfirmStore } from "./useModalStores";
import { Button, Modal } from "@/components/ui";

export default function ConfirmModal() {
  const open = useConfirmStore((s) => s.open);
  const message = useConfirmStore((s) => s.message);
  const closeConfirm = useConfirmStore((s) => s.closeConfirm);
  const confirm = useConfirmStore((s) => s.confirm);

  return (
    <Modal
      open={open}
      onClose={closeConfirm}
      overlayClass="confirm-overlay"
      boxClass="confirm-box"
    >
      <div
        className="confirm-msg"
        dangerouslySetInnerHTML={{ __html: message }}
      />
      <div className="confirm-actions">
        <Button variant="secondary" size="md" style={{ flex: 1 }} onClick={closeConfirm}>
          ยกเลิก
        </Button>
        <Button variant="danger" size="md" style={{ flex: 1 }} onClick={confirm}>
          ยืนยัน
        </Button>
      </div>
    </Modal>
  );
}