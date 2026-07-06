import React, { useState, useEffect, useMemo } from 'react';
import { useRepoStore } from '../../store/repos';
import { useGitStore } from '../../store/git';
import { useGit } from '../../hooks/useGit';
import { useUIStore } from '../../store/ui';
import { Dropdown } from '../shared/Dropdown';

export function PushPanel() {
  const activeRepoPath = useRepoStore((s) => s.activeRepoPath);
  const repoState = useGitStore((s) => (activeRepoPath ? s.repoStates[activeRepoPath] : null));
  const { pushBranch, refreshRemotes } = useGit(activeRepoPath);
  const { showModal } = useUIStore();

  const [selectedRemote, setSelectedRemote] = useState('');
  const [pushMode, setPushMode] = useState<'normal' | 'force-lease' | 'force'>('normal');

  const status = repoState?.status;
  const remotes = repoState?.remotes || [];
  const branch = status?.current || '';
  const isLoading = repoState?.loading.push;

  // Determine default remote (odoo-dev or ent-dev)
  const defaultRemote = useMemo(() => {
    if (!activeRepoPath) return '';
    const repoName = activeRepoPath.split('/').pop()?.toLowerCase() || '';
    if (repoName.includes('enterprise') || repoName.includes('ent')) {
      return remotes.find((r) => r.name === 'ent-dev')?.name || remotes[0]?.name || '';
    }
    return remotes.find((r) => r.name === 'odoo-dev')?.name || remotes[0]?.name || '';
  }, [activeRepoPath, remotes]);

  useEffect(() => {
    if (activeRepoPath) refreshRemotes();
  }, [activeRepoPath]);

  useEffect(() => {
    if (!activeRepoPath) return;
    const savedRemote = localStorage.getItem(`push_remote:${activeRepoPath}`);
    if (savedRemote && remotes.some((r) => r.name === savedRemote)) {
      setSelectedRemote(savedRemote);
    } else if (defaultRemote) {
      setSelectedRemote(defaultRemote);
    }
  }, [activeRepoPath, defaultRemote, remotes]);

  const handleRemoteChange = (remote: string) => {
    setSelectedRemote(remote);
    if (activeRepoPath) {
      localStorage.setItem(`push_remote:${activeRepoPath}`, remote);
    }
  };

  const pushCommand = useMemo(() => {
    let cmd = `git push`;
    if (pushMode === 'force-lease') cmd += ' --force-with-lease';
    else if (pushMode === 'force') cmd += ' --force';
    cmd += ` ${selectedRemote} ${branch}`;
    return cmd;
  }, [selectedRemote, branch, pushMode]);

  const handlePush = async () => {
    if (pushMode === 'force') {
      showModal({
        title: 'Force Push',
        message: `You are about to force push to ${selectedRemote}/${branch}. This will overwrite the remote branch and may cause data loss for others.`,
        confirmLabel: 'Force Push',
        variant: 'danger',
        requireInput: branch,
        inputPlaceholder: `Type branch name to confirm`,
        onConfirm: () => {
          pushBranch(selectedRemote, branch, { force: true });
        },
      });
    } else {
      const opts = pushMode === 'force-lease' ? { forceWithLease: true } : undefined;
      await pushBranch(selectedRemote, branch, opts);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="section-header">PUSH</h3>

      {/* Remote selector */}
      <div>
        <label className="text-[12px] text-muted mb-1 block">Remote</label>
        <Dropdown
          options={remotes.map((r) => r.name)}
          value={selectedRemote}
          onChange={handleRemoteChange}
        />
      </div>

      {/* Branch */}
      <div>
        <label className="text-[12px] text-muted mb-1 block">Branch</label>
        <div className="input-field font-mono text-accent bg-bg cursor-default">
          {branch || '(no branch)'}
        </div>
      </div>

      {/* Push Mode */}
      <div>
        <label className="text-[12px] text-muted mb-2 block">Push mode</label>
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 cursor-pointer text-[13px]">
            <input
              type="radio"
              name="pushMode"
              checked={pushMode === 'normal'}
              onChange={() => setPushMode('normal')}
              className="accent-accent"
            />
            <span className="text-primary">Normal push</span>
          </label>

          <label className="flex items-start gap-2 cursor-pointer text-[13px]">
            <input
              type="radio"
              name="pushMode"
              checked={pushMode === 'force-lease'}
              onChange={() => setPushMode('force-lease')}
              className="accent-accent mt-1"
            />
            <div>
              <span className="text-primary">Force with lease</span>
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/20">recommended</span>
              <p className="text-[11px] text-muted mt-0.5">
                Fails if someone else pushed since you last fetched. Safer than --force.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-2 cursor-pointer text-[13px]">
            <input
              type="radio"
              name="pushMode"
              checked={pushMode === 'force'}
              onChange={() => setPushMode('force')}
              className="accent-accent mt-1"
            />
            <div>
              <span className="text-danger">Force push</span>
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-danger/10 text-danger border border-danger/20">dangerous</span>
              <p className="text-[11px] text-muted mt-0.5">
                Overwrites remote. Requires typed confirmation.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Command Preview */}
      <div className="bg-bg border border-border rounded p-3">
        <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Command</label>
        <div className="font-mono text-[12px] text-primary">{pushCommand}</div>
      </div>

      {/* Push Button */}
      <button
        className={`w-full justify-center py-2 ${
          pushMode === 'force' ? 'btn-danger' : 'btn-accent'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={handlePush}
        disabled={isLoading || !branch}
      >
        {isLoading ? (
          <>
            <svg className="spinner mr-1.5" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="20 12" />
            </svg>
            Pushing...
          </>
        ) : pushMode === 'force' ? (
          'Force Push'
        ) : (
          'Push'
        )}
      </button>
    </div>
  );
}
