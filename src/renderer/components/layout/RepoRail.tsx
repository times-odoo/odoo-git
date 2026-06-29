import React, { useState, useRef, useEffect } from 'react';
import { useRepo } from '../../hooks/useRepo';
import { useGitStore } from '../../store/git';
import { useUIStore } from '../../store/ui';

export function RepoRail() {
  const { repos, activeRepoPath, setActiveRepo, addRepo, removeRepo, openRepo } = useRepo();
  const { activePanel, setActivePanel } = useUIStore();
  const repoStates = useGitStore((s) => s.repoStates);

  const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [cloneUrl, setCloneUrl] = useState('');
  const [cloneParentDir, setCloneParentDir] = useState('/home/odoo/odoo19');
  const [cloneRepoName, setCloneRepoName] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [cloneError, setCloneError] = useState('');

  const addDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (addDropdownRef.current && !addDropdownRef.current.contains(event.target as Node)) {
        setIsAddDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClone = async () => {
    if (!cloneUrl || !cloneParentDir || !cloneRepoName) return;
    setIsCloning(true);
    setCloneError('');

    const targetPath = `${cloneParentDir}/${cloneRepoName}`.replace(/\/+/g, '/');

    try {
      await window.git.cloneRepo(cloneUrl, targetPath);
      
      addRepo({
        path: targetPath,
        name: cloneRepoName,
      });
      setActiveRepo(targetPath);
      
      setIsCloneModalOpen(false);
      setCloneUrl('');
      setCloneRepoName('');
    } catch (err: any) {
      console.error('Clone failed:', err);
      setCloneError(err.message || 'An error occurred during git clone');
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <div className="h-12 bg-surface border-b border-border flex flex-row items-center px-4 gap-0 shrink-0 w-full select-none">
      {/* Repository Tabs */}
      <div className="flex items-stretch gap-0 overflow-x-auto max-w-[65%] scrollbar-none h-full">
        {repos.map((repo) => {
          const isActive = repo.path === activeRepoPath && activePanel !== 'settings' && activePanel !== 'odoo';
          const repoState = repoStates[repo.path];
          const isDirty = repoState?.status && !repoState.status.isClean;
          let currentBranch = 'loading...';
          if (repoState) {
            if (repoState.status) {
              currentBranch = repoState.status.current || 'detached';
            } else if (repoState.loading.status) {
              currentBranch = 'loading...';
            } else {
              currentBranch = 'detached';
            }
          }

          return (
            <div
              key={repo.path}
              className={`relative group flex flex-col justify-center h-full min-w-[125px] max-w-[185px] pl-4 pr-10 border-b-2 cursor-pointer transition-all duration-150 ${
                isActive
                  ? 'text-accent border-accent bg-accent/5'
                  : 'text-muted border-transparent hover:text-primary hover:bg-surface-hover/10'
              }`}
              onClick={() => {
                setActiveRepo(repo.path);
                if (activePanel === 'settings' || activePanel === 'odoo') {
                  setActivePanel('branches');
                }
              }}
              title={`${repo.name}\nBranch: ${currentBranch}\nPath: ${repo.path}`}
            >
              {/* Repo Info */}
              <div className="flex flex-col justify-center min-w-0">
                {/* Top Row: Repo Name & Status */}
                <div className="flex items-center gap-1.5 min-w-0">
                  {isDirty && (
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 animate-pulse ${isActive ? 'bg-accent' : 'bg-warning'}`} />
                  )}
                  <span className={`font-semibold text-[11px] truncate leading-tight ${isActive ? 'text-white' : 'text-primary'}`}>{repo.name}</span>
                </div>

                {/* Bottom Row: Current Branch */}
                <div className="flex items-center gap-0.5 text-[9px] font-mono opacity-90 truncate leading-none mt-0.5">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 text-accent">
                    <line x1="6" y1="3" x2="6" y2="15"></line>
                    <circle cx="18" cy="6" r="3"></circle>
                    <circle cx="6" cy="18" r="3"></circle>
                    <path d="M18 9a9 9 0 0 1-9 9"></path>
                  </svg>
                  <span className={`truncate ${isActive ? 'text-accent/80' : 'text-muted'}`}>{currentBranch}</span>
                </div>
              </div>

              {/* Close Button: Absolute positioned to use full height */}
              <button
                className={`absolute right-0 top-0 bottom-0 w-8 flex items-center justify-center text-[14px] font-medium transition-all opacity-0 group-hover:opacity-100 ${
                  isActive
                    ? 'hover:bg-accent/15 text-accent/70 hover:text-accent'
                    : 'hover:bg-border/40 text-muted hover:text-danger'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  removeRepo(repo.path);
                }}
                title="Close Repository"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {/* Add Repo Button */}
      <div className="relative flex items-center px-3 h-full border-b-2 border-transparent" ref={addDropdownRef}>
        <button
          className="h-7 w-7 rounded flex items-center justify-center text-muted hover:text-accent hover:bg-accent/10 transition-colors border border-dashed border-border hover:border-accent/40 shrink-0"
          onClick={() => setIsAddDropdownOpen(!isAddDropdownOpen)}
          title="Add/Clone Repository"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {isAddDropdownOpen && (
          <div className="absolute left-0 top-11 bg-[#1C2129] border border-border rounded shadow-xl z-[100] py-1 min-w-[200px] flex flex-col">
            <button
              className="px-4 py-2.5 text-left font-sans text-[12px] text-primary hover:bg-border/30 hover:text-accent transition-colors flex items-center gap-2"
              onClick={() => {
                setIsAddDropdownOpen(false);
                openRepo();
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span>Open Local Repository</span>
            </button>
            <button
              className="px-4 py-2.5 text-left font-sans text-[12px] text-primary hover:bg-border/30 hover:text-accent transition-colors flex items-center gap-2"
              onClick={() => {
                setIsAddDropdownOpen(false);
                setIsCloneModalOpen(true);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1" />
                <path d="M18 8h6" />
                <path d="M14 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
              </svg>
              <span>Clone from Git Link</span>
            </button>
          </div>
        )}
      </div>

      {/* Spacer to push Odoo DB and Settings to the right */}
      <div className="flex-1 border-b-2 border-transparent h-full" />

      {/* Odoo DB Button */}
      <button
        className={`h-full px-4 border-b-2 flex items-center gap-1.5 transition-all duration-150 text-[11px] font-semibold shrink-0 ${
          activePanel === 'odoo'
            ? 'text-white border-accent bg-accent/5'
            : 'text-muted border-transparent hover:text-primary hover:bg-surface-hover/10'
        }`}
        onClick={() => setActivePanel('odoo')}
        title="Odoo DB Integration"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" className={activePanel === 'odoo' ? 'text-accent' : ''}>
          <path d="M4 2H12C13.1046 2 14 2.89543 14 4V12C14 13.1046 13.1046 14 12 14H4C2.89543 14 2 13.1046 2 12V4C2 2.89543 2.89543 2 4 2Z" strokeWidth="1.2"/>
          <path d="M6 5V11" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M10 5V11" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M6 8H10" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <span>Odoo DB</span>
      </button>

      {/* Settings Button */}
      <button
        className={`h-full px-4 border-b-2 flex items-center gap-1.5 transition-all duration-150 text-[11px] font-semibold shrink-0 mr-1 ${
          activePanel === 'settings'
            ? 'text-white border-accent bg-accent/5'
            : 'text-muted border-transparent hover:text-primary hover:bg-surface-hover/10'
        }`}
        onClick={() => setActivePanel('settings')}
        title="Settings"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={activePanel === 'settings' ? 'text-accent' : ''}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        <span>Settings</span>
      </button>

      {/* Clone Modal Overlay */}
      {isCloneModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-[1000] backdrop-blur-sm p-4">
          <div className="bg-[#1C2129] border border-border rounded-lg shadow-2xl max-w-md w-full p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <h3 className="text-primary font-semibold text-[15px] flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1" />
                  <path d="M18 8h6" />
                  <path d="M14 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
                </svg>
                Clone Repository
              </h3>
              <button
                className="text-muted hover:text-primary transition-colors font-semibold text-[16px] p-1"
                onClick={() => {
                  if (!isCloning) setIsCloneModalOpen(false);
                }}
              >
                ×
              </button>
            </div>

            {cloneError && (
              <div className="text-danger bg-danger/10 border border-danger/20 rounded p-2.5 text-[11px] font-mono whitespace-pre-wrap">
                {cloneError}
              </div>
            )}

            {/* Git Link URL */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted font-medium uppercase tracking-wider">Git Clone URL</label>
              <input
                type="text"
                className="input-field font-mono text-[12px] w-full"
                placeholder="https://github.com/odoo/odoo.git"
                value={cloneUrl}
                onChange={(e) => {
                  const url = e.target.value;
                  setCloneUrl(url);
                  // Guess repo name
                  const match = url.match(/\/([^\/]+)\.git$/) || url.match(/\/([^\/]+)$/);
                  if (match && match[1]) {
                    setCloneRepoName(match[1]);
                  }
                }}
                disabled={isCloning}
                autoFocus
              />
            </div>

            {/* Parent Directory */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted font-medium uppercase tracking-wider">Parent Directory</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input-field font-mono text-[12px] flex-1"
                  value={cloneParentDir}
                  onChange={(e) => setCloneParentDir(e.target.value)}
                  disabled={isCloning}
                />
                <button
                  type="button"
                  className="px-3 bg-surface border border-border rounded text-[12px] text-primary hover:bg-border/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                  onClick={async () => {
                    const dir = await window.git.selectDirectory();
                    if (dir) setCloneParentDir(dir);
                  }}
                  disabled={isCloning}
                >
                  Browse...
                </button>
              </div>
            </div>

            {/* Directory Name */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted font-medium uppercase tracking-wider">Target Folder Name</label>
              <input
                type="text"
                className="input-field font-mono text-[12px] w-full"
                placeholder="odoo"
                value={cloneRepoName}
                onChange={(e) => setCloneRepoName(e.target.value)}
                disabled={isCloning}
              />
            </div>

            {/* Preview Destination Path */}
            <div className="bg-[#0D1117]/80 border border-border/40 rounded p-2.5">
              <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Target Destination Path</label>
              <span className="font-mono text-accent text-[12px] break-all select-all">
                {cloneParentDir && cloneRepoName ? `${cloneParentDir}/${cloneRepoName}`.replace(/\/+/g, '/') : '—'}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-border/40 pt-3">
              <button
                type="button"
                className="px-4 py-2 border border-border rounded text-[12px] text-primary hover:bg-border/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => setIsCloneModalOpen(false)}
                disabled={isCloning}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded text-[12px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                onClick={handleClone}
                disabled={isCloning || !cloneUrl || !cloneParentDir || !cloneRepoName}
              >
                {isCloning ? (
                  <>
                    <svg className="spinner text-white animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="20 12" />
                    </svg>
                    Cloning...
                  </>
                ) : (
                  'Clone'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
