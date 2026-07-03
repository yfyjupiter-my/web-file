interface Props {
  fileName: string;
  onKeepBoth: () => void;
  onReplace: () => void;
}

export function ConflictToast({ fileName, onKeepBoth, onReplace }: Props) {
  return (
    <div className="toast-wrap" style={{ position: "fixed", inset: 0, background: "rgba(58,43,38,0.35)", zIndex: 10 }}>
      <div className="toast">
        <div className="toast-strip" />
        <div className="toast-body">
          <div className="toast-head">
            <div className="ic">⚠</div>
            <div className="toast-title">File already exists</div>
          </div>
          <div className="toast-text">
            An installer named <b>{fileName}</b> is already in this category. Replacing it will overwrite the
            existing version for everyone.
          </div>
          <div className="toast-text">Keep both to save this upload as a separate copy.</div>
          <div className="toast-actions">
            <button className="btn ghost" onClick={onKeepBoth}>
              Keep Both
            </button>
            <button className="btn" onClick={onReplace}>
              Replace File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
