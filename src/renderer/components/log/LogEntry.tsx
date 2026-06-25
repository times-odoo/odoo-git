import React from 'react';
import { Badge } from '../shared/Badge';
import type { LogEntry } from '../../../types.d';

interface LogEntryRowProps {
  entry: LogEntry;
  onClick?: () => void;
}

export function LogEntryRow({ entry, onClick }: LogEntryRowProps) {
  // Parse Odoo commit format: [TAG] module: message
  const match = entry.message.match(/^\[(\w+)\]\s*([^:]+?):\s*(.+)$/);
  const tag = match?.[1];
  const module = match?.[2];
  const message = match?.[3] || entry.message;

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 text-[13px] cursor-pointer transition-colors border-b border-border/30 hover:bg-border/20"
      onClick={onClick}
    >
      <span className="font-mono text-[11px] text-muted shrink-0 w-[90px]">
        {entry.hashShort}
      </span>

      {tag && <Badge tag={tag} />}

      {module && (
        <span className="font-mono text-[11px] text-warning shrink-0 max-w-[120px] truncate">
          {module}
        </span>
      )}

      <span className="text-primary truncate flex-1 min-w-0">
        {message}
      </span>

      <span className="text-muted text-[11px] shrink-0 ml-1 max-w-[100px] truncate">
        {entry.author}
      </span>

      <span className="text-muted text-[11px] shrink-0 ml-1 w-36 text-right font-mono whitespace-nowrap">
        {entry.date}
      </span>
    </div>
  );
}
