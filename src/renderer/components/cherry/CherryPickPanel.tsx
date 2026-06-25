import React, { useState, useEffect, useMemo, useRef, useDeferredValue } from 'react';
import { useRepoStore } from '../../store/repos';
import { useGitStore } from '../../store/git';
import { useGit } from '../../hooks/useGit';
import { useUIStore } from '../../store/ui';
import { FixedSizeList } from 'react-window';
import type { LogEntry } from '../../../types.d';

export function CherryPickPanel() {
  const activeRepoPath = useRepoStore((s) => s.activeRepoPath);
  const repoState = useGitStore((s) => (activeRepoPath ? s.repoStates[activeRepoPath] : null));
  const { cherryPickCommits } = useGit(activeRepoPath);
  const addToast = useUIStore((s) => s.addToast);

  const [hashInput, setHashInput] = useState('');
  const selectedHashes = useMemo(() => {
    return new Set(
      hashInput
        .split(/[\s,;]+/)
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean)
    );
  }, [hashInput]);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [hasConflict, setHasConflict] = useState(false);

  const [selectedRef, setSelectedRef] = useState('HEAD');
  const [commits, setCommits] = useState<LogEntry[]>([]);
  const [loadingCommits, setLoadingCommits] = useState(false);

  const [showRefDropdown, setShowRefDropdown] = useState(false);
  const [refSearch, setRefSearch] = useState('');
  const deferredRefSearch = useDeferredValue(refSearch);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowRefDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const localBranches = repoState?.branches?.local || [];
  const remoteBranches = repoState?.branches?.remotes.flatMap((r) => r.branches) || [];

  const matchedRefs = useMemo(() => {
    const list: string[] = ['HEAD'];
    const lower = deferredRefSearch.toLowerCase();

    for (const b of localBranches) {
      if (!deferredRefSearch || b.name.toLowerCase().includes(lower)) {
        list.push(b.name);
      }
    }

    for (const b of remoteBranches) {
      if (!deferredRefSearch || b.name.toLowerCase().includes(lower)) {
        list.push(b.name);
      }
    }

    return list;
  }, [localBranches, remoteBranches, deferredRefSearch]);

  useEffect(() => {
    const loadCommits = async () => {
      if (!activeRepoPath) return;
      setLoadingCommits(true);
      try {
        const log = await window.git.log(activeRepoPath, { from: selectedRef, maxCount: 50 });
        setCommits(log);
      } catch {
        setCommits([]);
      } finally {
        setLoadingCommits(false);
      }
    };
    loadCommits();
  }, [activeRepoPath, selectedRef]);

  const handleCherryPick = async () => {
    const hashes = hashInput.split(/[\s,]+/).filter(Boolean);
    if (hashes.length === 0) return;

    const result = await cherryPickCommits(hashes);
    if (result && !result.success) {
      setConflicts(result.conflicts);
      setHasConflict(true);
    } else {
      setHashInput('');
      setConflicts([]);
      setHasConflict(false);
    }
  };

  const handleAbort = async () => {
    if (!activeRepoPath) return;
    try {
      await window.git.cherryPickAbort(activeRepoPath);
      addToast({ message: 'Cherry-pick aborted', type: 'info' });
      setConflicts([]);
      setHasConflict(false);
    } catch (e: any) {
      addToast({ message: e?.message || 'Abort failed', type: 'error' });
    }
  };

  const handleContinue = async () => {
    if (!activeRepoPath) return;
    try {
      await window.git.cherryPickContinue(activeRepoPath);
      addToast({ message: 'Cherry-pick continued', type: 'success' });
      setConflicts([]);
      setHasConflict(false);
    } catch (e: any) {
      addToast({ message: e?.message || 'Continue failed', type: 'error' });
    }
  };

  return (
    <div className="p-4 space-y-4 flex flex-col h-full overflow-hidden">
      <h3 className="section-header shrink-0">CHERRY-PICK</h3>

      <div className="grid grid-cols-2 gap-4 shrink-0">
        <div className="relative" ref={dropdownRef}>
          <label className="text-[12px] text-muted mb-1 block">Source reference/branch</label>
          <div
            className="input-field text-[12px] h-[36px] flex items-center justify-between cursor-pointer"
            onClick={() => setShowRefDropdown(!showRefDropdown)}
          >
            <span className="truncate font-mono">{selectedRef}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" className={`text-muted transition-transform ${showRefDropdown ? 'rotate-180' : ''}`}>
              <path d="M1 3L5 7L9 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          {showRefDropdown && (
            <div className="absolute top-[60px] left-0 right-0 z-50 bg-[#1C2129] border border-border rounded shadow-2xl flex flex-col max-h-[300px]">
              <div className="p-2 border-b border-border bg-[#161B22] shrink-0">
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
                    placeholder="Search branches..."
                    value={refSearch}
                    onChange={(e) => setRefSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex-1 overflow-hidden h-[200px]">
                {matchedRefs.length === 0 ? (
                  <div className="text-muted text-center py-4 text-[11px]">No matches found</div>
                ) : (
                  <FixedSizeList
                    height={200}
                    width="100%"
                    itemCount={matchedRefs.length}
                    itemSize={30}
                  >
                    {({ index, style }) => {
                      const refName = matchedRefs[index];
                      return (
                        <div
                          style={style}
                          className={`px-3 py-1.5 cursor-pointer text-[12px] font-mono truncate hover:bg-border/20 ${
                            selectedRef === refName ? 'bg-accent/15 text-accent font-semibold' : 'text-primary'
                          }`}
                          onClick={() => {
                            setSelectedRef(refName);
                            setShowRefDropdown(false);
                            setRefSearch('');
                          }}
                          title={refName}
                        >
                          {refName}
                        </div>
                      );
                    }}
                  </FixedSizeList>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="text-[12px] text-muted mb-1 block">Commit hash(es)</label>
          <input
            className="input-field font-mono text-[12px] h-[36px]"
            placeholder="Selected hashes show here"
            value={hashInput}
            onChange={(e) => setHashInput(e.target.value)}
          />
        </div>
      </div>

      {/* Commit selection list */}
      <div className="flex-1 min-h-0 border border-border rounded bg-[#161B22] overflow-hidden flex flex-col">
        <div className="section-header px-3 py-2 border-b border-border bg-[#1C2129] shrink-0">
          SELECT COMMITS FROM {selectedRef.toUpperCase()}
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {loadingCommits ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted text-[12px] gap-2">
              <svg className="animate-spin text-accent" width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Loading commits...</span>
            </div>
          ) : commits.length === 0 ? (
            <div className="text-muted text-center py-8 text-[12px]">No commits found</div>
          ) : (
            commits.map((c) => {
              const cleanHash = c.hashShort.toLowerCase();
              const isAdded = selectedHashes.has(c.hash.toLowerCase()) || 
                              selectedHashes.has(cleanHash) ||
                              Array.from(selectedHashes).some(sh => 
                                c.hash.toLowerCase().startsWith(sh) || 
                                sh.startsWith(cleanHash)
                              );
              return (
                <div
                  key={c.hash}
                  className={`p-2.5 cursor-pointer transition-colors text-[12px] flex flex-col gap-0.5 hover:bg-border/20 ${
                    isAdded ? 'bg-accent/10 border-l-2 border-accent' : ''
                  }`}
                  onClick={() => {
                    const currentList = hashInput
                      .split(/[\s,;]+/)
                      .map((h) => h.trim())
                      .filter(Boolean);
                    
                    const isAlreadyAdded = currentList.some(
                      (h) => h.toLowerCase() === cleanHash || c.hash.toLowerCase().startsWith(h.toLowerCase())
                    );

                    if (isAlreadyAdded) {
                      const filtered = currentList.filter(
                        (h) => h.toLowerCase() !== cleanHash && !c.hash.toLowerCase().startsWith(h.toLowerCase())
                      );
                      setHashInput(filtered.join(', '));
                    } else {
                      setHashInput(currentList.length > 0 ? `${currentList.join(', ')}, ${c.hashShort}` : c.hashShort);
                    }
                  }}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-mono text-accent text-[11px] font-semibold">{c.hashShort}</span>
                    <span className="text-muted text-[10px] whitespace-nowrap">{c.date}</span>
                  </div>
                  <div className="text-primary truncate font-medium">{c.message}</div>
                  <div className="text-muted text-[10px] truncate">By {c.author}</div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <button
        className="btn-accent w-full justify-center py-2 shrink-0"
        onClick={handleCherryPick}
        disabled={!hashInput.trim()}
      >
        Cherry-pick Selected Commits
      </button>

      {/* Conflict state */}
      {hasConflict && (
        <div className="border border-danger/30 rounded bg-danger/5 p-3 space-y-2 fade-in shrink-0">
          <div className="text-[13px] text-danger font-medium">Cherry-pick conflicts</div>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {conflicts.map((f) => (
              <div key={f} className="text-[12px] font-mono text-diff-remove-text">{f}</div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <button className="btn-surface text-[12px]" onClick={handleContinue}>
              Continue
            </button>
            <button className="btn-danger text-[12px]" onClick={handleAbort}>
              Abort
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
