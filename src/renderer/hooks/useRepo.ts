import { useRepoStore } from '../store/repos';

export function useRepo() {
  const { repos, activeRepoPath, setActiveRepo, addRepo, removeRepo } = useRepoStore();

  const activeRepo = repos.find((r) => r.path === activeRepoPath) || null;

  const openRepo = async () => {
    const dir = await window.git.selectDirectory();
    if (dir) {
      const name = dir.split('/').pop() || dir;
      addRepo({ path: dir, name });
    }
  };

  return {
    repos,
    activeRepo,
    activeRepoPath,
    setActiveRepo,
    addRepo,
    removeRepo,
    openRepo,
  };
}
