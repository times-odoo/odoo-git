import React from 'react';
import { useGitStore } from '../../store/git';
import { useRepoStore } from '../../store/repos';
import { useUIStore } from '../../store/ui';

export function StatusBar() {
  const activeRepoPath = useRepoStore((s) => s.activeRepoPath);
  const repoState = useGitStore((s) => (activeRepoPath ? s.repoStates[activeRepoPath] : null));
  const setActivePanel = useUIStore((s) => s.setActivePanel);
  const terminalOpen = useUIStore((s) => s.terminalOpen);
  const toggleTerminal = useUIStore((s) => s.toggleTerminal);

  const status = repoState?.status;

  const items = status && activeRepoPath ? [
    { label: status.current || 'detached', icon: null, accent: true },
    { label: `M ${status.modified.length}`, icon: null, count: status.modified.length, panel: 'diff' as const },
    { label: `A ${status.staged.length}`, icon: null, count: status.staged.length, panel: 'diff' as const },
    { label: `D ${status.deleted.length}`, icon: null, count: status.deleted.length, panel: 'diff' as const },
    { label: `? ${status.untracked.length}`, icon: null, count: status.untracked.length, panel: 'diff' as const },
    { label: `↑ ${status.ahead}`, icon: null, count: status.ahead, panel: 'log' as const },
    { label: `↓ ${status.behind}`, icon: null, count: status.behind, panel: 'log' as const },
  ] : [];

  return (
    <div className="h-6 bg-surface border-t border-border flex items-center px-3 gap-3 text-[11px] shrink-0 select-none">
      {items.length === 0 ? (
        <span className="text-muted">No repository</span>
      ) : (
        items.map((item, i) => {
          if (i === 0) {
            return (
              <span key={i} className="font-mono text-accent text-[11px]">
                {item.label}
              </span>
            );
          }
          return (
            <button
              key={i}
              className={`font-mono transition-colors ${
                item.count && item.count > 0 ? 'text-primary hover:text-accent cursor-pointer' : 'text-muted cursor-default'
              }`}
              onClick={() => {
                if (item.count && item.count > 0 && item.panel) {
                  setActivePanel(item.panel);
                }
              }}
            >
              {item.label}
            </button>
          );
        })
      )}

      <div className="flex-1" />

      {repoState?.lastFetched && (
        <span className="text-muted text-[10px] mr-2">
          fetched {new Date(repoState.lastFetched).toLocaleTimeString()}
        </span>
      )}

      <button
        onClick={toggleTerminal}
        className={`flex items-center gap-1.5 px-2 h-4 rounded transition-all duration-200 ${
          terminalOpen
            ? 'bg-accent/25 text-accent border border-accent/40 font-semibold'
            : 'text-muted hover:text-primary hover:bg-border/30 border border-transparent'
        }`}
        title="Toggle Git Terminal Output"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M2 3H14V13H2V3Z" stroke="currentColor" strokeWidth="1.2" />
          <path d="M2 9H14" stroke="currentColor" strokeWidth="1.2" />
          <path d="M4 6L5.5 7.5L4 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Terminal</span>
      </button>
    </div>
  );
}
