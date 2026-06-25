import React, { useEffect, useState } from 'react';
import { useRepoStore } from '../../store/repos';
import { useGitStore } from '../../store/git';
import { useGit } from '../../hooks/useGit';
import { useUIStore } from '../../store/ui';

export function StashPanel() {
  const activeRepoPath = useRepoStore((s) => s.activeRepoPath);
  const repoState = useGitStore((s) => (activeRepoPath ? s.repoStates[activeRepoPath] : null));
  const { createStash, refreshStashes } = useGit(activeRepoPath);
  const addToast = useUIStore((s) => s.addToast);

  const [message, setMessage] = useState('');
  const [includeUntracked, setIncludeUntracked] = useState(true);
  const [expandedStash, setExpandedStash] = useState<number | null>(null);

  useEffect(() => {
    if (activeRepoPath) refreshStashes();
  }, [activeRepoPath]);

  const stashes = repoState?.stashes || [];

  const handleStash = async () => {
    await createStash(message || undefined, includeUntracked);
    setMessage('');
  };

  const handleApply = async (index: number) => {
    if (!activeRepoPath) return;
    try {
      await window.git.stashApply(activeRepoPath, index);
      addToast({ message: `Stash @{${index}} applied`, type: 'success' });
    } catch (e: any) {
      addToast({ message: e?.message || 'Apply failed', type: 'error' });
    }
  };

  const handlePop = async (index: number) => {
    if (!activeRepoPath) return;
    try {
      await window.git.stashPop(activeRepoPath, index);
      addToast({ message: `Stash @{${index}} popped`, type: 'success' });
      refreshStashes();
    } catch (e: any) {
      addToast({ message: e?.message || 'Pop failed', type: 'error' });
    }
  };

  const handleDrop = async (index: number) => {
    if (!activeRepoPath) return;
    try {
      await window.git.stashDrop(activeRepoPath, index);
      addToast({ message: `Stash @{${index}} dropped`, type: 'success' });
      refreshStashes();
    } catch (e: any) {
      addToast({ message: e?.message || 'Drop failed', type: 'error' });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Create Stash */}
      <div className="p-4 border-b border-border space-y-3 shrink-0">
        <h3 className="section-header">STASH CHANGES</h3>
        <div className="flex gap-2">
          <input
            type="text"
            className="input-field flex-1"
            placeholder="Stash message (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button className="btn-accent" onClick={handleStash}>
            Stash
          </button>
        </div>
        <label className="flex items-center gap-2 text-[12px] text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={includeUntracked}
            onChange={(e) => setIncludeUntracked(e.target.checked)}
            className="accent-accent"
          />
          Include untracked files
        </label>
      </div>

      {/* Stash List */}
      <div className="flex-1 overflow-y-auto">
        <div className="section-header px-4 py-2">STASH LIST ({stashes.length})</div>

        {stashes.length === 0 ? (
          <div className="text-muted text-center py-8 text-[13px]">No stashes</div>
        ) : (
          stashes.map((stash) => (
            <div key={stash.index} className="border-b border-border/50">
              <div
                className="flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-border/20 transition-colors"
                onClick={() => setExpandedStash(expandedStash === stash.index ? null : stash.index)}
              >
                <span className="font-mono text-[11px] text-accent shrink-0">
                  stash@{'{' + stash.index + '}'}
                </span>
                <span className="text-[13px] text-primary truncate flex-1">
                  {stash.message || '(no message)'}
                </span>
                {stash.branch && (
                  <span className="font-mono text-[10px] text-muted shrink-0">{stash.branch}</span>
                )}
                <span className="text-[11px] text-muted shrink-0 font-mono">{stash.date}</span>
              </div>

              {expandedStash === stash.index && (
                <div className="px-4 py-2 bg-bg flex gap-2 fade-in">
                  <button className="btn-surface text-[11px]" onClick={() => handleApply(stash.index)}>
                    Apply
                  </button>
                  <button className="btn-surface text-[11px]" onClick={() => handlePop(stash.index)}>
                    Pop
                  </button>
                  <button className="btn-danger text-[11px]" onClick={() => handleDrop(stash.index)}>
                    Drop
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
