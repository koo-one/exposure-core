import { useState, useRef, useEffect, useCallback } from 'react';

export interface TerminalToastState {
  message: string;
  open: boolean;
  seq: number;
}

export function useTerminalToast() {
  const [terminalToast, setTerminalToast] = useState<TerminalToastState | null>(null);
  const terminalToastSeq = useRef(0);
  const terminalToastCloseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const terminalToastRemoveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeTerminalToast = useCallback(() => {
    setTerminalToast((prev) => (prev ? { ...prev, open: false } : prev));
    if (terminalToastRemoveTimeout.current) clearTimeout(terminalToastRemoveTimeout.current);
    terminalToastRemoveTimeout.current = setTimeout(() => setTerminalToast(null), 180);
  }, []);

  const showTerminalToast = useCallback((message: string) => {
    terminalToastSeq.current += 1;
    setTerminalToast({ message, open: true, seq: terminalToastSeq.current });

    if (terminalToastCloseTimeout.current) clearTimeout(terminalToastCloseTimeout.current);
    if (terminalToastRemoveTimeout.current) clearTimeout(terminalToastRemoveTimeout.current);
    terminalToastCloseTimeout.current = setTimeout(closeTerminalToast, 2600);
  }, [closeTerminalToast]);

  useEffect(() => {
    return () => {
      if (terminalToastCloseTimeout.current) clearTimeout(terminalToastCloseTimeout.current);
      if (terminalToastRemoveTimeout.current) clearTimeout(terminalToastRemoveTimeout.current);
    };
  }, []);

  return {
    terminalToast,
    showTerminalToast,
    closeTerminalToast,
  };
}
