import React, { useState, useEffect, useMemo } from 'react';
import { useGitStore } from '../../store/git';
import { useGit } from '../../hooks/useGit';
import type { LogEntry } from '../../../types.d';
import { LogEntryRow } from './LogEntry';
import { Dropdown } from '../shared/Dropdown';

interface AheadBehindViewProps {
  repoPath: string;
}

export function AheadBehindView({ repoPath }: AheadBehindViewProps) {
  const repoState = useGitStore((s) => s.repoStates[repoPath]);
  const { rebaseBranch } = useGit(repoPath);
  const [aheadLog, setAheadLog] = useState<LogEntry[]>([]);
  const [behindLog, setBehindLog] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'ahead' | 'behind'>('ahead');
  const [loading, setLoading] = useState(false);
  const [targetBranch, setTargetBranch] = useState<string>('');
  const [aheadCount, setAheadCount] = useState(0);
  const [behindCount, setBehindCount] = useState(0);

  const status = repoState?.status;
  const tracking = status?.tracking;

  // Build options from local and remote branches
  const branchOptions = useMemo(() => {
    if (!repoState?.branches) return [];
    const localOpts = repoState.branches.local.map((b) => ({
      value: b.name,
      label: b.name,
    }));
    const remoteOpts = repoState.branches.remotes.flatMap((r) =>
      r.branches.map((b) => ({
        value: `${r.remote}/${b.name}`,
        label: `${r.remote}/${b.name}`,
      }))
    );
    return [...localOpts, ...remoteOpts];
  }, [repoState?.branches]);

  // Set default target branch when tracking or options change
  useEffect(() => {
    if (tracking) {
      setTargetBranch(tracking);
    } else {
      // Find a default branch if possible: master, origin/master, main, origin/main, etc.
      const defaultBranch =
        branchOptions.find((o) => o.value === 'master')?.value ||
        branchOptions.find((o) => o.value === 'origin/master')?.value ||
        branchOptions.find((o) => o.value === 'main')?.value ||
        branchOptions.find((o) => o.value === 'origin/main')?.value ||
        branchOptions.find((o) => o.value.startsWith('origin/'))?.value ||
        branchOptions[0]?.value ||
        '';
      setTargetBranch(defaultBranch);
    }
  }, [tracking, branchOptions, repoPath]);

  useEffect(() => {
    if (!targetBranch) return;
    loadLogs();
  }, [repoPath, targetBranch]);

  const loadLogs = async () => {
    if (!targetBranch) return;
    setLoading(true);
    try {
      const [ahead, behind, counts] = await Promise.all([
        window.git.log(repoPath, { from: targetBranch, to: 'HEAD', maxCount: 50 }),
        window.git.log(repoPath, { from: 'HEAD', to: targetBranch, maxCount: 50 }),
        window.git.getAheadBehindCount(repoPath, targetBranch).catch(() => ({ ahead: 0, behind: 0 })),
      ]);
      setAheadLog(ahead);
      setBehindLog(behind);
      setAheadCount(counts.ahead);
      setBehindCount(counts.behind);
    } catch (e) {
      console.error('Error loading ahead/behind logs:', e);
    }
    setLoading(false);
  };

  const currentLog = activeTab === 'ahead' ? aheadLog : behindLog;

  return (
    <div className="flex flex-col h-full">
      {/* Branch selector */}
      <div className="p-3 border-b border-border bg-surface/20 flex flex-col gap-1.5 shrink-0">
        <label className="block text-[10px] text-muted font-bold uppercase tracking-wider">Compare HEAD against branch:</label>
        <div className="flex gap-2">
          <Dropdown
            options={branchOptions}
            value={targetBranch}
            onChange={setTargetBranch}
            searchable={true}
            placeholder="Select branch to compare..."
            className="flex-1"
          />
          <button
            className="p-2 bg-surface hover:bg-border/60 text-muted hover:text-primary rounded shrink-0 flex items-center justify-center border border-border h-[36px]"
            onClick={loadLogs}
            disabled={loading}
            title="Refresh comparison"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'spinner' : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M13.5 8a5.5 5.5 0 1 1-1.61-3.89L13.5 5.5M13.5 2.5v3h-3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Behind Warning Banner */}
      {behindCount > 0 && (
        <div className="bg-warning/10 border-b border-warning/30 px-3 py-2 flex items-center gap-2 shrink-0">
          <svg width="14" height="14" viewBox="0 0 14 14" className="text-warning shrink-0">
            <path d="M7 4V8M7 10V10.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" fill="none" />
          </svg>
          <span className="text-[12px] text-warning flex-1">
            You are <strong>{behindCount}</strong> commits behind <span className="font-mono">{targetBranch}</span>. Rebase recommended.
          </span>
          <button
            className="btn text-[11px] bg-warning/15 text-warning border border-warning/30 hover:bg-warning/25 px-2 py-1 rounded"
            onClick={() => targetBranch && rebaseBranch(targetBranch)}
          >
            Rebase now
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border shrink-0">
        <button
          className={`flex-1 py-2 text-[12px] font-medium transition-colors ${
            activeTab === 'ahead' ? 'text-accent border-b-2 border-accent' : 'text-muted hover:text-primary'
          }`}
          onClick={() => setActiveTab('ahead')}
        >
          Ahead ({aheadCount})
        </button>
        <button
          className={`flex-1 py-2 text-[12px] font-medium transition-colors ${
            activeTab === 'behind' ? 'text-accent border-b-2 border-accent' : 'text-muted hover:text-primary'
          }`}
          onClick={() => setActiveTab('behind')}
        >
          Behind ({behindCount})
        </button>
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-20 text-muted text-[13px]">
            <svg className="spinner mr-2" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="20 12" />
            </svg>
            Loading...
          </div>
        ) : currentLog.length === 0 ? (
          <div className="text-muted text-center py-8 text-[13px]">
            {activeTab === 'ahead' ? 'No commits ahead of compare branch' : 'Up to date with compare branch'}
          </div>
        ) : (
          currentLog.map((entry) => (
            <LogEntryRow
              key={entry.hash}
              entry={entry}
            />
          ))
        )}
      </div>
    </div>
  );
}
