import React, { useState, useMemo, useEffect, useRef, useDeferredValue } from 'react';
import { useGitStore } from '../../store/git';
import { useRepoStore } from '../../store/repos';
import { useGit } from '../../hooks/useGit';
import { useUIStore } from '../../store/ui';
import { FixedSizeList } from 'react-window';
import type { BranchInfo } from '../../../types.d';

export function BranchList() {
  const activeRepoPath = useRepoStore((s) => s.activeRepoPath);
  const repoState = useGitStore((s) => (activeRepoPath ? s.repoStates[activeRepoPath] : null));
  const { checkoutBranch, refreshBranches, renameBranch, deleteBranch } = useGit(activeRepoPath);
  const showModal = useUIStore((s) => s.showModal);
  const [filter, setFilter] = useState('');
  const deferredFilter = useDeferredValue(filter);
  const [activeGroup, setActiveGroup] = useState<'local' | 'remote'>('local');
  const containerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(400);

  useEffect(() => {
    if (activeRepoPath) refreshBranches();
  }, [activeRepoPath]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setListHeight(el.clientHeight - 4);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const branches = repoState?.branches;

  const filteredLocal = useMemo(() => {
    if (!branches?.local) return [];
    if (!deferredFilter) return branches.local;
    const lower = deferredFilter.toLowerCase();
    return branches.local.filter((b) => b.name.toLowerCase().includes(lower));
  }, [branches?.local, deferredFilter]);

  const filteredRemotes = useMemo(() => {
    if (!branches?.remotes) return [];
    if (!deferredFilter) return branches.remotes;
    const lower = deferredFilter.toLowerCase();
    return branches.remotes.map((group) => ({
      ...group,
      branches: group.branches.filter((b) => b.name.toLowerCase().includes(lower)),
    })).filter((g) => g.branches.length > 0);
  }, [branches?.remotes, deferredFilter]);

  // Flatten remote branches for virtualization
  const flatRemoteBranches = useMemo(() => {
    const flat: { type: 'header' | 'branch'; remote?: string; branch?: BranchInfo }[] = [];
    for (const group of filteredRemotes) {
      flat.push({ type: 'header', remote: group.remote });
      for (const b of group.branches) {
        flat.push({ type: 'branch', branch: b, remote: group.remote });
      }
    }
    return flat;
  }, [filteredRemotes]);

  const currentBranch = repoState?.status?.current;

  const renderLocalRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const branch = filteredLocal[index];
    const isCurrent = branch.name === currentBranch;
    return (
      <div
        style={style}
        className={`flex items-center gap-2 px-3 cursor-pointer transition-colors text-[13px] group ${
          isCurrent ? 'bg-accent/8 text-accent' : 'text-primary hover:bg-border/30'
        }`}
        onClick={() => {
          if (!isCurrent) checkoutBranch(branch.name);
        }}
      >
        {isCurrent && (
          <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0 text-accent">
            <circle cx="5" cy="5" r="4" fill="currentColor" />
          </svg>
        )}
        <span className={`font-mono text-[12px] truncate ${isCurrent ? 'text-accent' : ''}`}>
          {branch.name}
        </span>

        {/* Hover action buttons */}
        <div className="ml-auto flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            className="text-[10px] text-muted hover:text-accent font-semibold px-1 py-0.5 rounded hover:bg-[#21262D]"
            onClick={(e) => {
              e.stopPropagation();
              showModal({
                title: 'Rename Branch',
                message: `Enter new name for local branch "${branch.name}":`,
                confirmLabel: 'Rename',
                showTextInput: true,
                initialInputValue: branch.name,
                onConfirm: (newName) => {
                  if (newName && newName.trim() && newName.trim() !== branch.name) {
                    renameBranch(branch.name, newName.trim());
                  }
                },
              });
            }}
            title="Rename branch"
          >
            Rename
          </button>
          {!isCurrent && (
            <button
              className="text-[10px] text-muted hover:text-danger font-semibold px-1 py-0.5 rounded hover:bg-[#21262D]"
              onClick={(e) => {
                e.stopPropagation();
                // Find which remotes have this branch
                const branchData = repoState?.branches;
                const remotesWithBranch: string[] = [];
                if (branchData?.remotes) {
                  for (const remoteGroup of branchData.remotes) {
                    if (remoteGroup.branches.some((b) => b.label === branch.name)) {
                      remotesWithBranch.push(remoteGroup.remote);
                    }
                  }
                }

                const hasRemote = remotesWithBranch.length > 0;
                const firstRemote = remotesWithBranch[0] || '';

                showModal({
                  title: 'Delete Branch',
                  message: `Are you sure you want to delete local branch "${branch.name}"?`,
                  confirmLabel: 'Delete',
                  variant: 'danger',
                  showCheckbox: hasRemote,
                  checkboxLabel: remotesWithBranch.length === 1
                    ? `Also delete from remote "${firstRemote}" (git push ${firstRemote} --delete ${branch.name})`
                    : `Also delete from remotes (${remotesWithBranch.join(', ')})`,
                  checkboxDefaultChecked: false,
                  showTextInput: hasRemote && remotesWithBranch.length > 1,
                  initialInputValue: firstRemote,
                  inputPlaceholder: 'Which remote to delete from?',
                  onConfirm: (_value, checkboxChecked) => {
                    const targetRemote = remotesWithBranch.length > 1
                      ? (_value?.trim() || firstRemote)
                      : firstRemote;
                    deleteBranch(branch.name, false, checkboxChecked, targetRemote);
                  },
                });
              }}
              title="Delete branch"
            >
              Delete
            </button>
          )}
        </div>

        <span className="font-mono text-[10px] text-muted shrink-0 ml-1.5 group-hover:opacity-0 group-hover:w-0 overflow-hidden">
          {branch.commit}
        </span>
      </div>
    );
  };

  const renderRemoteRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = flatRemoteBranches[index];
    if (item.type === 'header') {
      return (
        <div style={style} className="flex items-center px-3 section-header pt-1">
          {item.remote}
        </div>
      );
    }
    const branch = item.branch!;
    return (
      <div
        style={style}
        className="flex items-center gap-2 px-3 cursor-pointer text-primary hover:bg-border/30 transition-colors text-[13px]"
        onClick={() => checkoutBranch(branch.name)}
      >
        <span className="font-mono text-[12px] truncate">{branch.label}</span>
        <span className="ml-auto font-mono text-[10px] text-muted shrink-0">{branch.commit}</span>
      </div>
    );
  };

  const isLoading = repoState?.loading.branches;

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
            width="14" height="14" viewBox="0 0 14 14" fill="none"
          >
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            className="input-field pl-8"
            placeholder="Filter branches..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Toggle */}
      <div className="flex border-b border-border">
        <button
          className={`flex-1 py-2 text-[12px] font-medium transition-colors ${
            activeGroup === 'local'
              ? 'text-accent border-b-2 border-accent'
              : 'text-muted hover:text-primary'
          }`}
          onClick={() => setActiveGroup('local')}
        >
          Local ({filteredLocal.length})
        </button>
        <button
          className={`flex-1 py-2 text-[12px] font-medium transition-colors ${
            activeGroup === 'remote'
              ? 'text-accent border-b-2 border-accent'
              : 'text-muted hover:text-primary'
          }`}
          onClick={() => setActiveGroup('remote')}
        >
          Remote ({flatRemoteBranches.filter((r) => r.type === 'branch').length})
        </button>
      </div>

      {/* Branch List */}
      <div className="flex-1 overflow-hidden" ref={containerRef}>
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-muted text-[13px]">
            <svg className="spinner mr-2" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="20 12" />
            </svg>
            Loading branches...
          </div>
        ) : activeGroup === 'local' ? (
          <FixedSizeList
            height={listHeight}
            width="100%"
            itemCount={filteredLocal.length}
            itemSize={32}
          >
            {renderLocalRow}
          </FixedSizeList>
        ) : (
          <FixedSizeList
            height={listHeight}
            width="100%"
            itemCount={flatRemoteBranches.length}
            itemSize={32}
          >
            {renderRemoteRow}
          </FixedSizeList>
        )}
      </div>
    </div>
  );
}
