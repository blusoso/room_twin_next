// components/cart/ConfirmDialog.tsx
"use client";

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
    <div
      className={`confirm-overlay${open ? " show" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="confirm-box">
        <div
          className="confirm-msg"
          dangerouslySetInnerHTML={{ __html: message }}
        />
        <div className="confirm-actions">
          <button
            type="button"
            className="confirm-cancel"
            onClick={onCancel}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            className="confirm-ok"
            onClick={onConfirm}
          >
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
}