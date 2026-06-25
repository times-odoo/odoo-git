import React from 'react';
import { useUIStore } from '../../store/ui';

export function Toast() {
  const { toasts, removeToast } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-16 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const colors = {
          success: 'border-success/40 bg-success/10 text-diff-add-text',
          error: 'border-danger/40 bg-danger/10 text-diff-remove-text',
          warning: 'border-warning/40 bg-warning/10 text-warning',
          info: 'border-accent/40 bg-accent/10 text-accent',
        };

        const icons = {
          success: (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ),
          error: (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M4 4L10 10M10 4L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          ),
          warning: (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 4V8M7 10V10.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          ),
          info: (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 6V10M7 4V4.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          ),
        };

        return (
          <div
            key={toast.id}
            className={`slide-in flex items-center gap-2 px-3 py-2 rounded border text-[13px] ${colors[toast.type]} cursor-pointer`}
            onClick={() => removeToast(toast.id)}
          >
            {icons[toast.type]}
            <span className="flex-1">{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
}
