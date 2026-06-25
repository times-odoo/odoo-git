import React, { useEffect, useState, useMemo } from 'react';
import { useRepoStore } from '../../store/repos';
import { useGitStore } from '../../store/git';
import { useGit } from '../../hooks/useGit';
import { useUIStore } from '../../store/ui';

export function RemotesPanel() {
  const activeRepoPath = useRepoStore((s) => s.activeRepoPath);
  const repoState = useGitStore((s) => (activeRepoPath ? s.repoStates[activeRepoPath] : null));
  const { refreshRemotes } = useGit(activeRepoPath);
  const addToast = useUIStore((s) => s.addToast);
  const showModal = useUIStore((s) => s.showModal);
  const terminalLogs = useUIStore((s) => s.terminalLogs);

  const [editingRemote, setEditingRemote] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'fetch' | 'push' | null>(null);
  const [editValue, setEditValue] = useState('');

  // Add remote form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRemoteName, setNewRemoteName] = useState('');
  const [newRemoteUrl, setNewRemoteUrl] = useState('');

  // Loading states with operation name
  const [operationLoading, setOperationLoading] = useState<string | null>(null);

  useEffect(() => {
    if (activeRepoPath) refreshRemotes();
  }, [activeRepoPath]);

  const remotes = repoState?.remotes || [];

  // Odoo remote convention detection
  const knownRemotes = {
    odoo: 'Community (fetch)',
    'odoo-dev': 'Community (push)',
    ent: 'Enterprise (fetch)',
    'ent-dev': 'Enterprise (push)',
  };

  // Find the latest remote-related terminal command (running or completed)
  const remoteLog = useMemo(() => {
    return [...terminalLogs].reverse().find((l) => l.command.includes('remote') || l.command.includes('push'));
  }, [terminalLogs]);

  const progressLine = useMemo(() => {
    if (!remoteLog?.output) return '';
    // Split by newline and carriage return to handle progress overwrites properly
    const rawLines = remoteLog.output.split(/[\r\n]+/);
    const cleaned = rawLines.map((l) => l.trim()).filter(Boolean);
    return cleaned[cleaned.length - 1] || '';
  }, [remoteLog]);

  const startEdit = (remoteName: string, field: 'fetch' | 'push', currentValue: string) => {
    setEditingRemote(remoteName);
    setEditingField(field);
    setEditValue(currentValue);
  };

  const handleSave = async (remoteName: string, type: 'fetch' | 'push') => {
    if (!activeRepoPath || !editValue.trim()) return;
    await window.git.setRemoteUrl(activeRepoPath, remoteName, editValue.trim(), type === 'push');
    setEditingRemote(null);
    setEditingField(null);
    refreshRemotes();
  };

  const handleAddRemote = async () => {
    if (!activeRepoPath || !newRemoteName.trim() || !newRemoteUrl.trim()) return;
    setOperationLoading(`Adding remote "${newRemoteName.trim()}"...`);
    try {
      await window.git.addRemote(activeRepoPath, newRemoteName.trim(), newRemoteUrl.trim());
      addToast({ message: `Added remote "${newRemoteName.trim()}"`, type: 'success' });
      setNewRemoteName('');
      setNewRemoteUrl('');
      setShowAddForm(false);
      refreshRemotes();
    } catch (e: any) {
      addToast({ message: e?.message || 'Failed to add remote', type: 'error' });
    } finally {
      setOperationLoading(null);
    }
  };

  const handleRenameRemote = (remoteName: string) => {
    showModal({
      title: 'Rename Remote',
      message: `Enter new name for remote "${remoteName}":`,
      confirmLabel: 'Rename',
      showTextInput: true,
      initialInputValue: remoteName,
      onConfirm: async (newName) => {
        if (!activeRepoPath || !newName?.trim() || newName.trim() === remoteName) return;
        setOperationLoading(`Renaming "${remoteName}" to "${newName.trim()}"...`);
        try {
          await window.git.renameRemote(activeRepoPath, remoteName, newName.trim());
          addToast({ message: `Renamed remote "${remoteName}" to "${newName.trim()}"`, type: 'success' });
          refreshRemotes();
        } catch (e: any) {
          addToast({ message: e?.message || 'Failed to rename remote', type: 'error' });
        } finally {
          setOperationLoading(null);
        }
      },
    });
  };

  const handleDeleteRemote = (remoteName: string) => {
    // Prevent deleting the last remote
    if (remotes.length <= 1) {
      addToast({ message: 'Cannot delete the last remote. At least one remote must remain.', type: 'warning' });
      return;
    }

    showModal({
      title: 'Delete Remote',
      message: `Are you sure you want to delete remote "${remoteName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        if (!activeRepoPath) return;
        setOperationLoading(`Deleting remote "${remoteName}"...`);
        try {
          await window.git.deleteRemote(activeRepoPath, remoteName);
          addToast({ message: `Deleted remote "${remoteName}"`, type: 'success' });
          refreshRemotes();
        } catch (e: any) {
          addToast({ message: e?.message || 'Failed to delete remote', type: 'error' });
        } finally {
          setOperationLoading(null);
        }
      },
    });
  };

  return (
    <div className="p-4 space-y-4 relative">
      {/* Loading overlay with live progress */}
      {operationLoading && (
        <div className="fixed inset-0 bg-bg/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <div className="bg-surface border border-border rounded-xl p-5 flex flex-col items-center gap-3 shadow-2xl min-w-[260px]">
            <svg className="animate-spin text-accent" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-[13px] font-medium text-primary">{operationLoading}</span>
            {remoteLog && (
              <div className="w-full mt-3 p-3 bg-black/60 rounded border border-border/40 font-mono text-[11px] text-left overflow-hidden max-w-lg">
                <div className="text-muted whitespace-pre-wrap break-all mb-1">
                  odoo@times-laptop:{activeRepoPath ? activeRepoPath.replace('/home/odoo', '~') : ''} ({repoState?.status?.current || 'master'})$ {remoteLog.command}
                </div>
                <div className="space-y-1 text-success/90 select-text max-h-32 overflow-y-auto">
                  {progressLine && (
                    <div className="whitespace-pre-wrap">{progressLine}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="section-header">REMOTES</h3>
        <button
          className="btn-surface text-[11px] px-2.5 py-1 font-semibold flex items-center gap-1.5"
          onClick={() => setShowAddForm(!showAddForm)}
          disabled={!!operationLoading}
        >
          {showAddForm ? (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Remote
            </>
          )}
        </button>
      </div>

      {/* Add Remote Form */}
      {showAddForm && (
        <div className="bg-surface border border-border rounded p-3 space-y-2.5 fade-in">
          <div>
            <label className="text-[11px] text-muted mb-1 block">Name</label>
            <input
              type="text"
              className="input-field w-full font-mono text-[12px]"
              placeholder="e.g. upstream, origin, my-fork"
              value={newRemoteName}
              onChange={(e) => setNewRemoteName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddRemote()}
            />
          </div>
          <div>
            <label className="text-[11px] text-muted mb-1 block">URL</label>
            <input
              type="text"
              className="input-field w-full font-mono text-[12px]"
              placeholder="e.g. git@github.com:user/repo.git"
              value={newRemoteUrl}
              onChange={(e) => setNewRemoteUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddRemote()}
            />
          </div>
          <button
            className={`btn-accent w-full justify-center py-1.5 text-[12px] ${!newRemoteName.trim() || !newRemoteUrl.trim() || !!operationLoading ? 'opacity-40 cursor-not-allowed' : ''}`}
            disabled={!newRemoteName.trim() || !newRemoteUrl.trim() || !!operationLoading}
            onClick={handleAddRemote}
          >
            Add Remote
          </button>
        </div>
      )}

      {remotes.length === 0 ? (
        <div className="text-muted text-center py-8 text-[13px]">No remotes configured</div>
      ) : (
        <div className="space-y-3">
          {remotes.map((remote) => {
            const convention = knownRemotes[remote.name as keyof typeof knownRemotes];
            const hasHttpsFetch = remote.fetchUrl && remote.fetchUrl.startsWith('http');
            const hasHttpsPush = remote.pushUrl && remote.pushUrl.startsWith('http');
            const isLastRemote = remotes.length <= 1;

            return (
              <div key={remote.name} className="bg-bg border border-border rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-accent text-[13px] font-medium">{remote.name}</span>
                  {convention && (
                    <span className="text-[10px] text-muted px-1.5 py-0.5 rounded bg-surface border border-border">
                      {convention}
                    </span>
                  )}
                  {remote.name.endsWith('-dev') && (
                    <span className="text-[10px] text-success px-1.5 py-0.5 rounded bg-success/10 border border-success/20">
                      push target
                    </span>
                  )}

                  {/* Remote action buttons */}
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      className="text-[10px] text-muted hover:text-accent font-semibold px-1.5 py-0.5 rounded hover:bg-[#21262D] transition-colors"
                      onClick={() => handleRenameRemote(remote.name)}
                      disabled={!!operationLoading}
                      title="Rename remote"
                    >
                      Rename
                    </button>
                    <button
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded transition-colors ${
                        isLastRemote
                          ? 'text-muted/40 cursor-not-allowed'
                          : 'text-muted hover:text-danger hover:bg-[#21262D]'
                      }`}
                      onClick={() => handleDeleteRemote(remote.name)}
                      disabled={!!operationLoading || isLastRemote}
                      title={isLastRemote ? 'Cannot delete the last remote' : 'Delete remote'}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-[12px]">
                  {/* Fetch URL */}
                  <div className="flex items-center justify-between gap-2 min-h-6 group">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-muted w-12 shrink-0">fetch</span>
                      {editingRemote === remote.name && editingField === 'fetch' ? (
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <input
                            type="text"
                            className="input-field font-mono text-[12px] py-0.5 px-2 flex-1 min-w-0"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSave(remote.name, 'fetch');
                              if (e.key === 'Escape') setEditingRemote(null);
                            }}
                            autoFocus
                          />
                          <button onClick={() => handleSave(remote.name, 'fetch')} title="Save">
                            <svg className="w-4 h-4 text-success hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button onClick={() => setEditingRemote(null)} title="Cancel">
                            <svg className="w-4 h-4 text-danger hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <span className={`font-mono truncate flex-1 ${hasHttpsFetch ? 'text-warning' : 'text-primary'}`}>{remote.fetchUrl}</span>
                      )}
                    </div>
                    {!(editingRemote === remote.name && editingField === 'fetch') && (
                      <button
                        onClick={() => startEdit(remote.name, 'fetch', remote.fetchUrl)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
                        title="Edit Fetch URL"
                      >
                        <svg className="w-3.5 h-3.5 text-muted hover:text-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Push URL */}
                  <div className="flex items-center justify-between gap-2 min-h-6 group">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-muted w-12 shrink-0">push</span>
                      {editingRemote === remote.name && editingField === 'push' ? (
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <input
                            type="text"
                            className="input-field font-mono text-[12px] py-0.5 px-2 flex-1 min-w-0"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSave(remote.name, 'push');
                              if (e.key === 'Escape') setEditingRemote(null);
                            }}
                            autoFocus
                          />
                          <button onClick={() => handleSave(remote.name, 'push')} title="Save">
                            <svg className="w-4 h-4 text-success hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button onClick={() => setEditingRemote(null)} title="Cancel">
                            <svg className="w-4 h-4 text-danger hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <span className={`font-mono truncate flex-1 ${hasHttpsPush ? 'text-warning' : 'text-primary'}`}>{remote.pushUrl}</span>
                      )}
                    </div>
                    {!(editingRemote === remote.name && editingField === 'push') && (
                      <button
                        onClick={() => startEdit(remote.name, 'push', remote.pushUrl)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
                        title="Edit Push URL"
                      >
                        <svg className="w-3.5 h-3.5 text-muted hover:text-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
