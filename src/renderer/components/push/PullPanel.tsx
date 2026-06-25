import React, { useState, useMemo, useEffect, useRef, useDeferredValue } from 'react';
import { useRepoStore } from '../../store/repos';
import { useGitStore } from '../../store/git';
import { useGit } from '../../hooks/useGit';
import { useUIStore } from '../../store/ui';
import { FixedSizeList } from 'react-window';
import { Dropdown } from '../shared/Dropdown';

export function PullPanel() {
  const activeRepoPath = useRepoStore((s) => s.activeRepoPath);
  const repoState = useGitStore((s) => (activeRepoPath ? s.repoStates[activeRepoPath] : null));
  const { pullBranch, rebaseBranch, refreshBranches } = useGit(activeRepoPath);
  const addToast = useUIStore((s) => s.addToast);

  const [mode, setMode] = useState<'pull-regular' | 'pull-rebase' | 'rebase'>('pull-regular');
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [hasConflict, setHasConflict] = useState(false);

  // Custom branch pull
  const [useCustomBranch, setUseCustomBranch] = useState(false);
  const [customRemote, setCustomRemote] = useState('');
  const [customBranch, setCustomBranch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const deferredFilter = useDeferredValue(branchFilter);

  const status = repoState?.status;
  const tracking = status?.tracking;
  const remotes = repoState?.remotes || [];
  const branches = repoState?.branches;
  const isLoadingBranches = repoState?.loading?.branches;

  // Only fetch branches when the custom toggle is enabled (lazy load)
  useEffect(() => {
    if (activeRepoPath && useCustomBranch && !branches) {
      refreshBranches();
    }
  }, [activeRepoPath, useCustomBranch, branches]);

  // Parse remote and branch from tracking ref
  const [trackRemote, trackBranch] = useMemo(() => {
    if (!tracking) return ['', ''];
    const idx = tracking.indexOf('/');
    if (idx === -1) return [tracking, ''];
    return [tracking.substring(0, idx), tracking.substring(idx + 1)];
  }, [tracking]);

  // Set initial custom remote
  useEffect(() => {
    if (remotes.length > 0 && !customRemote) {
      setCustomRemote(trackRemote || remotes[0].name);
    }
  }, [remotes, trackRemote]);

  // Get branches for selected remote
  const remoteBranches = useMemo(() => {
    if (!branches?.remotes || !customRemote) return [];
    const remoteGroup = branches.remotes.find((r) => r.remote === customRemote);
    if (!remoteGroup) return [];
    return remoteGroup.branches.map((b) => b.label);
  }, [branches?.remotes, customRemote]);

  const filteredRemoteBranches = useMemo(() => {
    if (!deferredFilter.trim()) return remoteBranches;
    const lower = deferredFilter.toLowerCase();
    return remoteBranches.filter((b) => b.toLowerCase().includes(lower));
  }, [remoteBranches, deferredFilter]);

  const effectiveRemote = useCustomBranch ? customRemote : trackRemote;
  const effectiveBranch = useCustomBranch ? customBranch : trackBranch;
  const effectiveTracking = useCustomBranch
    ? (customRemote && customBranch ? `${customRemote}/${customBranch}` : '')
    : tracking;

  const handlePull = async () => {
    if (mode === 'pull-regular') {
      if (!effectiveRemote || !effectiveBranch) return;
      await pullBranch(effectiveRemote, effectiveBranch, { rebase: false });
    } else if (mode === 'pull-rebase') {
      if (!effectiveRemote || !effectiveBranch) return;
      await pullBranch(effectiveRemote, effectiveBranch, { rebase: true });
    } else {
      if (!effectiveTracking) return;
      const result = await rebaseBranch(effectiveTracking);
      if (result && !result.success) {
        setConflicts(result.conflicts);
        setHasConflict(true);
      }
    }
  };

  const handleAbort = async () => {
    if (!activeRepoPath) return;
    try {
      await window.git.rebaseAbort(activeRepoPath);
      addToast({ message: 'Rebase aborted', type: 'info' });
      setConflicts([]);
      setHasConflict(false);
    } catch (e: any) {
      addToast({ message: e?.message || 'Abort failed', type: 'error' });
    }
  };

  const handleContinue = async () => {
    if (!activeRepoPath) return;
    try {
      await window.git.rebaseContinue(activeRepoPath);
      addToast({ message: 'Rebase continued', type: 'success' });
      setConflicts([]);
      setHasConflict(false);
    } catch (e: any) {
      addToast({ message: e?.message || 'Continue failed', type: 'error' });
    }
  };

  const canPull = useCustomBranch
    ? !!(customRemote && customBranch)
    : !!tracking;

  // Virtualized row renderer for branch list
  const renderBranchRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const b = filteredRemoteBranches[index];
    const isSelected = customBranch === b;
    return (
      <div
        style={style}
        className={`flex items-center gap-2 px-2.5 hover:bg-border/20 cursor-pointer select-none transition-colors ${
          isSelected ? 'bg-accent/10' : ''
        }`}
        onClick={() => setCustomBranch(b)}
      >
        <input
          type="radio"
          name="customBranch"
          checked={isSelected}
          onChange={() => setCustomBranch(b)}
          className="accent-accent shrink-0"
        />
        <span className={`font-mono text-[11px] truncate ${isSelected ? 'text-accent font-semibold' : 'text-primary'}`}>
          {b}
        </span>
      </div>
    );
  };

  // Compute virtual list height
  const listHeight = Math.min(filteredRemoteBranches.length * 30, 200);

  return (
    <div className="p-4 space-y-4">
      <h3 className="section-header">PULL & REBASE</h3>

      {tracking && (
        <div className="text-[12px] text-muted">
          Tracking: <span className="font-mono text-accent">{tracking}</span>
        </div>
      )}

      {/* Custom Branch Toggle */}
      <div className="border border-border rounded bg-surface/30 p-3 space-y-2.5">
        <label className="flex items-center gap-2 cursor-pointer select-none text-[12px]">
          <input
            type="checkbox"
            checked={useCustomBranch}
            onChange={(e) => setUseCustomBranch(e.target.checked)}
            className="accent-accent"
          />
          <span className="text-primary font-medium">Pull from specific branch</span>
        </label>

        {useCustomBranch && (
          <div className="space-y-2 fade-in">
            {/* Remote selector */}
            <div>
              <label className="text-[11px] text-muted mb-1 block">Remote</label>
              <Dropdown
                options={remotes.map((r) => r.name)}
                value={customRemote}
                onChange={(val) => {
                  setCustomRemote(val);
                  setCustomBranch('');
                  setBranchFilter('');
                }}
              />
            </div>

            {/* Branch selector with filter */}
            <div>
              <label className="text-[11px] text-muted mb-1 block">Branch</label>
              <input
                type="text"
                className="input-field w-full font-mono text-[11px] mb-1"
                placeholder="Filter branches..."
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
              />
              <div className="border border-border rounded bg-[#0D1117] overflow-hidden">
                {isLoadingBranches ? (
                  <div className="flex items-center justify-center py-4 gap-2 text-muted text-[11px]">
                    <svg className="spinner" width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="20 12" />
                    </svg>
                    Loading branches...
                  </div>
                ) : filteredRemoteBranches.length === 0 ? (
                  <div className="px-3 py-2 text-muted text-[11px] text-center">
                    {remoteBranches.length === 0 ? 'No branches found for this remote' : 'No matching branches'}
                  </div>
                ) : (
                  <FixedSizeList
                    height={listHeight}
                    width="100%"
                    itemCount={filteredRemoteBranches.length}
                    itemSize={30}
                  >
                    {renderBranchRow}
                  </FixedSizeList>
                )}
              </div>
              {customBranch && (
                <p className="text-[10px] text-accent mt-1 font-mono">
                  Selected: {customRemote}/{customBranch}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mode Selection */}
      <div className="space-y-3">
        <label className="flex items-start gap-2 cursor-pointer text-[13px]">
          <input
            type="radio"
            name="pullMode"
            checked={mode === 'pull-regular'}
            onChange={() => setMode('pull-regular')}
            className="accent-accent mt-1"
          />
          <div>
            <span className="text-primary">Regular Pull</span>
            <p className="text-[11px] text-muted mt-0.5">
              git pull {effectiveRemote} {effectiveBranch}
            </p>
          </div>
        </label>

        <label className="flex items-start gap-2 cursor-pointer text-[13px]">
          <input
            type="radio"
            name="pullMode"
            checked={mode === 'pull-rebase'}
            onChange={() => setMode('pull-rebase')}
            className="accent-accent mt-1"
          />
          <div>
            <span className="text-primary">Pull (rebase)</span>
            <p className="text-[11px] text-muted mt-0.5">
              git pull --rebase {effectiveRemote} {effectiveBranch}
            </p>
          </div>
        </label>

        <label className="flex items-start gap-2 cursor-pointer text-[13px]">
          <input
            type="radio"
            name="pullMode"
            checked={mode === 'rebase'}
            onChange={() => setMode('rebase')}
            className="accent-accent mt-1"
          />
          <div>
            <span className="text-primary">Rebase onto remote</span>
            <p className="text-[11px] text-muted mt-0.5">
              git rebase {effectiveTracking}
            </p>
            <p className="text-[10px] text-muted italic mt-0.5">
              Both achieve the same result. 'Rebase onto remote' gives you more control — it's equivalent to fetch + rebase and doesn't require a clean working tree trick.
            </p>
          </div>
        </label>
      </div>

      <button
        className={`btn-accent w-full justify-center py-2 ${!canPull ? 'opacity-40 cursor-not-allowed' : ''}`}
        onClick={handlePull}
        disabled={!canPull}
      >
        {mode === 'pull-regular'
          ? 'Pull Changes'
          : mode === 'pull-rebase'
          ? 'Pull with Rebase'
          : 'Rebase onto Remote'}
      </button>

      {/* Conflict state */}
      {hasConflict && (
        <div className="border border-danger/30 rounded bg-danger/5 p-3 space-y-2 fade-in">
          <div className="text-[13px] text-danger font-medium">Rebase conflicts</div>
          <div className="space-y-1">
            {conflicts.map((f) => (
              <div key={f} className="text-[12px] font-mono text-diff-remove-text">{f}</div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <button className="btn-surface text-[12px]" onClick={handleContinue}>Continue</button>
            <button className="btn-danger text-[12px]" onClick={handleAbort}>Abort</button>
          </div>
        </div>
      )}
    </div>
  );
}
