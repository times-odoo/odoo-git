import React, { useState, useEffect } from 'react';
import { useRepoStore } from '../../store/repos';
import { useGitStore } from '../../store/git';
import { useGit } from '../../hooks/useGit';
import type { LogEntry } from '../../../types.d';
import { LogEntryRow } from './LogEntry';

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

  const status = repoState?.status;
  const tracking = status?.tracking;

  useEffect(() => {
    if (!tracking) return;
    loadLogs();
  }, [repoPath, tracking]);

  const loadLogs = async () => {
    if (!tracking) return;
    setLoading(true);
    try {
      const [ahead, behind] = await Promise.all([
        window.git.log(repoPath, { from: tracking, to: 'HEAD', maxCount: 50 }),
        window.git.log(repoPath, { from: 'HEAD', to: tracking, maxCount: 50 }),
      ]);
      setAheadLog(ahead);
      setBehindLog(behind);
    } catch {}
    setLoading(false);
  };

  const currentLog = activeTab === 'ahead' ? aheadLog : behindLog;

  return (
    <div className="flex flex-col h-full">
      {/* Behind Warning Banner */}
      {status && status.behind > 0 && (
        <div className="bg-warning/10 border-b border-warning/30 px-3 py-2 flex items-center gap-2 shrink-0">
          <svg width="14" height="14" viewBox="0 0 14 14" className="text-warning shrink-0">
            <path d="M7 4V8M7 10V10.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" fill="none" />
          </svg>
          <span className="text-[12px] text-warning flex-1">
            You are <strong>{status.behind}</strong> commits behind <span className="font-mono">{tracking}</span>. Rebase recommended.
          </span>
          <button
            className="btn text-[11px] bg-warning/15 text-warning border border-warning/30 hover:bg-warning/25"
            onClick={() => tracking && rebaseBranch(tracking)}
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
          Ahead ({status?.ahead || 0})
        </button>
        <button
          className={`flex-1 py-2 text-[12px] font-medium transition-colors ${
            activeTab === 'behind' ? 'text-accent border-b-2 border-accent' : 'text-muted hover:text-primary'
          }`}
          onClick={() => setActiveTab('behind')}
        >
          Behind ({status?.behind || 0})
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
            {activeTab === 'ahead' ? 'No commits ahead of remote' : 'Up to date with remote'}
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
