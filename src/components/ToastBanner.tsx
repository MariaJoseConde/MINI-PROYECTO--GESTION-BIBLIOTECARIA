import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface ToastBannerProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

export const ToastBanner: React.FC<ToastBannerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="no-print fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-md w-full px-4 sm:px-0 pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const tone =
          toast.type === 'success'
            ? 'bg-[#FFFFFF] border-[#15803D]/35 text-[#14532D]'
            : toast.type === 'error'
              ? 'bg-[#FFFFFF] border-[#B91C1C]/35 text-[#7F1D1D]'
              : 'bg-[#FFFFFF] border-[#1E3A8A]/35 text-[#1E3A8A]';

        const Icon =
          toast.type === 'success'
            ? CheckCircle2
            : toast.type === 'error'
              ? AlertCircle
              : Info;

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-md transition-all ${tone}`}
          >
            <Icon className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-sm font-medium leading-snug flex-1">{toast.text}</p>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="p-1 -mr-1 rounded hover:bg-black/5 transition-colors"
              aria-label="Cerrar notificación"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
