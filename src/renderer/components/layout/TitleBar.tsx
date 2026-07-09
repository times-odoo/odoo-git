import React from 'react';

export function TitleBar() {
  return (
    <div className="h-10 bg-surface border-b border-border flex items-center justify-between px-3 drag-region select-none shrink-0">
      <div className="flex items-center gap-2 no-drag">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-accent">
          <path
            d="M12 2L3 7V17L12 22L21 17V7L12 2Z"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <circle cx="12" cy="9" r="2" fill="currentColor" />
          <path d="M12 11V17" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 14L9 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M12 14L15 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="text-[13px] font-semibold text-primary tracking-tight">OdooGit</span>
      </div>

      <div className="flex items-center no-drag">
        <button
          className="px-3 h-10 flex items-center justify-center gap-1.5 text-muted hover:text-accent hover:bg-border/30 transition-colors text-[11px] font-semibold"
          onClick={() => {
            localStorage.removeItem('odoogit_hasSeenTour');
            window.location.reload();
          }}
          title="Start walkthrough tour"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Help Tour
        </button>
        <button
          className="w-10 h-10 flex items-center justify-center text-muted hover:text-primary hover:bg-border/30 transition-colors"
          onClick={() => window.git.minimizeWindow()}
          title="Minimize"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M2 6H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <button
          className="w-10 h-10 flex items-center justify-center text-muted hover:text-primary hover:bg-border/30 transition-colors"
          onClick={() => window.git.maximizeWindow()}
          title="Maximize"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="2" width="8" height="8" stroke="currentColor" strokeWidth="1.2" fill="none" rx="1" />
          </svg>
        </button>
        <button
          className="w-10 h-10 flex items-center justify-center text-muted hover:text-white hover:bg-danger transition-colors"
          onClick={() => window.git.closeWindow()}
          title="Close"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
