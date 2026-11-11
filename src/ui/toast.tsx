import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastCtx = createContext<(message: string, kind?: ToastKind) => void>(() => {});

export const useToast = () => useContext(ToastCtx);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-3), { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3200);
    },
    [dismiss]
  );

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] flex flex-col items-center gap-2 pointer-events-none w-[min(92vw,420px)]" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-in pointer-events-auto w-full flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-raised/95 backdrop-blur border border-line-strong shadow-2xl shadow-black/60 text-sm"
          >
            {t.kind === 'success' && <CheckCircle2 className="w-4 h-4 mt-0.5 text-acid shrink-0" />}
            {t.kind === 'error' && <AlertTriangle className="w-4 h-4 mt-0.5 text-danger shrink-0" />}
            {t.kind === 'info' && <Info className="w-4 h-4 mt-0.5 text-dim shrink-0" />}
            <span className="flex-1 text-fg/90 leading-snug">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="text-faint hover:text-fg" aria-label="Chiudi notifica">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
};
