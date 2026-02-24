import { X } from "lucide-react";

export interface TerminalToastState {
  message: string;
  open: boolean;
  seq: number;
}

export function TerminalToast({
  toast,
  onClose,
}: {
  toast: TerminalToastState;
  onClose: () => void;
}) {
  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2">
      <div
        className={
          toast.open
            ? "exposure-toast exposure-toast--open"
            : "exposure-toast exposure-toast--closing"
        }
        role="status"
        aria-live="polite"
      >
        <div className="exposure-toast-accent" aria-hidden="true" />
        <div className="min-w-0 flex-1 text-sm font-semibold text-gray-900">
          {toast.message}
        </div>
        <button
          type="button"
          className="exposure-toast-close"
          aria-label="Dismiss"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
        {toast.open && (
          <div className="exposure-toast-progress" aria-hidden="true">
            <div key={toast.seq} className="exposure-toast-progress-bar" />
          </div>
        )}
      </div>
    </div>
  );
}
