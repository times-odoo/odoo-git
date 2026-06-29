import React, { useEffect, useState } from 'react';
import { useGitStore } from '../../store/git';
import { useRepoStore } from '../../store/repos';
import { useGit } from '../../hooks/useGit';
import { useUIStore } from '../../store/ui';
import { FileTree } from './FileTree';
import { HunkView } from './HunkView';

export function DiffViewer() {
  const activeRepoPath = useRepoStore((s) => s.activeRepoPath);
  const repoState = useGitStore((s) => (activeRepoPath ? s.repoStates[activeRepoPath] : null));
  const { refreshDiff } = useGit(activeRepoPath);
  const { selectedDiffFile, setSelectedDiffFile, diffViewMode, setDiffViewMode } = useUIStore();
  const [rawDiff, setRawDiff] = useState('');
  const [loadingRaw, setLoadingRaw] = useState(false);

  const status = repoState?.status;

  const getSmartDiffBase = () => {
    const tracking = status?.tracking;
    if (tracking) return tracking;

    const currentBranch = status?.current;
    if (!currentBranch) return null;

    const match = currentBranch.match(/^(master|\d+\.\d+|saas-\d+\.\d+)/i);
    if (match) {
      const version = match[1];
      return `odoo/${version}`;
    }
    return 'odoo/master';
  };

  // Load diff
  useEffect(() => {
    if (!activeRepoPath) return;
    const base = getSmartDiffBase();
    if (base) {
      refreshDiff({ base });
    } else {
      refreshDiff();
    }
  }, [activeRepoPath, status?.tracking, status?.current]);

  const files = repoState?.diffFiles || [];

  // If the selected file is no longer in the list, clear selection
  useEffect(() => {
    if (!selectedDiffFile) return;
    const exists = files.some((f) => f.file === selectedDiffFile);
    if (!exists) {
      setSelectedDiffFile(null);
    }
  }, [selectedDiffFile, files]);

  // Load raw diff for selected file
  useEffect(() => {
    if (!activeRepoPath || !selectedDiffFile) {
      setRawDiff('');
      return;
    }

    const loadRaw = async () => {
      setLoadingRaw(true);
      try {
        let args: string[];
        const base = getSmartDiffBase();
        if (base) {
          args = [`${base}...`, '--', selectedDiffFile];
        } else {
          args = ['--', selectedDiffFile];
        }
        const result = await window.git.diffRaw(activeRepoPath, args);
        setRawDiff(result);
      } catch {
        setRawDiff('');
      } finally {
        setLoadingRaw(false);
      }
    };

    loadRaw();
  }, [activeRepoPath, selectedDiffFile]);

  return (
    <div className="flex flex-col h-full">
      {/* Tabs & Controls */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5 shrink-0">
        <span className="font-semibold text-muted text-[11px] uppercase tracking-wider">
          Smart Diff
        </span>

        <div className="flex items-center gap-2">
          <button
            className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
              diffViewMode === 'unified' ? 'bg-border text-primary' : 'text-muted hover:text-primary'
            }`}
            onClick={() => setDiffViewMode('unified')}
          >
            Unified
          </button>
          <button
            className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
              diffViewMode === 'split' ? 'bg-border text-primary' : 'text-muted hover:text-primary'
            }`}
            onClick={() => setDiffViewMode('split')}
          >
            Split
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* File Tree - Left Panel */}
        <div className="w-64 border-r border-border overflow-y-auto shrink-0 flex flex-col bg-surface/50">
          <FileTree
            files={files}
            selectedFile={selectedDiffFile}
            onSelectFile={setSelectedDiffFile}
          />
        </div>

        {/* Diff Content - Right Panel */}
        <div className="flex-1 overflow-auto">
          {loadingRaw ? (
            <div className="flex items-center justify-center h-32 text-muted text-[13px]">
              <svg className="spinner mr-2" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="20 12" />
              </svg>
              Loading diff...
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 max-w-md mx-auto text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="text-[14px] font-semibold text-primary">No changes detected in Smart Diff</h3>
              <p className="text-[12px] text-muted leading-relaxed">
                Smart Diff shows all staged, unstaged, and committed changes in your branch compared to the base branch (<span className="font-mono text-accent">{getSmartDiffBase() || 'odoo/master'}</span>).
              </p>
              <div className="bg-surface border border-border/60 rounded-lg p-3.5 w-full text-left space-y-2 text-[11.5px] shadow-sm">
                <div className="font-bold text-primary uppercase text-[9px] tracking-wider mb-1">How to see changes here:</div>
                <div className="space-y-1.5 text-muted leading-normal font-sans">
                  <p>1. Edit files in the project workspace (working directory changes).</p>
                  <p>2. Stage them in the <span className="text-accent font-semibold font-mono">Git Add</span> panel.</p>
                  <p>3. Create a commit to save changes to your branch.</p>
                </div>
              </div>
            </div>
          ) : rawDiff ? (
            <HunkView rawDiff={rawDiff} viewMode={diffViewMode} />
          ) : selectedDiffFile ? (
            <div className="text-muted text-center py-8 text-[13px]">No diff content</div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted text-[13px]">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="mb-3 opacity-30">
                <rect x="4" y="4" width="24" height="24" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M4 16H28" stroke="currentColor" strokeWidth="1" />
                <path d="M16 4V28" stroke="currentColor" strokeWidth="1" />
              </svg>
              Select a file to view diff
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
