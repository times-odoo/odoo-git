import { useCallback } from 'react';
import { useGitStore } from '../store/git';
import { useUIStore } from '../store/ui';

export function useGit(repoPath: string | null) {
  const { getRepoState, setRepoState, setLoading, setError } = useGitStore();
  const { addToast, showModal } = useUIStore();

  const state = repoPath ? getRepoState(repoPath) : null;

  const handleError = useCallback(
    (error: any, operation: string) => {
      const message = error?.message || `${operation} failed`;
      if (repoPath) setError(repoPath, message);
      addToast({ message, type: 'error' });
      console.error(`[${operation}]`, error);
    },
    [repoPath, setError, addToast]
  );

  const refreshStatus = useCallback(async () => {
    if (!repoPath) return;
    setLoading(repoPath, 'status', true);
    try {
      const status = await window.git.status(repoPath);
      setRepoState(repoPath, { status });
    } catch (e) {
      handleError(e, 'Status');
    } finally {
      setLoading(repoPath, 'status', false);
    }
  }, [repoPath, setLoading, setRepoState, handleError]);

  const refreshBranches = useCallback(async () => {
    if (!repoPath) return;
    setLoading(repoPath, 'branches', true);
    try {
      const branches = await window.git.branches(repoPath);
      setRepoState(repoPath, { branches });
    } catch (e) {
      handleError(e, 'Branches');
    } finally {
      setLoading(repoPath, 'branches', false);
    }
  }, [repoPath, setLoading, setRepoState, handleError]);

  const refreshLog = useCallback(
    async (opts?: { maxCount?: number; from?: string; to?: string }) => {
      if (!repoPath) return;
      setLoading(repoPath, 'log', true);
      try {
        const log = await window.git.log(repoPath, opts);
        setRepoState(repoPath, { log });
      } catch (e) {
        handleError(e, 'Log');
      } finally {
        setLoading(repoPath, 'log', false);
      }
    },
    [repoPath, setLoading, setRepoState, handleError]
  );

  const refreshDiff = useCallback(
    async (opts?: { base?: string; staged?: boolean; file?: string }) => {
      if (!repoPath) return;
      setLoading(repoPath, 'diff', true);
      try {
        const diffFiles = await window.git.diff(repoPath, opts);
        setRepoState(repoPath, { diffFiles });
      } catch (e) {
        handleError(e, 'Diff');
      } finally {
        setLoading(repoPath, 'diff', false);
      }
    },
    [repoPath, setLoading, setRepoState, handleError]
  );

  const refreshRemotes = useCallback(async () => {
    if (!repoPath) return;
    try {
      const remotes = await window.git.remotes(repoPath);
      setRepoState(repoPath, { remotes });
    } catch (e) {
      handleError(e, 'Remotes');
    }
  }, [repoPath, setRepoState, handleError]);

  const refreshStashes = useCallback(async () => {
    if (!repoPath) return;
    try {
      const stashes = await window.git.stashList(repoPath);
      setRepoState(repoPath, { stashes });
    } catch (e) {
      handleError(e, 'Stash list');
    }
  }, [repoPath, setRepoState, handleError]);

  const refreshStatusAndDiff = useCallback(async () => {
    if (!repoPath) return;
    await refreshStatus();
    const currentState = getRepoState(repoPath);
    const tracking = currentState?.status?.tracking;
    const current = currentState?.status?.current;
    let base = tracking || null;
    if (!base && current) {
      const match = current.match(/^(master|\d+\.\d+|saas-\d+\.\d+)/i);
      if (match) {
        base = `odoo/${match[1]}`;
      } else {
        base = 'odoo/master';
      }
    }
    await refreshDiff(base ? { base } : undefined);
  }, [repoPath, refreshStatus, refreshDiff, getRepoState]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshStatusAndDiff(), refreshBranches(), refreshRemotes()]);
  }, [refreshStatusAndDiff, refreshBranches, refreshRemotes]);

  const fetchRepo = useCallback(
    async (remote?: string) => {
      if (!repoPath) return;
      setLoading(repoPath, 'fetch', true);
      try {
        if (remote) {
          await window.git.fetch(repoPath, remote);
          addToast({ message: `Fetch from ${remote} completed`, type: 'success' });
        } else {
          const result = await window.git.fetchAll(repoPath);
          if (result.success) {
            addToast({ message: 'Fetch completed successfully', type: 'success' });
          } else {
            addToast({
              message: `Fetch finished (failed remotes: ${result.errors.map((e) => e.split(':')[0]).join(', ')})`,
              type: 'warning',
            });
          }
        }
        setRepoState(repoPath, { lastFetched: new Date().toISOString() });
        await refreshAll();
      } catch (e) {
        handleError(e, 'Fetch');
      } finally {
        setLoading(repoPath, 'fetch', false);
      }
    },
    [repoPath, setLoading, setRepoState, addToast, refreshAll, handleError]
  );

  const renameBranch = useCallback(
    async (oldName: string, newName: string) => {
      if (!repoPath) return;
      try {
        await window.git.renameBranch(repoPath, oldName, newName);
        addToast({ message: `Renamed branch ${oldName} to ${newName}`, type: 'success' });
        await refreshBranches();
      } catch (e) {
        handleError(e, 'Rename branch');
      }
    },
    [repoPath, addToast, refreshBranches, handleError]
  );

  const deleteBranch = useCallback(
    async (name: string, force: boolean, deleteFromRemote?: boolean, targetRemote?: string) => {
      if (!repoPath) return;
      try {
        await window.git.deleteBranch(repoPath, name, force);
        addToast({ message: `Deleted local branch ${name}`, type: 'success' });

        // Also delete from remote if requested
        if (deleteFromRemote && targetRemote) {
          try {
            await window.git.deleteRemoteBranch(repoPath, targetRemote, name);
            addToast({ message: `Deleted ${name} from remote ${targetRemote}`, type: 'success' });
          } catch (e: any) {
            addToast({ message: e?.message || 'Failed to delete from remote', type: 'error' });
          }
        }

        await refreshBranches();
      } catch (e: any) {
        const errorMsg = e?.message || '';
        if (errorMsg.includes('not fully merged') && !force) {
          showModal({
            title: 'Force Delete Branch',
            message: `The branch "${name}" is not fully merged. Deleting it will permanently lose any unmerged commits. Are you sure you want to force delete it?`,
            confirmLabel: 'Force Delete',
            variant: 'danger',
            onConfirm: () => {
              deleteBranch(name, true, deleteFromRemote, targetRemote);
            },
          });
        } else {
          handleError(e, 'Delete branch');
        }
      }
    },
    [repoPath, addToast, refreshBranches, showModal, handleError]
  );

  const resetHard = useCallback(async () => {
    if (!repoPath) return;
    try {
      await window.git.resetHard(repoPath);
      addToast({ message: 'Hard reset completed. Working tree is clean.', type: 'success' });
      await refreshAll();
    } catch (e) {
      handleError(e, 'Hard reset');
    }
  }, [repoPath, addToast, refreshAll, handleError]);

  const checkoutBranch = useCallback(
    async (branch: string) => {
      if (!repoPath) return;
      setLoading(repoPath, 'checkout', true);
      try {
        await window.git.checkout(repoPath, branch);
        addToast({ message: `Switched to ${branch}`, type: 'success' });
        await refreshAll();
      } catch (e) {
        handleError(e, 'Checkout');
      } finally {
        setLoading(repoPath, 'checkout', false);
      }
    },
    [repoPath, setLoading, addToast, refreshAll, handleError]
  );

  const createBranch = useCallback(
    async (branch: string, startPoint: string) => {
      if (!repoPath) return;
      setLoading(repoPath, 'createBranch', true);
      try {
        await window.git.checkoutNew(repoPath, branch, startPoint);
        addToast({ message: `Created & switched to ${branch}`, type: 'success' });
        await refreshAll();
      } catch (e) {
        handleError(e, 'Create branch');
      } finally {
        setLoading(repoPath, 'createBranch', false);
      }
    },
    [repoPath, setLoading, addToast, refreshAll, handleError]
  );

  const commitChanges = useCallback(
    async (message: string) => {
      if (!repoPath) return;
      setLoading(repoPath, 'commit', true);
      try {
        await window.git.commit(repoPath, message);
        addToast({ message: 'Commit created', type: 'success' });
        await refreshStatusAndDiff();
      } catch (e) {
        handleError(e, 'Commit');
      } finally {
        setLoading(repoPath, 'commit', false);
      }
    },
    [repoPath, setLoading, addToast, refreshStatusAndDiff, handleError]
  );

  const amendCommit = useCallback(
    async (message: string) => {
      if (!repoPath) return;
      setLoading(repoPath, 'commit', true);
      try {
        await window.git.amend(repoPath, message);
        addToast({ message: 'Commit amended', type: 'success' });
        await refreshStatusAndDiff();
      } catch (e) {
        handleError(e, 'Amend');
      } finally {
        setLoading(repoPath, 'commit', false);
      }
    },
    [repoPath, setLoading, addToast, refreshStatusAndDiff, handleError]
  );

  const amendNoEdit = useCallback(async () => {
    if (!repoPath) return;
    setLoading(repoPath, 'commit', true);
    try {
      await window.git.amendNoEdit(repoPath);
      addToast({ message: 'Commit amended (no edit)', type: 'success' });
      await refreshStatusAndDiff();
    } catch (e) {
      handleError(e, 'Amend');
    } finally {
      setLoading(repoPath, 'commit', false);
    }
  }, [repoPath, setLoading, addToast, refreshStatusAndDiff, handleError]);

  const pushBranch = useCallback(
    async (remote: string, branch: string, opts?: { force?: boolean; forceWithLease?: boolean }) => {
      if (!repoPath) return;
      setLoading(repoPath, 'push', true);
      try {
        const result = await window.git.push(repoPath, remote, branch, opts);
        if (result.success) {
          addToast({ message: result.message, type: 'success' });
        } else {
          addToast({ message: result.message, type: 'error' });
        }
        await refreshStatusAndDiff();
        return result;
      } catch (e) {
        handleError(e, 'Push');
        return { success: false, message: 'Push failed' };
      } finally {
        setLoading(repoPath, 'push', false);
      }
    },
    [repoPath, setLoading, addToast, refreshStatusAndDiff, handleError]
  );

  const pullBranch = useCallback(
    async (remote: string, branch: string, opts?: { rebase?: boolean }) => {
      if (!repoPath) return;
      setLoading(repoPath, 'pull', true);
      try {
        await window.git.pull(repoPath, remote, branch, opts);
        addToast({ message: 'Pull completed', type: 'success' });
        await refreshAll();
      } catch (e) {
        handleError(e, 'Pull');
      } finally {
        setLoading(repoPath, 'pull', false);
      }
    },
    [repoPath, setLoading, addToast, refreshAll, handleError]
  );

  const rebaseBranch = useCallback(
    async (onto: string) => {
      if (!repoPath) return;
      setLoading(repoPath, 'rebase', true);
      try {
        const result = await window.git.rebase(repoPath, onto);
        if (result.success) {
          addToast({ message: 'Rebase completed', type: 'success' });
        } else {
          addToast({
            message: `Rebase conflicts in ${result.conflicts.length} file(s)`,
            type: 'warning',
          });
        }
        await refreshAll();
        return result;
      } catch (e) {
        handleError(e, 'Rebase');
        return { success: false, conflicts: [] };
      } finally {
        setLoading(repoPath, 'rebase', false);
      }
    },
    [repoPath, setLoading, addToast, refreshAll, handleError]
  );

  const stageFiles = useCallback(
    async (files: string[]) => {
      if (!repoPath) return;
      try {
        await window.git.stage(repoPath, files);
        await refreshStatusAndDiff();
      } catch (e) {
        handleError(e, 'Stage');
      }
    },
    [repoPath, refreshStatusAndDiff, handleError]
  );

  const unstageFiles = useCallback(
    async (files: string[]) => {
      if (!repoPath) return;
      try {
        await window.git.unstage(repoPath, files);
        await refreshStatusAndDiff();
      } catch (e) {
        handleError(e, 'Unstage');
      }
    },
    [repoPath, refreshStatusAndDiff, handleError]
  );

  const discardFiles = useCallback(
    async (files: string[]) => {
      if (!repoPath) return;
      try {
        await window.git.discardChanges(repoPath, files);
        await refreshStatusAndDiff();
      } catch (e) {
        handleError(e, 'Discard');
      }
    },
    [repoPath, refreshStatusAndDiff, handleError]
  );

  const createStash = useCallback(
    async (message?: string, includeUntracked?: boolean) => {
      if (!repoPath) return;
      setLoading(repoPath, 'stash', true);
      try {
        await window.git.stash(repoPath, message, includeUntracked);
        addToast({ message: 'Changes stashed', type: 'success' });
        await Promise.all([refreshStatusAndDiff(), refreshStashes()]);
      } catch (e) {
        handleError(e, 'Stash');
      } finally {
        setLoading(repoPath, 'stash', false);
      }
    },
    [repoPath, setLoading, addToast, refreshStatusAndDiff, refreshStashes, handleError]
  );

  const cherryPickCommits = useCallback(
    async (commits: string[]) => {
      if (!repoPath) return;
      setLoading(repoPath, 'cherryPick', true);
      try {
        const result = await window.git.cherryPick(repoPath, commits);
        if (result.success) {
          addToast({ message: result.message, type: 'success' });
        } else {
          addToast({ message: result.message, type: 'warning' });
        }
        await refreshAll();
        return result;
      } catch (e) {
        handleError(e, 'Cherry-pick');
        return { success: false, conflicts: [], message: 'Cherry-pick failed' };
      } finally {
        setLoading(repoPath, 'cherryPick', false);
      }
    },
    [repoPath, setLoading, addToast, refreshAll, handleError]
  );

  return {
    state,
    refreshStatus,
    refreshBranches,
    refreshLog,
    refreshDiff,
    refreshRemotes,
    refreshStashes,
    refreshAll,
    fetchRepo,
    checkoutBranch,
    createBranch,
    commitChanges,
    amendCommit,
    amendNoEdit,
    pushBranch,
    pullBranch,
    rebaseBranch,
    stageFiles,
    unstageFiles,
    discardFiles,
    createStash,
    cherryPickCommits,
    renameBranch,
    deleteBranch,
    resetHard,
  };
}
