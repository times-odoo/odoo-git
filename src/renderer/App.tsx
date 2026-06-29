import React, { useEffect, useState } from 'react';
import { useRepoStore } from './store/repos';
import { useGitStore } from './store/git';
import { useUIStore, Panel } from './store/ui';
import { useGit } from './hooks/useGit';
import { useRepo } from './hooks/useRepo';

// Layout
import { TitleBar } from './components/layout/TitleBar';
import { RepoRail } from './components/layout/RepoRail';
import { StatusBar } from './components/layout/StatusBar';
import { TerminalPanel } from './components/layout/TerminalPanel';

// Feature panels
import { BranchList } from './components/branches/BranchList';
import { BranchCreator } from './components/branches/BranchCreator';
import { MultiRepoSwitch } from './components/branches/MultiRepoSwitch';
import { DiffViewer } from './components/diff/DiffViewer';
import { GitAddPanel } from './components/commit/GitAddPanel';
import { CommitComposer } from './components/commit/CommitComposer';
import { OdooPanel } from './components/odoo/OdooPanel';
import { LogPanel } from './components/log/LogPanel';
import { PushPanel } from './components/push/PushPanel';
import { MultiRepoPush } from './components/push/MultiRepoPush';
import { PullPanel } from './components/push/PullPanel';
import { StashPanel } from './components/stash/StashPanel';
import { CherryPickPanel } from './components/cherry/CherryPickPanel';
import { RemotesPanel } from './components/remotes/RemotesPanel';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { GrepPanel } from './components/search/GrepPanel';

// Shared
import { Toast } from './components/shared/Toast';
import { Modal } from './components/shared/Modal';

