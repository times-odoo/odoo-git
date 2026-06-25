import React, { useState, useEffect } from 'react';
import { useRepoStore } from '../../store/repos';
import { useGitStore } from '../../store/git';
import { useUIStore } from '../../store/ui';
import { useGit } from '../../hooks/useGit';
import { HunkView } from '../diff/HunkView';

export function GitAddPanel() {
  const activeRepoPath = useRepoStore((s) => s.activeRepoPath);
  const repoState = useGitStore((s) => (activeRepoPath ? s.repoStates[activeRepoPath] : null));
  const { refreshStatus, stageFiles, unstageFiles, discardFiles, resetHard } = useGit(activeRepoPath);
  const { showModal } = useUIStore();

  const status = repoState?.status;
  const isLoading = repoState?.loading?.status;

  // File lists
  const stagedFiles = status?.staged || [];
  const modifiedFiles = status?.modified || [];
  const deletedFiles = status?.deleted || [];
  const untrackedFiles = status?.untracked || [];

  // Unstaged is modified + deleted + untracked
  const unstagedFiles = [...modifiedFiles, ...deletedFiles, ...untrackedFiles];

  // UI Selection States
  const [selectedUnstaged, setSelectedUnstaged] = useState<string[]>([]);
  const [selectedStaged, setSelectedStaged] = useState<string[]>([]);

  // Search Filters
  const [filterUnstaged, setFilterUnstaged] = useState('');
  const [filterStaged, setFilterStaged] = useState('');

  // Selected file for diff preview
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileType, setSelectedFileType] = useState<'staged' | 'unstaged' | null>(null);
  const [rawDiff, setRawDiff] = useState('');
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [diffViewMode, setDiffViewMode] = useState<'unified' | 'split'>('unified');

  // Filtered files
  const filteredUnstaged = unstagedFiles.filter(f =>
    f.toLowerCase().includes(filterUnstaged.toLowerCase())
  );
  const filteredStaged = stagedFiles.filter(f =>
    f.toLowerCase().includes(filterStaged.toLowerCase())
  );

  // Refresh status on load
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Load diff when selected file changes
  useEffect(() => {
    if (!activeRepoPath || !selectedFile || !selectedFileType) {
      setRawDiff('');
      return;
    }

    const loadRawDiff = async () => {
      setLoadingDiff(true);
      try {
        let args: string[] = [];
        if (selectedFileType === 'staged') {
          args = ['--cached', '--', selectedFile];
        } else {
          // Unstaged
          const isUntracked = untrackedFiles.includes(selectedFile);
          if (isUntracked) {
            args = ['--no-index', '--', '/dev/null', selectedFile];
          } else {
            args = ['--', selectedFile];
          }
        }
        const result = await window.git.diffRaw(activeRepoPath, args);
        setRawDiff(result);
      } catch (err) {
        setRawDiff('');
      } finally {
        setLoadingDiff(false);
      }
    };

    loadRawDiff();
  }, [selectedFile, selectedFileType, activeRepoPath, stagedFiles.length, unstagedFiles.length]);

  // Handle stage action
  const handleStageSelected = async () => {
    const toStage = selectedUnstaged.filter(f => filteredUnstaged.includes(f));
    if (toStage.length === 0) return;
    await stageFiles(toStage);
    setSelectedUnstaged([]);
  };

  const handleStageAll = async () => {
    if (filteredUnstaged.length === 0) return;
    await stageFiles(filteredUnstaged);
    setSelectedUnstaged([]);
  };

  // Handle unstage action
  const handleUnstageSelected = async () => {
    const toUnstage = selectedStaged.filter(f => filteredStaged.includes(f));
    if (toUnstage.length === 0) return;
    await unstageFiles(toUnstage);
    setSelectedStaged([]);
  };

  const handleUnstageAll = async () => {
    if (filteredStaged.length === 0) return;
    await unstageFiles(filteredStaged);
    setSelectedStaged([]);
  };

  // Handle discard action (revert unstaged changes)
  const handleDiscardSelected = async () => {
    const toDiscard = selectedUnstaged.filter(
      f => filteredUnstaged.includes(f) && !untrackedFiles.includes(f)
    );
    if (toDiscard.length === 0) return;
    if (confirm(`Are you sure you want to discard changes in ${toDiscard.length} file(s)? This cannot be undone.`)) {
      await discardFiles(toDiscard);
      setSelectedUnstaged([]);
      if (selectedFile && toDiscard.includes(selectedFile)) {
        setSelectedFile(null);
        setSelectedFileType(null);
      }
    }
  };

  // Toggle selection for individual items
  const toggleUnstagedSelection = (file: string) => {
    setSelectedUnstaged(prev =>
      prev.includes(file) ? prev.filter(f => f !== file) : [...prev, file]
    );
  };

  const toggleStagedSelection = (file: string) => {
    setSelectedStaged(prev =>
      prev.includes(file) ? prev.filter(f => f !== file) : [...prev, file]
    );
  };

  // Master checkboxes
  const isAllUnstagedSelected =
    filteredUnstaged.length > 0 &&
    filteredUnstaged.every(f => selectedUnstaged.includes(f));

  const toggleAllUnstaged = () => {
    if (isAllUnstagedSelected) {
      setSelectedUnstaged(prev => prev.filter(f => !filteredUnstaged.includes(f)));
    } else {
      setSelectedUnstaged(prev => {
        const union = new Set([...prev, ...filteredUnstaged]);
        return Array.from(union);
      });
    }
  };

  const isAllStagedSelected =
    filteredStaged.length > 0 &&
    filteredStaged.every(f => selectedStaged.includes(f));

  const toggleAllStaged = () => {
    if (isAllStagedSelected) {
      setSelectedStaged(prev => prev.filter(f => !filteredStaged.includes(f)));
    } else {
      setSelectedStaged(prev => {
        const union = new Set([...prev, ...filteredStaged]);
        return Array.from(union);
      });
    }
  };

  // Get status details for display
  const getFileStatus = (file: string) => {
    if (stagedFiles.includes(file)) {
      if (deletedFiles.includes(file)) return { label: 'D', color: 'text-danger bg-danger/10 border-danger/20', desc: 'Staged Deletion' };
      if (modifiedFiles.includes(file)) return { label: 'M', color: 'text-warning bg-warning/10 border-warning/20', desc: 'Staged Modification' };
      return { label: 'A', color: 'text-success bg-success/10 border-success/20', desc: 'Staged Added' };
    } else {
      if (deletedFiles.includes(file)) return { label: 'D', color: 'text-danger bg-danger/10 border-danger/20', desc: 'Deleted' };
      if (untrackedFiles.includes(file)) return { label: 'U', color: 'text-muted bg-surface border-border', desc: 'Untracked' };
      return { label: 'M', color: 'text-warning bg-warning/10 border-warning/20', desc: 'Modified' };
    }
  };

  return (
    <div className="flex flex-col h-full select-none bg-bg">
      {/* Header section */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0 bg-surface/30">
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-semibold text-primary tracking-wide">Git Add / Stage Changes</h2>
          {status && (
            <div className="flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              {status.current || 'detached'}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            className="px-2 py-1 rounded bg-danger/10 border border-danger/20 text-danger hover:bg-danger/25 text-[11px] font-semibold transition-colors"
            onClick={() => {
              showModal({
                title: 'Hard Reset Working Tree',
                message: 'Warning: This action is destructive and cannot be undone. All unstaged and staged changes in the current repository will be permanently deleted.',
                confirmLabel: 'Reset Everything',
                variant: 'danger',
                onConfirm: async () => {
                  await resetHard();
                  setSelectedUnstaged([]);
                  setSelectedStaged([]);
                  setSelectedFile(null);
                  setSelectedFileType(null);
                },
              });
            }}
          >
            Hard Reset
          </button>
          <button
            className={`p-1.5 rounded-md hover:bg-border/60 text-muted hover:text-primary transition-all border border-transparent hover:border-border ${
              isLoading ? 'opacity-50 pointer-events-none' : ''
            }`}
            onClick={() => refreshStatus()}
            title="Refresh working tree status"
          >
            <svg
              className={`w-4 h-4 ${isLoading ? 'spinner text-accent' : ''}`}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13.5 8a5.5 5.5 0 1 1-1.61-3.89L13.5 5.5M13.5 2.5v3h-3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main body split layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: Side-by-side staging panels (60% width) */}
        <div className="w-[60%] flex border-r border-border h-full overflow-hidden">
          {/* Column 1: Unstaged changes */}
          <div className="w-1/2 flex flex-col border-r border-border h-full bg-surface/10">
            {/* Header controls */}
            <div className="p-3 border-b border-border space-y-2.5 bg-surface/20 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="rounded border-border text-accent focus:ring-accent w-3.5 h-3.5 cursor-pointer bg-bg"
                    checked={isAllUnstagedSelected}
                    onChange={toggleAllUnstaged}
                    disabled={filteredUnstaged.length === 0}
                  />
                  <span className="font-semibold text-muted text-[11px] uppercase tracking-wider">
                    Unstaged ({unstagedFiles.length})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    className="px-2 py-0.5 rounded text-[10px] bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 disabled:opacity-40 transition-colors"
                    onClick={handleStageSelected}
                    disabled={selectedUnstaged.length === 0}
                  >
                    Stage Selected
                  </button>
                  <button
                    className="px-2 py-0.5 rounded text-[10px] bg-surface border border-border text-primary hover:bg-border/40 disabled:opacity-40 transition-colors"
                    onClick={handleStageAll}
                    disabled={filteredUnstaged.length === 0}
                  >
                    Stage All
                  </button>
                </div>
              </div>

              {/* Action for discarding */}
              {selectedUnstaged.some(f => !untrackedFiles.includes(f)) && (
                <div className="flex items-center justify-between px-2 py-1 rounded bg-danger/5 border border-danger/10">
                  <span className="text-[10px] text-danger font-medium">Discard changes in selected files?</span>
                  <button
                    className="px-2 py-0.5 rounded text-[9px] bg-danger/15 hover:bg-danger/25 text-danger font-semibold border border-danger/20 transition-colors"
                    onClick={handleDiscardSelected}
                  >
                    Discard
                  </button>
                </div>
              )}

              {/* Filter */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter unstaged files..."
                  className="w-full bg-bg text-[11.5px] py-1 px-2.5 border border-border rounded outline-none focus:border-accent"
                  value={filterUnstaged}
                  onChange={(e) => setFilterUnstaged(e.target.value)}
                />
                {filterUnstaged && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-primary text-[14px]"
                    onClick={() => setFilterUnstaged('')}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/40">
              {filteredUnstaged.length === 0 ? (
                <div className="p-8 text-center text-muted text-[12px] italic">
                  {unstagedFiles.length === 0 ? 'No unstaged changes' : 'No matches found'}
                </div>
              ) : (
                filteredUnstaged.map((f) => {
                  const isSelected = selectedUnstaged.includes(f);
                  const isHighlighted = selectedFile === f && selectedFileType === 'unstaged';
                  const statusInfo = getFileStatus(f);

                  return (
                    <div
                      key={f}
                      className={`group flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-border/20 transition-all ${
                        isHighlighted ? 'bg-accent/5 border-l-2 border-accent pl-[10px]' : 'pl-3'
                      }`}
                      onClick={() => {
                        setSelectedFile(f);
                        setSelectedFileType('unstaged');
                      }}
                    >
                      <input
                        type="checkbox"
                        className="rounded border-border text-accent focus:ring-accent w-3.5 h-3.5 cursor-pointer bg-bg shrink-0"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleUnstagedSelection(f);
                        }}
                      />

                      {/* Status badge */}
                      <span
                        className={`w-5 h-5 flex items-center justify-center font-mono text-[10px] font-bold rounded border shrink-0 ${statusInfo.color}`}
                        title={statusInfo.desc}
                      >
                        {statusInfo.label}
                      </span>

                      {/* File Name & Path */}
                      <div className="flex-1 min-w-0 flex flex-col">
                        <span className="text-[12px] text-primary truncate font-medium">
                          {f.split('/').pop()}
                        </span>
                        <span className="text-[10px] text-muted truncate font-mono">
                          {f.includes('/') ? f.substring(0, f.lastIndexOf('/')) : './'}
                        </span>
                      </div>

                      {/* Quick actions on hover */}
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1 shrink-0">
                        {!untrackedFiles.includes(f) && (
                          <button
                            className="flex items-center justify-center w-5 h-5 rounded border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20 hover:scale-105 active:scale-95 transition-all text-[11px] font-bold"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Are you sure you want to discard changes in ${f.split('/').pop()}? This cannot be undone.`)) {
                                discardFiles([f]);
                                setSelectedUnstaged(prev => prev.filter(item => item !== f));
                                if (selectedFile === f) {
                                  setSelectedFile(null);
                                  setSelectedFileType(null);
                                }
                              }
                            }}
                            title="Discard File"
                          >
                            ×
                          </button>
                        )}
                        <button
                          className="flex items-center justify-center w-5 h-5 rounded border border-success/30 bg-success/10 text-success hover:bg-success/20 hover:scale-105 active:scale-95 transition-all text-[11px] font-bold"
                          onClick={(e) => {
                            e.stopPropagation();
                            stageFiles([f]);
                            setSelectedUnstaged(prev => prev.filter(item => item !== f));
                          }}
                          title="Stage File"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 2: Staged changes */}
          <div className="w-1/2 flex flex-col h-full bg-surface/5">
            {/* Header controls */}
            <div className="p-3 border-b border-border space-y-2.5 bg-surface/20 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="rounded border-border text-accent focus:ring-accent w-3.5 h-3.5 cursor-pointer bg-bg"
                    checked={isAllStagedSelected}
                    onChange={toggleAllStaged}
                    disabled={filteredStaged.length === 0}
                  />
                  <span className="font-semibold text-muted text-[11px] uppercase tracking-wider">
                    Staged ({stagedFiles.length})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    className="px-2 py-0.5 rounded text-[10px] bg-warning/10 border border-warning/20 text-warning hover:bg-warning/20 disabled:opacity-40 transition-colors"
                    onClick={handleUnstageSelected}
                    disabled={selectedStaged.length === 0}
                  >
                    Unstage Selected
                  </button>
                  <button
                    className="px-2 py-0.5 rounded text-[10px] bg-surface border border-border text-primary hover:bg-border/40 disabled:opacity-40 transition-colors"
                    onClick={handleUnstageAll}
                    disabled={filteredStaged.length === 0}
                  >
                    Unstage All
                  </button>
                </div>
              </div>

              {/* Filter */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter staged files..."
                  className="w-full bg-bg text-[11.5px] py-1 px-2.5 border border-border rounded outline-none focus:border-accent"
                  value={filterStaged}
                  onChange={(e) => setFilterStaged(e.target.value)}
                />
                {filterStaged && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-primary text-[14px]"
                    onClick={() => setFilterStaged('')}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/40">
              {filteredStaged.length === 0 ? (
                <div className="p-8 text-center text-muted text-[12px] italic">
                  {stagedFiles.length === 0 ? 'No staged changes' : 'No matches found'}
                </div>
              ) : (
                filteredStaged.map((f) => {
                  const isSelected = selectedStaged.includes(f);
                  const isHighlighted = selectedFile === f && selectedFileType === 'staged';
                  const statusInfo = getFileStatus(f);

                  return (
                    <div
                      key={f}
                      className={`group flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-border/20 transition-all ${
                        isHighlighted ? 'bg-accent/5 border-l-2 border-accent pl-[10px]' : 'pl-3'
                      }`}
                      onClick={() => {
                        setSelectedFile(f);
                        setSelectedFileType('staged');
                      }}
                    >
                      <input
                        type="checkbox"
                        className="rounded border-border text-accent focus:ring-accent w-3.5 h-3.5 cursor-pointer bg-bg shrink-0"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleStagedSelection(f);
                        }}
                      />

                      {/* Status badge */}
                      <span
                        className={`w-5 h-5 flex items-center justify-center font-mono text-[10px] font-bold rounded border shrink-0 ${statusInfo.color}`}
                        title={statusInfo.desc}
                      >
                        {statusInfo.label}
                      </span>

                      {/* File Name & Path */}
                      <div className="flex-1 min-w-0 flex flex-col">
                        <span className="text-[12px] text-primary truncate font-medium">
                          {f.split('/').pop()}
                        </span>
                        <span className="text-[10px] text-muted truncate font-mono">
                          {f.includes('/') ? f.substring(0, f.lastIndexOf('/')) : './'}
                        </span>
                      </div>

                      {/* Quick unstage button on hover */}
                      <button
                        className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded border border-warning/30 bg-warning/10 text-warning hover:bg-warning/20 hover:scale-105 active:scale-95 transition-all text-[11px] font-bold shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          unstageFiles([f]);
                          setSelectedStaged(prev => prev.filter(item => item !== f));
                        }}
                        title="Unstage File"
                      >
                        −
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Diff Preview (40% width) */}
        <div className="w-[40%] flex flex-col h-full overflow-hidden bg-surface/20">
          {/* Header controls for Diff */}
          <div className="p-3 border-b border-border flex items-center justify-between shrink-0 bg-surface/30">
            <span className="font-semibold text-muted text-[11px] uppercase tracking-wider">
              Diff Preview {selectedFile ? `(${selectedFileType})` : ''}
            </span>

            {selectedFile && (
              <div className="flex items-center gap-1.5">
                <button
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    diffViewMode === 'unified' ? 'bg-border text-primary' : 'text-muted hover:text-primary'
                  }`}
                  onClick={() => setDiffViewMode('unified')}
                >
                  Unified
                </button>
                <button
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    diffViewMode === 'split' ? 'bg-border text-primary' : 'text-muted hover:text-primary'
                  }`}
                  onClick={() => setDiffViewMode('split')}
                >
                  Split
                </button>
              </div>
            )}
          </div>

          {/* Diff view content */}
          <div className="flex-1 overflow-auto bg-bg/40">
            {selectedFile ? (
              loadingDiff ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted text-[12px] gap-2">
                  <svg className="spinner text-accent" width="16" height="16" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="20 12" />
                  </svg>
                  Loading diff...
                </div>
              ) : rawDiff ? (
                <div className="p-1">
                  <div className="px-3 py-1 bg-surface border border-border rounded mb-2 text-[11px] font-mono text-muted truncate">
                    {selectedFile}
                  </div>
                  <HunkView rawDiff={rawDiff} viewMode={diffViewMode} />
                </div>
              ) : (
                <div className="text-muted text-center py-12 text-[12px] italic">
                  No changes detected or binary file.
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted p-6 text-center gap-3">
                <svg
                  className="opacity-20 text-primary"
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <div className="text-[12px] font-medium">No File Selected</div>
                <div className="text-[11px] text-muted max-w-xs leading-normal">
                  Click on any staged or unstaged file in the left panels to preview its diff changes here.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
