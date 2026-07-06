import { create } from 'zustand';
import type { GitStatus, BranchSummary, LogEntry, DiffFile, RemoteInfo, StashEntry } from '../../types.d';

interface PerRepoState {
  status: GitStatus | null;
  branches: BranchSummary | null;
  log: LogEntry[];
  diffFiles: DiffFile[];
  remotes: RemoteInfo[];
  stashes: StashEntry[];
  lastFetched: string | null;
  loading: {
    status: boolean;
    branches: boolean;
    log: boolean;
    diff: boolean;
    fetch: boolean;
    push: boolean;
    commit: boolean;
    stash: boolean;
    cherryPick: boolean;
    rebase: boolean;
    checkout: boolean;
    pull: boolean;
    createBranch: boolean;
  };
  error: string | null;
}

const defaultRepoState: PerRepoState = {
  status: null,
  branches: null,
  log: [],
  diffFiles: [],
  remotes: [],
  stashes: [],
  lastFetched: null,
  loading: {
    status: false,
    branches: false,
    log: false,
    diff: false,
    fetch: false,
    push: false,
    commit: false,
    stash: false,
    cherryPick: false,
    rebase: false,
    checkout: false,
    pull: false,
    createBranch: false,
  },
  error: null,
};

interface GitStore {
  repoStates: Record<string, PerRepoState>;
  getRepoState: (path: string) => PerRepoState;
  setRepoState: (path: string, partial: Partial<PerRepoState>) => void;
  setLoading: (path: string, key: keyof PerRepoState['loading'], value: boolean) => void;
  setError: (path: string, error: string | null) => void;
  removeRepoState: (path: string) => void;
}

export const useGitStore = create<GitStore>((set, get) => ({
  repoStates: {},

  getRepoState: (path) => {
    return get().repoStates[path] || { ...defaultRepoState };
  },

  setRepoState: (path, partial) => {
    set((state) => ({
      repoStates: {
        ...state.repoStates,
        [path]: {
          ...(state.repoStates[path] || { ...defaultRepoState }),
          ...partial,
        },
      },
    }));
  },

  setLoading: (path, key, value) => {
    set((state) => {
      const current = state.repoStates[path] || { ...defaultRepoState };
      return {
        repoStates: {
          ...state.repoStates,
          [path]: {
            ...current,
            loading: { ...current.loading, [key]: value },
          },
        },
      };
    });
  },

  setError: (path, error) => {
    set((state) => ({
      repoStates: {
        ...state.repoStates,
        [path]: {
          ...(state.repoStates[path] || { ...defaultRepoState }),
          error,
        },
      },
    }));
  },

  removeRepoState: (path) => {
    set((state) => {
      const { [path]: _, ...rest } = state.repoStates;
      return { repoStates: rest };
    });
  },
}));
