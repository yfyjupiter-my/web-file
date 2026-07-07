"use client";

import { useModalA11y } from "./useModalA11y";

interface Props {
  files: { id: string; name: string }[];
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmModal({ files, pending, onCancel, onConfirm }: Props) {
  // Escape must not cancel once the deletes are already in flight.
  const overlayRef = useModalA11y(() => {
    if (!pending) onCancel();
  });
  const title =
    files.length === 1 ? `Delete "${files[0].name}"?` : `Delete ${files.length} installers?`;

  return (
    <div
      ref={overlayRef}
      tabIndex={-1}
      className="toast-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-label="Confirm delete"
    >
      <div className="toast">
        <div className="toast-strip" />
        <div className="toast-body">
          <div className="toast-head">
            <div className="ic">!</div>
            <div className="toast-title">{title}</div>
          </div>
          <div className="toast-text">
            This can&apos;t be undone. The file{files.length > 1 ? "s are" : " is"} removed for
            everyone with access.
          </div>
          <div className="toast-actions">
            <button className="btn ghost" onClick={onCancel} disabled={pending}>
              Cancel
            </button>
            <button className="btn" onClick={onConfirm} disabled={pending}>
              {pending ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
