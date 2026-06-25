import React, { useState, useMemo, useEffect } from 'react';
import { useRepoStore } from '../../store/repos';
import { useGit } from '../../hooks/useGit';
import { useUIStore } from '../../store/ui';
import { useGitStore } from '../../store/git';
import { Dropdown } from '../shared/Dropdown';

export function MultiRepoSwitch() {
  const repos = useRepoStore((s) => s.repos);
  const repoStates = useGitStore((s) => s.repoStates);
  const addToast = useUIStore((s) => s.addToast);

  // Extract versions from odoo or ent remotes across all repositories
  const dynamicVersions = useMemo(() => {
    const versionsSet = new Set<string>();
    for (const repoPath of Object.keys(repoStates)) {
      const state = repoStates[repoPath];
      if (state?.branches?.remotes) {
        for (const group of state.branches.remotes) {
          if (group.remote === 'odoo' || group.remote === 'ent' || group.remote === 'enterprise') {
            for (const b of group.branches) {
              if (b.label && !b.label.includes('HEAD') && !b.label.includes('patch')) {
                versionsSet.add(b.label);
              }
            }
          }
        }
      }
    }
    if (versionsSet.size > 0) {
      const list = Array.from(versionsSet);
      list.sort((a, b) => {
        if (a === 'master') return -1;
        if (b === 'master') return 1;
        return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' });
      });
      return list;
    }
    return [
      'master', '19.0', '18.0', 'saas-19.3', 'saas-18.3', '17.0', 'saas-17.3',
      '16.0', 'saas-16.3', '15.0', '14.0',
    ];
  }, [repoStates]);

  const [targetVersion, setTargetVersion] = useState('master');
  const [switching, setSwitching] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<string[]>(repos.map((r) => r.path));
  const [results, setResults] = useState<{ path: string; name: string; status: 'pending' | 'success' | 'error'; message?: string }[]>([]);

  // Keep targetVersion synchronized with available dynamic versions
  useEffect(() => {
    if (dynamicVersions.length > 0 && !dynamicVersions.includes(targetVersion)) {
      const preferred = dynamicVersions.includes('master') ? 'master' : dynamicVersions[0];
      setTargetVersion(preferred);
    }
  }, [dynamicVersions]);

  const handleSwitch = async () => {
    if (selectedPaths.length === 0) return;
    setSwitching(true);
    const activeRepos = repos.filter((r) => selectedPaths.includes(r.path));
    const r = activeRepos.map((repo) => ({
      path: repo.path,
      name: repo.name,
      status: 'pending' as const,
    }));
    setResults(r);

    for (let i = 0; i < activeRepos.length; i++) {
      try {
        await window.git.checkout(activeRepos[i].path, targetVersion);
        setResults((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: 'success' } : item))
        );
      } catch (e: any) {
        setResults((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'error', message: e?.message || 'Failed' } : item
          )
        );
      }
    }

    setSwitching(false);
    addToast({ message: `Switched selected repos to ${targetVersion}`, type: 'success' });
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="section-header">MULTI-REPO SWITCH</h3>
      <p className="text-[12px] text-muted">Switch selected repositories to the same version/branch.</p>

      <div>
        <label className="text-[12px] text-muted mb-1 block">Target version</label>
        <Dropdown
          options={dynamicVersions}
          value={targetVersion}
          onChange={setTargetVersion}
          searchable={true}
        />
      </div>

      <div className="space-y-1.5">
        {repos.map((repo) => {
          const isSelected = selectedPaths.includes(repo.path);
          const result = results.find((r) => r.path === repo.path);
          return (
            <div
              key={repo.path}
              className={`flex items-center gap-2.5 text-[13px] py-1.5 px-2.5 rounded bg-[#161B22] border border-border transition-colors ${
                switching ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-border/20'
              }`}
              onClick={() => {
                if (switching) return;
                if (isSelected) {
                  setSelectedPaths((prev) => prev.filter((p) => p !== repo.path));
                } else {
                  setSelectedPaths((prev) => [...prev, repo.path]);
                }
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={switching}
                readOnly
                className="rounded border-border text-accent focus:ring-accent bg-bg cursor-pointer"
              />
              <span className="text-primary truncate">{repo.name}</span>
              <span className="ml-auto shrink-0">
                {result?.status === 'pending' && (
                  <svg className="spinner text-muted" width="12" height="12" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="20 12" />
                  </svg>
                )}
                {result?.status === 'success' && <span className="text-diff-add-text text-[11px] font-bold">✓</span>}
                {result?.status === 'error' && (
                  <span className="text-danger text-[11px] font-bold" title={result.message}>✗</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <button
        className={`btn-accent w-full justify-center py-2 ${switching || selectedPaths.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={handleSwitch}
        disabled={switching || selectedPaths.length === 0}
      >
        {switching ? 'Switching...' : `Switch Selected (${selectedPaths.length}) to ${targetVersion}`}
      </button>
    </div>
  );
}
