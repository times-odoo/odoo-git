import { create } from 'zustand';

export interface RepoTab {
  path: string;
  name: string;
}

interface RepoStore {
  repos: RepoTab[];
  activeRepoPath: string | null;
  setActiveRepo: (path: string) => void;
  addRepo: (repo: RepoTab) => void;
  removeRepo: (path: string) => void;
  setRepos: (repos: RepoTab[]) => void;
}

export const useRepoStore = create<RepoStore>((set, get) => ({
  repos: [],
  activeRepoPath: null,

  setActiveRepo: (path) => {
    set({ activeRepoPath: path });
    window.git.saveSettings({ lastActiveRepo: path });
  },

  addRepo: (repo) => {
    const { repos } = get();
    if (repos.some((r) => r.path === repo.path)) {
      set({ activeRepoPath: repo.path });
      return;
    }
    const newRepos = [...repos, repo];
    set({ repos: newRepos, activeRepoPath: repo.path });
    window.git.saveSettings({
      repos: newRepos.map((r) => ({ path: r.path, name: r.name })),
      lastActiveRepo: repo.path,
    });
  },

  removeRepo: (path) => {
    const { repos, activeRepoPath } = get();
    const newRepos = repos.filter((r) => r.path !== path);
    const newActive =
      newRepos.length > 0
        ? activeRepoPath === path
          ? newRepos[Math.max(0, repos.findIndex((r) => r.path === path) - 1)]?.path || newRepos[0]?.path
          : activeRepoPath
        : null;
    set({ repos: newRepos, activeRepoPath: newActive });
    window.git.saveSettings({
      repos: newRepos.map((r) => ({ path: r.path, name: r.name })),
      lastActiveRepo: newActive,
    });
  },

  setRepos: (repos) => set({ repos }),
}));