const NAV_ITEMS: { panel: Panel; label: string; icon: React.ReactNode }[] = [
  {
    panel: 'branches',
    label: 'Branches',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="5" cy="4" r="2" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="5" cy="12" r="2" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="12" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" />
        <path d="M5 6V10M7 4.5L10 6.5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    panel: 'diff',
    label: 'Diff',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2 8H14" stroke="currentColor" strokeWidth="1" />
        <path d="M5 5H11M5 11H9" stroke="currentColor" strokeWidth="0.8" />
      </svg>
    ),
  },
  {
    panel: 'git-add',
    label: 'Git Add',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="7" height="11" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <path d="M4 5H7M4 8H7" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="11.5" cy="11.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M11.5 10V13M10 11.5H13" stroke="currentColor" strokeWidth="1" />
      </svg>
    ),
  },
  {
    panel: 'commit',
    label: 'Commit',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.2" />
        <path d="M8 2V5M8 11V14M2 8H5M11 8H14" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    panel: 'log',
    label: 'Log',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 4H12M4 7H10M4 10H12M4 13H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    panel: 'push',
    label: 'Push',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 12V4M5 7L8 4L11 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    panel: 'pull',
    label: 'Pull',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 4V12M5 9L8 12L11 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    panel: 'stash',
    label: 'Stash',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="3" y="3" width="10" height="3" rx="1" stroke="currentColor" strokeWidth="1.1" />
        <rect x="3" y="7" width="10" height="3" rx="1" stroke="currentColor" strokeWidth="1.1" />
        <rect x="3" y="11" width="10" height="3" rx="1" stroke="currentColor" strokeWidth="1.1" />
      </svg>
    ),
  },
  {
    panel: 'cherry-pick',
    label: 'Cherry',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="4" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="8" cy="8" r="1.5" fill="currentColor" />
        <path d="M8 4V2M6 4.5L4.5 3M10 4.5L11.5 3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    panel: 'remotes',
    label: 'Remotes',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2.5 8H13.5" stroke="currentColor" strokeWidth="0.8" />
        <ellipse cx="8" cy="8" rx="3" ry="5.5" stroke="currentColor" strokeWidth="1" />
      </svg>
    ),
  },
  {
    panel: 'grep',
    label: 'Search',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M10 10L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function App() {
  const { repos, activeRepoPath, openRepo } = useRepo();
  const { activePanel, setActivePanel, terminalOpen } = useUIStore();
  const { refreshAll, fetchRepo } = useGit(activeRepoPath);
  const repoState = useGitStore((s) => (activeRepoPath ? s.repoStates[activeRepoPath] : null));
  const [initialized, setInitialized] = useState(false);
  const [branchTab, setBranchTab] = useState<'list' | 'create' | 'multi'>('list');

  // Listen for terminal log updates from main process
  useEffect(() => {
    if (typeof window.git.onTerminalLog === 'function') {
      const unsubscribe = window.git.onTerminalLog((event: any) => {
        const store = useUIStore.getState();
        if (event.type === 'start') {
          store.addTerminalLog({
            commandId: event.commandId,
            command: event.command,
            timestamp: event.timestamp
          });
        } else if (event.type === 'stdout' || event.type === 'stderr') {
          store.appendTerminalOutput(event.commandId, event.data);
        } else if (event.type === 'end') {
          store.endTerminalLog(event.commandId);
        }
      });
      return () => unsubscribe();
    }
  }, []);

  // Load saved repos on startup
  useEffect(() => {
    const init = async () => {
      try {
        const settings = await window.git.getSettings();
        if (settings.repos.length > 0) {
          const store = useRepoStore.getState();
          store.setRepos(settings.repos);
          store.setActiveRepo(settings.lastActiveRepo || settings.repos[0].path);

          // Fetch initial git status, branches, and remotes for ALL repositories in the background
          settings.repos.forEach(async (r: any) => {
            const gitStore = useGitStore.getState();
            gitStore.setLoading(r.path, 'status', true);
            gitStore.setLoading(r.path, 'branches', true);
            try {
              const [status, branches, remotes] = await Promise.all([
                window.git.status(r.path),
                window.git.branches(r.path),
                window.git.remotes(r.path).catch(() => [])
              ]);
              gitStore.setRepoState(r.path, { status, branches, remotes });
            } catch (e) {
              console.error(`Failed to fetch initial git state for ${r.path}:`, e);
            } finally {
              gitStore.setLoading(r.path, 'status', false);
              gitStore.setLoading(r.path, 'branches', false);
            }
          });
        }
      } catch {}
      setInitialized(true);
    };
    init();
  }, []);

  // Refresh git state when active repo changes
  useEffect(() => {
    if (activeRepoPath && initialized) {
      refreshAll();
    }
  }, [activeRepoPath, initialized]);

  const status = repoState?.status;
  const isLoading = repoState?.loading;

  // Panel content renderer
  const renderPanel = () => {
    switch (activePanel) {
      case 'branches':
        return (
          <div className="flex flex-col h-full">
            <div className="flex border-b border-border shrink-0">
              <button
                className={`px-3 py-2 text-[12px] font-medium transition-colors ${
                  branchTab === 'list' ? 'text-accent border-b-2 border-accent' : 'text-muted hover:text-primary'
                }`}
                onClick={() => setBranchTab('list')}
              >
                Branches
              </button>
              <button
                className={`px-3 py-2 text-[12px] font-medium transition-colors ${
                  branchTab === 'create' ? 'text-accent border-b-2 border-accent' : 'text-muted hover:text-primary'
                }`}
                onClick={() => setBranchTab('create')}
              >
                Create
              </button>
              <button
                className={`px-3 py-2 text-[12px] font-medium transition-colors ${
                  branchTab === 'multi' ? 'text-accent border-b-2 border-accent' : 'text-muted hover:text-primary'
                }`}
                onClick={() => setBranchTab('multi')}
              >
                Multi Switch
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {branchTab === 'list' && <BranchList />}
              {branchTab === 'create' && <BranchCreator />}
              {branchTab === 'multi' && <MultiRepoSwitch />}
            </div>
          </div>
        );
      case 'diff':
        return <DiffViewer />;
      case 'git-add':
        return <GitAddPanel />;
      case 'commit':
        return <CommitComposer />;
      case 'log':
        return <LogPanel />;
      case 'push':
        return (
          <div className="flex flex-col h-full overflow-y-auto">
            <PushPanel />
            <div className="border-t border-border">
              <MultiRepoPush />
            </div>
          </div>
        );
      case 'pull':
        return <PullPanel />;
      case 'stash':
        return <StashPanel />;
      case 'cherry-pick':
        return <CherryPickPanel />;
      case 'remotes':
        return <RemotesPanel />;
      case 'grep':
        return <GrepPanel />;
      case 'settings':
        return <SettingsPanel />;
      default:
        return null;
    }
  };

  // Empty state
  if (initialized && repos.length === 0) {
    return (
      <div className="flex flex-col h-screen">
        <TitleBar />
        <div className="flex-1 flex items-center justify-center bg-bg">
          <div className="text-center space-y-4">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="mx-auto text-accent opacity-40">
              <path d="M12 2L3 7V17L12 22L21 17V7L12 2Z" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="12" cy="9" r="2" fill="currentColor" />
              <path d="M12 11V17M12 14L9 16M12 14L15 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <h2 className="text-[18px] font-semibold text-primary">Welcome to OdooGit</h2>
            <p className="text-muted text-[13px] max-w-xs">
              Git GUI purpose-built for Odoo R&D developers.
              <br />Open a repository to get started.
            </p>
            <button className="btn-accent py-2 px-6" onClick={openRepo}>
              Open Repository
            </button>
          </div>
        </div>
        <Toast />
        <Modal />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <TitleBar />
      <RepoRail />

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content Area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex flex-1 overflow-hidden">
            {/* Navigation Sidebar */}
            {activePanel !== 'settings' && (
              <div className="w-44 bg-surface border-r border-border flex flex-col shrink-0">
                {/* Current Branch Header */}
                {status && (
                  <div className="p-3 border-b border-border">
                    <div className="section-header mb-1">CURRENT BRANCH</div>
                    <div className="font-mono text-accent text-[13px] truncate" title={status.current || ''}>
                      {status.current || 'detached'}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px]">
                      {status.tracking && (
                        <span className="text-muted truncate">{status.tracking}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] font-mono">
                      {status.ahead > 0 && <span className="text-success">↑{status.ahead}</span>}
                      {status.behind > 0 && <span className="text-danger">↓{status.behind}</span>}
                      {status.isClean ? (
                        <span className="text-muted">clean</span>
                      ) : (
                        <span className="text-warning">dirty</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Fetch Button */}
                <div className="px-3 py-2 border-b border-border">
                  <button
                    className={`btn-surface w-full justify-center text-[12px] ${isLoading?.fetch ? 'opacity-60' : ''}`}
                    onClick={() => fetchRepo()}
                    disabled={isLoading?.fetch}
                  >
                    {isLoading?.fetch ? (
                      <>
                        <svg className="spinner" width="12" height="12" viewBox="0 0 14 14" fill="none">
                          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="20 12" />
                        </svg>
                        Fetching...
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M6 9V3M4 5L6 3L8 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M2 8V9C2 9.6 2.4 10 3 10H9C9.6 10 10 9.6 10 9V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        </svg>
                        Fetch All
                      </>
                    )}
                  </button>
                </div>

                {/* Nav Items */}
                <nav className="flex-1 overflow-y-auto py-1">
                  {NAV_ITEMS.map((item) => (
                    <button
                      key={item.panel}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors ${
                        activePanel === item.panel
                          ? 'text-accent bg-accent/8 border-r-2 border-accent'
                          : 'text-muted hover:text-primary hover:bg-border/20'
                      }`}
                      onClick={() => setActivePanel(item.panel)}
                    >
                      <span className={activePanel === item.panel ? 'text-accent' : ''}>{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </nav>
              </div>
            )}

            {/* Main Panel */}
            <div className="flex-1 overflow-hidden bg-bg relative">
              {/* Odoo Panel (kept mounted to preserve state & logs) */}
              <div className={`h-full w-full ${activePanel === 'odoo' ? 'block' : 'hidden'}`}>
                <OdooPanel />
              </div>
              {activePanel !== 'odoo' && renderPanel()}

              {/* Premium Glassmorphic Loading Overlay */}
              {(isLoading?.checkout || isLoading?.pull || isLoading?.rebase || isLoading?.cherryPick) && (
                <div className="absolute inset-0 bg-bg/50 backdrop-blur-sm flex flex-col items-center justify-center z-50 transition-all duration-300">
                  <div className="bg-surface/90 border border-border/80 rounded-xl p-6 flex flex-col items-center gap-3.5 shadow-2xl min-w-[200px] transform scale-100 animate-in fade-in zoom-in duration-200">
                    <div className="relative w-8 h-8 flex items-center justify-center">
                      <svg className="animate-spin text-accent" width="28" height="28" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    </div>
                    <span className="text-[13px] font-medium text-primary tracking-wide">
                      {isLoading?.checkout
                        ? 'Switching branch...'
                        : isLoading?.pull
                        ? 'Pulling changes...'
                        : isLoading?.rebase
                        ? 'Rebasing branch...'
                        : 'Cherry-picking commits...'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Terminal Drawer */}
          {terminalOpen && <TerminalPanel />}
        </div>
      </div>

      <StatusBar />
      <Toast />
      <Modal />
    </div>
  );
}
