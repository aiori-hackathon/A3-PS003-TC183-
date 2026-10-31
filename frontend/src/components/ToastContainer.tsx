import React from 'react';
import { useApp } from '../context/AppContext';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const borderColors = {
          success: 'border-l-4 border-on-tertiary-container bg-surface-container-lowest text-on-surface shadow-lg',
          info: 'border-l-4 border-secondary bg-surface-container-lowest text-on-surface shadow-lg',
          warning: 'border-l-4 border-amber-500 bg-surface-container-lowest text-on-surface shadow-lg',
          error: 'border-l-4 border-error bg-surface-container-lowest text-on-surface shadow-lg',
        };

        const icons = {
          success: 'check_circle',
          info: 'info',
          warning: 'warning',
          error: 'error',
        };

        const iconColors = {
          success: 'text-on-tertiary-container',
          info: 'text-secondary',
          warning: 'text-amber-500',
          error: 'text-error',
        };

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-xl transition-all duration-300 transform translate-y-0 opacity-100 flex items-start justify-between gap-3 ${borderColors[toast.type]}`}
          >
            <div className="flex items-start gap-2.5">
              <span className={`material-symbols-outlined text-[20px] shrink-0 mt-0.5 ${iconColors[toast.type]}`}>
                {icons[toast.type]}
              </span>
              <div className="flex flex-col">
                <span className="font-headline-sm text-body-md font-bold text-on-surface leading-tight">
                  {toast.title}
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 leading-normal">
                  {toast.message}
                </span>
              </div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors shrink-0"
              aria-label="Dismiss toast"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
};

