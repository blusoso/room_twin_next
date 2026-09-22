// components/cart/ConfirmDialog.tsx
"use client";

import { Button, Modal } from "@/components/ui";

interface Props {
  open: boolean;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmDialog({
  open,
  message,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      overlayClass="confirm-overlay"
      boxClass="confirm-box"
    >
      <div
        className="confirm-msg"
        dangerouslySetInnerHTML={{ __html: message }}
      />
      <div className="confirm-actions">
        <Button
          variant="secondary"
          size="md"
          style={{ flex: 1 }}
          onClick={onCancel}
        >
          ยกเลิก
        </Button>
        <Button
          variant="danger"
          size="md"
          style={{ flex: 1 }}
          onClick={onConfirm}
        >
          ยืนยัน
        </Button>
      </div>
    </Modal>
  );
}