import React, { useState, useMemo, useEffect } from 'react';
import { useGitStore } from '../../store/git';
import { useRepoStore } from '../../store/repos';
import { useGit } from '../../hooks/useGit';
import { Badge } from '../shared/Badge';
import { Dropdown } from '../shared/Dropdown';

const TAGS = [
  'IMP', 'FIX', 'ADD', 'REM', 'REF', 'REV', 'MOV', 'REL',
  'MERGE', 'CLA', 'I18N', 'PERF', 'CLN', 'LINT',
];

interface BranchCreatorProps {
  trigram?: string;
  defaultVersion?: string;
}

export function BranchCreator({ trigram = '', defaultVersion = 'master' }: BranchCreatorProps) {
  const activeRepoPath = useRepoStore((s) => s.activeRepoPath);
  const repoState = useGitStore((s) => (activeRepoPath ? s.repoStates[activeRepoPath] : null));
  const { createBranch, refreshRemotes } = useGit(activeRepoPath);

  // Extract versions from odoo or ent remotes
  const dynamicVersions = useMemo(() => {
    const versionsSet = new Set<string>();
    if (repoState?.branches?.remotes) {
      for (const group of repoState.branches.remotes) {
        if (group.remote === 'odoo' || group.remote === 'ent' || group.remote === 'enterprise') {
          for (const b of group.branches) {
            if (b.label && !b.label.includes('HEAD') && !b.label.includes('patch')) {
              versionsSet.add(b.label);
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
      '16.0', 'saas-16.3', '15.0', '14.0', '13.0',
    ];
  }, [repoState?.branches?.remotes]);

  const [version, setVersion] = useState(defaultVersion);
  const [tag, setTag] = useState('IMP');
  const [modules, setModules] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [description, setDescription] = useState('');
  const [trigramValue, setTrigramValue] = useState(trigram);
  const [base, setBase] = useState('');

  // Load saved settings (trigram and defaultVersion) on mount
  useEffect(() => {
    window.git.getSettings().then((settings) => {
      if (settings.trigram) {
        setTrigramValue(settings.trigram);
      }
      if (settings.defaultVersion) {
        setVersion(settings.defaultVersion);
      }
    });
  }, []);

  // Suggestions state
  const [allModules, setAllModules] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  useEffect(() => {
    if (!activeRepoPath) {
      setAllModules([]);
      return;
    }
    window.git.getOdooModules(activeRepoPath).then(setAllModules);
  }, [activeRepoPath]);

  const query = inputValue.trim().toLowerCase();
  const filteredSuggestions = query
    ? allModules
        .filter(m => 
          m.toLowerCase().includes(query) && 
          !m.startsWith('__') && 
          !modules.some(exist => exist.toLowerCase() === m.toLowerCase())
        )
        .sort((a, b) => {
          const aLower = a.toLowerCase();
          const bLower = b.toLowerCase();
          
          // 1. Exact matches first
          const aExact = aLower === query;
          const bExact = bLower === query;
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;
          
          // 2. Starts with query first
          const aStarts = aLower.startsWith(query);
          const bStarts = bLower.startsWith(query);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          
          // 3. Otherwise alphabetical
          return aLower.localeCompare(bLower);
        })
        .slice(0, 150)
    : [];

  const addModule = (modName: string) => {
    const trimmed = modName.trim();
    if (trimmed && !modules.includes(trimmed)) {
      setModules([...modules, trimmed]);
    }
    setInputValue('');
    setFocusedIndex(-1);
    setShowSuggestions(false);
  };

  const removeModule = (modName: string) => {
    setModules(modules.filter((m) => m !== modName));
  };

  useEffect(() => {
    if (activeRepoPath) refreshRemotes();
  }, [activeRepoPath]);

  // Keep version state synchronized with available dynamic versions
  useEffect(() => {
    if (dynamicVersions.length > 0 && !dynamicVersions.includes(version)) {
      const preferred = dynamicVersions.includes(defaultVersion) ? defaultVersion : dynamicVersions[0];
      setVersion(preferred);
    }
  }, [dynamicVersions, defaultVersion]);

  // Build base options from remotes + version
  const baseOptions = useMemo(() => {
    if (!repoState?.remotes) return [];
    const opts: string[] = [];
    for (const remote of repoState.remotes) {
      for (const v of dynamicVersions) {
        opts.push(`${remote.name}/${v}`);
      }
    }
    return opts;
  }, [repoState?.remotes, dynamicVersions]);

  useEffect(() => {
    if (baseOptions.length > 0 && !base) {
      // Try to default to odoo/{version} or first available
      const preferred = baseOptions.find((b) => b === `odoo/${version}`)
        || baseOptions.find((b) => b.endsWith(`/${version}`))
        || baseOptions[0];
      setBase(preferred || '');
    }
  }, [baseOptions, version]);

  // Update base when version changes
  useEffect(() => {
    const newBase = baseOptions.find((b) => b === `odoo/${version}`)
      || baseOptions.find((b) => b.endsWith(`/${version}`))
      || base;
    setBase(newBase);
  }, [version]);

  const branchName = useMemo(() => {
    const cleanModule = modules
      .map(m => m.trim().replace(/\s+/g, '_'))
      .join(',')
      .trim();
    const parts = [
      version,
      cleanModule,
      tag.toLowerCase(),
      description.trim().replace(/\s+/g, '-').toLowerCase(),
      trigramValue.trim(),
    ].filter(Boolean);
    return parts.join('-');
  }, [version, modules, tag, description, trigramValue]);

  const handleCreate = async () => {
    if (modules.length === 0 || !base) return;
    await createBranch(branchName, base);
  };

  const isValid = modules.length > 0 && base.length > 0;

  return (
    <div className="p-4 space-y-4">
      <h3 className="section-header mb-3">CREATE NEW BRANCH</h3>

      {/* Version */}
      <div>
        <label className="text-[12px] text-muted mb-1 block">Version</label>
        <Dropdown
          options={dynamicVersions}
          value={version}
          onChange={setVersion}
          searchable={true}
        />
      </div>

      {/* Tag */}
      <div>
        <label className="text-[12px] text-muted mb-1 block">Tag</label>
        <div className="flex flex-wrap gap-1.5">
          {TAGS.map((t) => (
            <button
              key={t}
              className={`transition-all ${tag === t ? '' : 'opacity-40 hover:opacity-70'}`}
              onClick={() => setTag(t)}
            >
              <Badge tag={t} size="lg" />
            </button>
          ))}
        </div>
      </div>

      {/* Module */}
      <div className="relative">
        <label className="text-[12px] text-muted mb-1 block">Module name</label>
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#0D1117] border border-border rounded focus-within:border-accent/70 transition-colors w-full cursor-text min-h-[36px]">
          {modules.map((m) => (
            <span
              key={m}
              className="inline-flex items-center gap-1 bg-accent/15 text-accent font-semibold px-2 py-0.5 rounded text-[11px] font-mono select-none"
            >
              {m}
              <button
                type="button"
                className="text-danger hover:scale-120 transition-all font-extrabold text-[15px] leading-none shrink-0 ml-1.5"
                onClick={() => removeModule(m)}
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            className="bg-transparent border-none outline-none flex-1 min-w-[120px] text-primary text-[12px] font-mono p-0 h-[22px]"
            placeholder={modules.length === 0 ? "account_reports" : ""}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(true);
              setFocusedIndex(-1);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                if (filteredSuggestions.length > 0) {
                  e.preventDefault();
                  setFocusedIndex(prev => (prev + 1) % filteredSuggestions.length);
                }
              } else if (e.key === 'ArrowUp') {
                if (filteredSuggestions.length > 0) {
                  e.preventDefault();
                  setFocusedIndex(prev => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
                }
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (focusedIndex >= 0 && focusedIndex < filteredSuggestions.length) {
                  addModule(filteredSuggestions[focusedIndex]);
                } else if (inputValue.trim()) {
                  addModule(inputValue.trim());
                }
              } else if (e.key === 'Escape') {
                setShowSuggestions(false);
                setFocusedIndex(-1);
              } else if (e.key === 'Backspace' && !inputValue && modules.length > 0) {
                setModules(modules.slice(0, -1));
              }
            }}
          />
        </div>

        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-[#1C2129] border border-border rounded shadow-xl z-50 py-1">
            {filteredSuggestions.map((suggestion, index) => (
              <div
                key={suggestion}
                className={`px-3 py-1.5 font-mono text-[12px] cursor-pointer transition-colors ${
                  index === focusedIndex ? 'bg-accent/20 text-accent font-semibold' : 'text-primary hover:bg-border/30'
                }`}
                onClick={() => addModule(suggestion)}
              >
                {suggestion}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="text-[12px] text-muted mb-1 block">Short description</label>
        <input
          type="text"
          className="input-field"
          placeholder="optimize-pdf-header"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* Trigram */}
      <div>
        <label className="text-[12px] text-muted mb-1 block">Trigram</label>
        <input
          type="text"
          className="input-field font-mono w-24"
          value={trigramValue}
          onChange={(e) => {
            const val = e.target.value.toLowerCase();
            setTrigramValue(val);
            window.git.saveSettings({ trigram: val });
          }}
          placeholder="times"
          maxLength={5}
        />
      </div>

      {/* Base */}
      <div>
        <label className="text-[12px] text-muted mb-1 block">Base (remote/branch)</label>
        <Dropdown
          options={baseOptions}
          value={base}
          onChange={setBase}
          placeholder="Select base..."
          searchable={true}
        />
      </div>

      {/* Preview */}
      <div className="mt-4 p-3 bg-bg border border-border rounded">
        <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Branch Name Preview</label>
        <div className="font-mono text-accent text-[13px] break-all">
          {branchName || '—'}
        </div>
        {base && (
          <div className="font-mono text-[11px] text-muted mt-2">
            git checkout -b {branchName} {base}
          </div>
        )}
      </div>

      {/* Create Button */}
      <button
        className={`btn-accent w-full justify-center py-2 ${!isValid ? 'opacity-40 cursor-not-allowed' : ''}`}
        onClick={handleCreate}
        disabled={!isValid}
      >
        Create & Checkout Branch
      </button>
    </div>
  );
}
