import React, { useMemo } from 'react';

interface HunkViewProps {
  rawDiff: string;
  viewMode: 'unified' | 'split';
}

interface DiffLine {
  type: 'added' | 'removed' | 'context' | 'header' | 'info';
  content: string;
  oldLine?: number;
  newLine?: number;
}

function parseDiff(raw: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of raw.split('\n')) {
    if (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) {
      lines.push({ type: 'info', content: line });
      continue;
    }

    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      lines.push({ type: 'header', content: line });
      continue;
    }

    if (line.startsWith('+')) {
      lines.push({ type: 'added', content: line.slice(1), newLine: newLine++ });
    } else if (line.startsWith('-')) {
      lines.push({ type: 'removed', content: line.slice(1), oldLine: oldLine++ });
    } else if (line.startsWith(' ') || line === '') {
      lines.push({ type: 'context', content: line.slice(1) || '', oldLine: oldLine++, newLine: newLine++ });
    }
  }

  return lines;
}

export function HunkView({ rawDiff, viewMode }: HunkViewProps) {
  const diffLines = useMemo(() => parseDiff(rawDiff), [rawDiff]);

  // Only render first 500 lines for performance, rest on demand
  const visibleLines = diffLines.slice(0, 500);
  const hasMore = diffLines.length > 500;

  if (viewMode === 'split') {
    return <SplitView lines={visibleLines} hasMore={hasMore} totalLines={diffLines.length} />;
  }

  return (
    <div className="font-mono text-code leading-[18px]">
      {visibleLines.map((line, i) => {
        if (line.type === 'info') {
          return (
            <div key={i} className="px-3 py-0.5 text-muted text-[11px] bg-bg border-b border-border">
              {line.content}
            </div>
          );
        }
        if (line.type === 'header') {
          return (
            <div key={i} className="px-3 py-1 text-accent/70 bg-accent/5 border-y border-border text-[11px]">
              {line.content}
            </div>
          );
        }

        const bgClass =
          line.type === 'added' ? 'bg-diff-add-bg' :
          line.type === 'removed' ? 'bg-diff-remove-bg' : '';

        const textClass =
          line.type === 'added' ? 'text-diff-add-text' :
          line.type === 'removed' ? 'text-diff-remove-text' : 'text-primary';

        return (
          <div key={i} className={`flex ${bgClass} hover:brightness-110 transition-all`}>
            <span className="w-12 text-right text-muted text-[10px] pr-2 select-none shrink-0 py-px border-r border-border/50">
              {line.oldLine ?? ''}
            </span>
            <span className="w-12 text-right text-muted text-[10px] pr-2 select-none shrink-0 py-px border-r border-border/50">
              {line.newLine ?? ''}
            </span>
            <span className="w-4 text-center select-none shrink-0 py-px text-[11px]" style={{ color: line.type === 'added' ? '#3FB950' : line.type === 'removed' ? '#F85149' : 'transparent' }}>
              {line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}
            </span>
            <span className={`flex-1 px-2 py-px whitespace-pre ${textClass}`}>
              {line.content}
            </span>
          </div>
        );
      })}

      {hasMore && (
        <div className="text-center py-3 text-muted text-[12px] bg-bg border-t border-border">
          Showing {visibleLines.length} of {diffLines.length} lines
        </div>
      )}
    </div>
  );
}

function SplitView({ lines, hasMore, totalLines }: { lines: DiffLine[]; hasMore: boolean; totalLines: number }) {
  // Build paired lines for split view
  const pairs: { left: DiffLine | null; right: DiffLine | null }[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.type === 'info' || line.type === 'header') {
      pairs.push({ left: line, right: line });
      i++;
      continue;
    }

    if (line.type === 'removed') {
      // Look ahead for matching added
      if (i + 1 < lines.length && lines[i + 1].type === 'added') {
        pairs.push({ left: line, right: lines[i + 1] });
        i += 2;
        continue;
      }
      pairs.push({ left: line, right: null });
      i++;
      continue;
    }

    if (line.type === 'added') {
      pairs.push({ left: null, right: line });
      i++;
      continue;
    }

    pairs.push({ left: line, right: line });
    i++;
  }

  return (
    <div className="font-mono text-code leading-[18px]">
      {pairs.map((pair, idx) => {
        if (pair.left?.type === 'info') {
          return (
            <div key={idx} className="px-3 py-0.5 text-muted text-[11px] bg-bg border-b border-border">
              {pair.left.content}
            </div>
          );
        }
        if (pair.left?.type === 'header') {
          return (
            <div key={idx} className="px-3 py-1 text-accent/70 bg-accent/5 border-y border-border text-[11px]">
              {pair.left.content}
            </div>
          );
        }

        return (
          <div key={idx} className="flex">
            {/* Left (old) */}
            <div className={`flex-1 flex border-r border-border ${pair.left?.type === 'removed' ? 'bg-diff-remove-bg' : ''}`}>
              <span className="w-10 text-right text-muted text-[10px] pr-1.5 select-none shrink-0 py-px border-r border-border/50">
                {pair.left?.oldLine ?? ''}
              </span>
              <span className={`flex-1 px-2 py-px whitespace-pre ${pair.left?.type === 'removed' ? 'text-diff-remove-text' : 'text-primary'}`}>
                {pair.left?.content ?? ''}
              </span>
            </div>
            {/* Right (new) */}
            <div className={`flex-1 flex ${pair.right?.type === 'added' ? 'bg-diff-add-bg' : ''}`}>
              <span className="w-10 text-right text-muted text-[10px] pr-1.5 select-none shrink-0 py-px border-r border-border/50">
                {pair.right?.newLine ?? ''}
              </span>
              <span className={`flex-1 px-2 py-px whitespace-pre ${pair.right?.type === 'added' ? 'text-diff-add-text' : 'text-primary'}`}>
                {pair.right?.content ?? ''}
              </span>
            </div>
          </div>
        );
      })}

      {hasMore && (
        <div className="text-center py-3 text-muted text-[12px] bg-bg border-t border-border">
          Showing first 500 of {totalLines} lines
        </div>
      )}
    </div>
  );
}
