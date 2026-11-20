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
        const iconConfig =
          toast.type === 'success'
            ? {
                Icon: CheckCircle2,
                badgeBg: 'bg-[#bcfe90] text-[#1c1917]',
                borderColor: 'border-[#bcfe90]',
              }
            : toast.type === 'error'
              ? {
                  Icon: AlertCircle,
                  badgeBg: 'bg-[#fcd0f8] text-[#991b1b]',
                  borderColor: 'border-[#fcd0f8]',
                }
              : {
                  Icon: Info,
                  badgeBg: 'bg-[#287A65]/15 text-[#287A65]',
                  borderColor: 'border-[#287A65]/30',
                };

        const { Icon, badgeBg } = iconConfig;

        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 rounded-2xl glass-surface px-4 py-3 transition-all animate-in fade-in slide-in-from-bottom-2 duration-200 shadow-lg"
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${badgeBg}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug flex-1 pt-0.5">
              {toast.text}
            </p>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="w-6 h-6 rounded-full flex items-center justify-center text-slate-500 hover:bg-white/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer shrink-0"
              aria-label="Cerrar notificación"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
