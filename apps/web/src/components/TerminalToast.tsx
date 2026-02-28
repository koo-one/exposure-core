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
    <div 
      className={`fixed bottom-8 left-1/2 z-50 w-[min(92vw,480px)] -translate-x-1/2 transition-all duration-300 ease-out ${
        toast.open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
      }`}
    >
      <div
        className="relative flex items-center gap-4 p-5 bg-[#0D0D0D]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden"
        role="status"
        aria-live="polite"
      >
        {/* Left accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#00FF85]" aria-hidden="true" />
        
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">System Message</div>
          <div className="text-sm font-bold text-white tracking-tight font-mono">
            {toast.message}
          </div>
        </div>

        <button
          type="button"
          className="p-2 hover:bg-white/5 rounded-md transition-colors text-white/40 hover:text-[#FF4D4D]"
          aria-label="Dismiss"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Progress bar */}
        {toast.open && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5" aria-hidden="true">
            <div 
              key={toast.seq} 
              className="h-full bg-[#00FF85] origin-left"
              style={{ animation: 'exposure-toast-progress 2600ms linear forwards' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
