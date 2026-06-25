import React, { useEffect, useState, useMemo, useDeferredValue, useRef } from 'react';
import { useRepoStore } from '../../store/repos';
import { useGitStore } from '../../store/git';
import { useGit } from '../../hooks/useGit';
import { useUIStore } from '../../store/ui';
import { LogEntryRow } from './LogEntry';
import { AheadBehindView } from './AheadBehindView';
import { FixedSizeList } from 'react-window';
import type { LogEntry } from '../../../types.d';

export function LogPanel() {
  const activeRepoPath = useRepoStore((s) => s.activeRepoPath);
  const repoState = useGitStore((s) => (activeRepoPath ? s.repoStates[activeRepoPath] : null));
  const { refreshLog } = useGit(activeRepoPath);
  const { activeLogTab, setActiveLogTab } = useUIStore();
  const [maxCount, setMaxCount] = useState(50);
  const [compareRef, setCompareRef] = useState('');
  const [compareLog, setCompareLog] = useState<LogEntry[]>([]);
  const [refFilter, setRefFilter] = useState('');
  const deferredRefFilter = useDeferredValue(refFilter);
  const refContainerRef = useRef<HTMLDivElement>(null);
  const [refListHeight, setRefListHeight] = useState(350);

  useEffect(() => {
    const el = refContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setRefListHeight(el.clientHeight - 4);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeLogTab]);

  const filteredRefs = useMemo(() => {
    const list: { type: 'local' | 'remote' | 'header'; name: string }[] = [];
    const lowerFilter = deferredRefFilter.toLowerCase();

    // Local branches
    const localMatches = (repoState?.branches?.local || []).filter(
      (b) => !deferredRefFilter || b.name.toLowerCase().includes(lowerFilter)
    );
    if (localMatches.length > 0) {
      list.push({ type: 'header', name: 'Local Branches' });
      for (const b of localMatches) {
        list.push({ type: 'local', name: b.name });
      }
    }

    // Remote branches
    if (repoState?.branches?.remotes) {
      let addedHeader = false;
      for (const group of repoState.branches.remotes) {
        const remoteMatches = group.branches.filter(
          (b) => !deferredRefFilter || b.name.toLowerCase().includes(lowerFilter)
        );
        if (remoteMatches.length > 0) {
          if (!addedHeader) {
            list.push({ type: 'header', name: 'Remote Branches' });
            addedHeader = true;
          }
          for (const b of remoteMatches) {
            list.push({ type: 'remote', name: b.name });
          }
        }
      }
    }

    return list;
  }, [repoState?.branches, deferredRefFilter]);

  const renderRefRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = filteredRefs[index];
    if (item.type === 'header') {
      return (
        <div style={style} className="text-[10px] uppercase font-bold text-muted px-3.5 py-1.5 bg-surface/50 border-b border-border/10 shrink-0">
          {item.name}
        </div>
      );
    }
    const isSelected = compareRef === item.name;
    return (
      <div style={style} className="px-2 py-0.5">
        <div
          className={`px-2 py-1 rounded text-[11px] font-mono cursor-pointer transition-colors truncate ${
            isSelected
              ? 'bg-accent/15 text-accent border border-accent/20'
              : 'text-primary hover:bg-border/30 border border-transparent'
          }`}
          onClick={() => {
            setCompareRef(item.name);
            loadCompareForRef(item.name);
          }}
          title={item.name}
        >
          {item.name}
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (activeRepoPath && activeLogTab === 'local') {
      refreshLog({ maxCount });
    }
  }, [activeRepoPath, activeLogTab, maxCount]);

  const [loadingCompare, setLoadingCompare] = useState(false);

  const loadCompareForRef = async (refName: string) => {
    if (!activeRepoPath || !refName.trim()) return;
    setLoadingCompare(true);
    try {
      const log = await window.git.log(activeRepoPath, { from: refName.trim(), to: 'HEAD', maxCount: 50 });
      setCompareLog(log);
    } catch {
      setCompareLog([]);
    } finally {
      setLoadingCompare(false);
    }
  };

  const handleLoadMore = () => {
    setMaxCount((prev) => prev + 50);
  };

  const log = repoState?.log || [];
  const isLoading = repoState?.loading.log;

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-border shrink-0">
        {(['local', 'ahead', 'compare'] as const).map((tab) => (
          <button
            key={tab}
            className={`px-3 py-2 text-[12px] font-medium capitalize transition-colors ${
              activeLogTab === tab
                ? 'text-accent border-b-2 border-accent'
                : 'text-muted hover:text-primary'
            }`}
            onClick={() => setActiveLogTab(tab)}
          >
            {tab === 'ahead' ? 'Ahead / Behind' : tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeLogTab === 'ahead' && activeRepoPath ? (
          <AheadBehindView repoPath={activeRepoPath} />
        ) : activeLogTab === 'compare' ? (
          <div className="flex h-full overflow-hidden">
            {/* Left Column: Refs Selector */}
            <div className="w-60 border-r border-border flex flex-col bg-surface/30 shrink-0">
              <div className="section-header px-3 py-2 border-b border-border bg-surface shrink-0">
                CHOOSE REFERENCE
              </div>
              <div className="p-2 border-b border-border bg-surface/50 shrink-0">
                <div className="relative">
                  <svg
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
                    width="12" height="12" viewBox="0 0 14 14" fill="none"
                  >
                    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  <input
                    type="text"
                    className="input-field pl-7 py-1 text-[11px] h-7"
                    placeholder="Filter references..."
                    value={refFilter}
                    onChange={(e) => setRefFilter(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex-1 overflow-hidden" ref={refContainerRef}>
                {filteredRefs.length === 0 ? (
                  <div className="text-muted text-center py-4 text-[11px]">No matches found</div>
                ) : (
                  <FixedSizeList
                    height={refListHeight}
                    width="100%"
                    itemCount={filteredRefs.length}
                    itemSize={30}
                  >
                    {renderRefRow}
                  </FixedSizeList>
                )}
              </div>
            </div>

            {/* Right Column: Compare log */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="p-3 border-b border-border flex gap-2 shrink-0 items-center bg-surface/20">
                <span className="text-[12px] text-muted whitespace-nowrap">Comparing:</span>
                <span className="font-mono text-accent text-[11px] bg-accent/10 px-2 py-0.5 rounded border border-accent/20 max-w-[150px] truncate" title={compareRef || 'none'}>
                  {compareRef || 'none'}
                </span>
                <span className="text-[12px] text-muted">vs</span>
                <span className="font-mono text-primary text-[11px] bg-border px-2 py-0.5 rounded border border-border">
                  HEAD
                </span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loadingCompare ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted text-[13px] gap-2">
                    <svg className="animate-spin text-accent" width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Loading comparison...</span>
                  </div>
                ) : compareLog.length === 0 ? (
                  <div className="text-muted text-center py-8 text-[13px]">
                    Select a reference from the left list to compare
                  </div>
                ) : (
                  compareLog.map((entry) => (
                    <LogEntryRow key={entry.hash} entry={entry} />
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {log.length === 0 && isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted text-[13px] gap-2">
                  <svg className="animate-spin text-accent" width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Loading commits...</span>
                </div>
              ) : log.length === 0 ? (
                <div className="text-muted text-center py-8 text-[13px]">No commits found</div>
              ) : (
                <>
                  {log.map((entry) => (
                    <LogEntryRow
                      key={entry.hash}
                      entry={entry}
                    />
                  ))}
                  <div className="text-center py-3 border-t border-border">
                    <button
                      className="btn-surface text-[12px] px-4 py-1.5 inline-flex items-center gap-2"
                      onClick={handleLoadMore}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <svg className="animate-spin text-muted" width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Loading more...</span>
                        </>
                      ) : (
                        'Load more...'
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
