import React, { useState } from 'react';
import { useRepoStore } from '../../store/repos';
import { useGitStore } from '../../store/git';
import { useUIStore } from '../../store/ui';
import { Dropdown } from '../shared/Dropdown';

export function MultiRepoPush() {
  const repos = useRepoStore((s) => s.repos);
  const repoStates = useGitStore((s) => s.repoStates);
  const addToast = useUIStore((s) => s.addToast);
  const [pushing, setPushing] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [results, setResults] = useState<{ path: string; name: string; status: 'pending' | 'success' | 'error' | 'skipped'; message?: string }[]>([]);
  const [selectedRemotes, setSelectedRemotes] = useState<Record<string, string>>({});

  const initializedPathsRef = React.useRef<Record<string, boolean>>({});

  // Sync selected paths with loaded repos & clean up closed repos
  React.useEffect(() => {
    setSelectedPaths((prev) => prev.filter((path) => repos.some((r) => r.path === path)));
    const repoPaths = repos.map((r) => r.path);
    Object.keys(initializedPathsRef.current).forEach((path) => {
      if (!repoPaths.includes(path)) {
        delete initializedPathsRef.current[path];
      }
    });
  }, [repos]);

  // Default select only repositories that have commits to push (ahead > 0) once status is loaded
  React.useEffect(() => {
    let updated = false;
    const toSelect: string[] = [];

    repos.forEach((repo) => {
      const status = repoStates[repo.path]?.status;
      if (status && !initializedPathsRef.current[repo.path]) {
        initializedPathsRef.current[repo.path] = true;
        if (status.ahead > 0) {
          toSelect.push(repo.path);
        }
        updated = true;
      }
    });

    if (updated && toSelect.length > 0) {
      setSelectedPaths((prev) => Array.from(new Set([...prev, ...toSelect])));
    }
  }, [repos, repoStates]);

  // Initialize selected remotes when repos/repoStates load
  React.useEffect(() => {
    const updated = { ...selectedRemotes };
    let changed = false;

    repos.forEach((repo) => {
      if (updated[repo.path]) return; // already initialized

      // Get saved remote
      const savedRemote = localStorage.getItem(`push_remote:${repo.path}`);
      const repoRemotes = repoStates[repo.path]?.remotes || [];
      
      if (savedRemote && repoRemotes.some((r) => r.name === savedRemote)) {
        updated[repo.path] = savedRemote;
        changed = true;
      } else {
        // Fallback to default
        const repoName = repo.path.split('/').pop()?.toLowerCase() || '';
        let def = '';
        if (repoName.includes('enterprise') || repoName.includes('ent')) {
          def = repoRemotes.find((r) => r.name === 'ent-dev')?.name || repoRemotes[0]?.name || '';
        } else {
          def = repoRemotes.find((r) => r.name === 'odoo-dev')?.name || repoRemotes[0]?.name || '';
        }
        if (def) {
          updated[repo.path] = def;
          changed = true;
        }
      }
    });

    if (changed) {
      setSelectedRemotes(updated);
    }
  }, [repos, repoStates, selectedRemotes]);

  const handlePushAll = async () => {
    if (selectedPaths.length === 0) return;
    setPushing(true);
    const r = repos.map((repo) => ({
      path: repo.path,
      name: repo.name,
      status: selectedPaths.includes(repo.path) ? ('pending' as const) : ('skipped' as const),
    }));
    setResults(r);

    for (let i = 0; i < repos.length; i++) {
      const repoPath = repos[i].path;
      if (!selectedPaths.includes(repoPath)) continue;

      try {
        const status = await window.git.status(repoPath);
        if (!status.current) throw new Error('No branch');

        let remote = selectedRemotes[repoPath];
        if (!remote) {
          const remotesList = await window.git.remotes(repoPath);
          const repoName = repoPath.split('/').pop()?.toLowerCase() || '';
          const defaultRemote = repoName.includes('enterprise')
            ? remotesList.find((r) => r.name === 'ent-dev')?.name
            : remotesList.find((r) => r.name === 'odoo-dev')?.name;
          remote = defaultRemote || remotesList[0]?.name;
        }

        if (!remote) throw new Error('No remote configured');

        const result = await window.git.push(repoPath, remote, status.current);
        setResults((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: result.success ? ('success' as const) : ('error' as const), message: result.message } : item
          )
        );
      } catch (e: any) {
        setResults((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'error' as const, message: e?.message || 'Push failed' } : item
          )
        );
      }
    }

    setPushing(false);
    addToast({ message: 'Multi-repo push completed', type: 'success' });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="section-header">MULTI-REPO PUSH</h3>
        <div className="flex gap-2 text-[11px]">
          <button
            className="text-accent hover:text-accent-hover font-medium disabled:opacity-40 transition-colors"
            disabled={pushing || repos.length === 0}
            onClick={() => setSelectedPaths(repos.map(r => r.path))}
          >
            Select All
          </button>
          <span className="text-muted opacity-50">|</span>
          <button
            className="text-accent hover:text-accent-hover font-medium disabled:opacity-40 transition-colors"
            disabled={pushing || repos.length === 0}
            onClick={() => setSelectedPaths([])}
          >
            Deselect All
          </button>
        </div>
      </div>
      <p className="text-[12px] text-muted">Push selected repositories simultaneously to their chosen or default remotes.</p>

      <div className="space-y-1.5">
        {repos.map((repo) => {
          const repoState = repoStates[repo.path];
          const branch = repoState?.status?.current || '—';
          const result = results.find((r) => r.path === repo.path);
          const isSelected = selectedPaths.includes(repo.path);
          const repoRemotes = repoState?.remotes || [];

          return (
            <div
              key={repo.path}
              className={`flex items-center gap-2.5 text-[13px] py-1.5 px-2 rounded bg-bg border border-border/50 hover:border-border transition-all ${
                pushing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
              }`}
              onClick={() => {
                if (pushing) return;
                setSelectedPaths((prev) =>
                  prev.includes(repo.path)
                    ? prev.filter((p) => p !== repo.path)
                    : [...prev, repo.path]
                );
              }}
            >
              <input
                type="checkbox"
                className="rounded border-border text-accent focus:ring-accent w-3.5 h-3.5 cursor-pointer bg-bg shrink-0 disabled:opacity-50"
                checked={isSelected}
                disabled={pushing}
                readOnly
              />
              <span className={`text-primary font-medium transition-opacity ${!isSelected ? 'opacity-40' : ''}`}>{repo.name}</span>
              <span className={`font-mono text-[11px] text-accent transition-opacity ${!isSelected ? 'opacity-40' : ''}`}>{branch}</span>
              
              {/* Remote Selector */}
              <div className="ml-auto flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <span className={`text-[10px] text-muted ${!isSelected ? 'opacity-40' : ''}`}>remote:</span>
                <Dropdown
                  options={repoRemotes.map((r) => r.name)}
                  value={selectedRemotes[repo.path] || ''}
                  onChange={(val) => {
                    setSelectedRemotes((prev) => ({ ...prev, [repo.path]: val }));
                    localStorage.setItem(`push_remote:${repo.path}`, val);
                  }}
                  disabled={pushing || !isSelected}
                  size="sm"
                  className="w-[90px]"
                />
              </div>

              <span className="shrink-0 min-w-[60px] text-right font-medium">
                {result?.status === 'pending' && (
                  <svg className="spinner text-muted inline" width="12" height="12" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="20 12" />
                  </svg>
                )}
                {result?.status === 'success' && <span className="text-success text-[12px]">✓ pushed</span>}
                {result?.status === 'error' && (
                  <span className="text-danger text-[12px]" title={result.message}>✗ failed</span>
                )}
                {result?.status === 'skipped' && (
                  <span className="text-muted text-[12px] opacity-60">skipped</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <button
        className={`btn-accent w-full justify-center py-2 transition-all ${
          pushing || selectedPaths.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        onClick={handlePushAll}
        disabled={pushing || selectedPaths.length === 0}
      >
        {pushing
          ? 'Pushing...'
          : selectedPaths.length === repos.length
          ? 'Push All Repos'
          : `Push Selected Repos (${selectedPaths.length})`}
      </button>
    </div>
  );
}
