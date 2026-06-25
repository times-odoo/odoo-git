import React, { useEffect, useRef, useState } from 'react';
import { useUIStore } from '../../store/ui';

export function TerminalPanel() {
  const terminalLogs = useUIStore((s) => s.terminalLogs);
  const clearTerminalLogs = useUIStore((s) => s.clearTerminalLogs);
  const toggleTerminal = useUIStore((s) => s.toggleTerminal);

  const bottomRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  const toggleExpand = (commandId: string) => {
    setExpanded((prev) => ({ ...prev, [commandId]: !prev[commandId] }));
  };

  return (
    <div className="h-64 bg-[#0D1117] border-t border-border flex flex-col shrink-0 font-mono text-[12px] text-[#C9D1D9] z-40">
      {/* Header */}
      <div className="h-8 bg-[#161B22] border-b border-border flex items-center justify-between px-3 select-none">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="font-semibold text-[11px] tracking-wider text-muted">GIT OUTPUT LOG</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={clearTerminalLogs}
            className="text-muted hover:text-primary transition-colors text-[11px]"
            title="Clear Logs"
          >
            Clear
          </button>
          <button
            onClick={toggleTerminal}
            className="text-muted hover:text-danger transition-colors text-[14px]"
            title="Close Terminal"
          >
            ×
          </button>
        </div>
      </div>

      {/* Output Console */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 selection:bg-accent/30">
        {terminalLogs.length === 0 ? (
          <div className="text-muted text-center py-12 text-[11px]">
            No commands executed yet. Run a Git operation to see logs here.
          </div>
        ) : (
          terminalLogs.map((log) => {
            const lines = log.output.split('\n');
            const hasMore = lines.length > 6;
            const isExpanded = expanded[log.commandId];
            const displayedOutput = isExpanded
              ? log.output
              : (hasMore ? lines.slice(0, 6).join('\n') + '\n...' : log.output);

            return (
              <div
                key={log.commandId}
                className="space-y-1 p-1 rounded hover:bg-white/[0.02] transition-colors cursor-pointer group"
                onClick={() => hasMore && toggleExpand(log.commandId)}
              >
                <div className="flex items-center justify-between text-accent font-semibold select-none">
                  <div className="flex items-center gap-2">
                    <span>$</span>
                    <span>{log.command}</span>
                    {log.status === 'running' && (
                      <svg className="animate-spin text-accent" width="10" height="10" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    )}
                  </div>
                  {hasMore && (
                    <span className="text-[10px] text-muted bg-border/40 px-1.5 py-0.5 rounded font-sans uppercase tracking-wider group-hover:text-primary transition-colors">
                      {isExpanded ? 'Collapse' : 'Expand'}
                    </span>
                  )}
                </div>
                {log.output && (
                  <pre
                    className="pl-4 text-[11px] text-[#8B949E] whitespace-pre-wrap font-mono leading-relaxed select-text cursor-text"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {displayedOutput}
                  </pre>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
