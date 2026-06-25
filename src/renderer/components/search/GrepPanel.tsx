import React, { useState, useEffect, useRef } from 'react';
import { useRepoStore } from '../../store/repos';
import { useGitStore } from '../../store/git';
import { useGit } from '../../hooks/useGit';

interface GrepMatch {
  revision?: string;
  file: string;
  line: number;
  content: string;
}

export function GrepPanel() {
  const activeRepoPath = useRepoStore((s) => s.activeRepoPath);
  const repoState = useGitStore((s) => (activeRepoPath ? s.repoStates[activeRepoPath] : null));
  const branches = repoState?.branches;

  const [query, setQuery] = useState('');
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [repoFiles, setRepoFiles] = useState<string[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [selectedRevs, setSelectedRevs] = useState<string[]>([]);
  const [caseInsensitive, setCaseInsensitive] = useState(true);
  const [useRegex, setUseRegex] = useState(true);

  const [revSearch, setRevSearch] = useState('');
  const [results, setResults] = useState<GrepMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [currentSearchingRev, setCurrentSearchingRev] = useState<string | null>(null);
  const [versionOrder, setVersionOrder] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const { refreshBranches } = useGit(activeRepoPath || '');

  const currentSessionIdRef = useRef<string>('');
  const pendingRevsRef = useRef<Set<string>>(new Set());

  // Listen to streaming results from individual versions
  useEffect(() => {
    const unsubscribe = window.git.onGrepResult((data) => {
      if (data.sessionId !== currentSessionIdRef.current) return;

      if (data.results && data.results.length > 0) {
        setResults((prev) => [...prev, ...data.results]);
        setVersionOrder((prev) => {
          if (!prev.includes(data.revision)) {
            return [...prev, data.revision];
          }
          return prev;
        });
      }

      if (data.error) {
        const errorText = data.error;
        setErrorMsg((prev) => (prev ? prev + '\n' + errorText : errorText));
      }

      pendingRevsRef.current.delete(data.revision);
      if (pendingRevsRef.current.size === 0) {
        setSearching(false);
        setCurrentSearchingRev(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Listen to streaming search start events for each version
  useEffect(() => {
    const unsubscribe = window.git.onGrepStart((data) => {
      if (data.sessionId !== currentSessionIdRef.current) return;
      setCurrentSearchingRev(data.revision);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Fetch branches if they aren't loaded yet
  useEffect(() => {
    if (activeRepoPath && !branches && !repoState?.loading.branches) {
      refreshBranches();
    }
  }, [activeRepoPath, branches, repoState?.loading.branches, refreshBranches]);

  // Fetch repository tracked files for autocomplete
  useEffect(() => {
    if (activeRepoPath) {
      setLoadingFiles(true);
      window.git.getRepoFiles(activeRepoPath)
        .then((files) => {
          setRepoFiles(files);
        })
        .catch(() => {
          setRepoFiles([]);
        })
        .finally(() => {
          setLoadingFiles(false);
        });
    } else {
      setRepoFiles([]);
    }
  }, [activeRepoPath]);

  // Helper to split path into directory and file
  const getPathParts = (p: string) => {
    const parts = p.split('/');
    if (parts.length === 1) return { dir: '', file: parts[0] };
    const file = parts.pop() || '';
    const dir = parts.join('/');
    return { dir, file };
  };

  // Helper to get extension icon for suggestions
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'py':
        return (
          <span className="text-[#3572A5] font-extrabold text-[10px] bg-[#3572A5]/10 border border-[#3572A5]/20 px-1 py-0.5 rounded shrink-0">
            PY
          </span>
        );
      case 'js':
      case 'jsx':
        return (
          <span className="text-[#F1E05A] font-extrabold text-[10px] bg-[#F1E05A]/10 border border-[#F1E05A]/20 px-1 py-0.5 rounded shrink-0">
            JS
          </span>
        );
      case 'ts':
      case 'tsx':
        return (
          <span className="text-[#3178C6] font-extrabold text-[10px] bg-[#3178C6]/10 border border-[#3178C6]/20 px-1 py-0.5 rounded shrink-0">
            TS
          </span>
        );
      case 'xml':
        return (
          <span className="text-[#E34C26] font-extrabold text-[10px] bg-[#E34C26]/10 border border-[#E34C26]/20 px-1 py-0.5 rounded shrink-0">
            XML
          </span>
        );
      case 'css':
      case 'scss':
        return (
          <span className="text-[#C6538C] font-extrabold text-[10px] bg-[#C6538C]/10 border border-[#C6538C]/20 px-1 py-0.5 rounded shrink-0">
            CSS
          </span>
        );
      default:
        return (
          <span className="text-muted font-extrabold text-[10px] bg-muted/10 border border-muted/20 px-1 py-0.5 rounded shrink-0">
            FILE
          </span>
        );
    }
  };

  const addPath = (path: string) => {
    const trimmed = path.trim();
    if (trimmed && !selectedPaths.includes(trimmed)) {
      setSelectedPaths([...selectedPaths, trimmed]);
      setInputValue('');
      setFocusedIndex(-1);
    }
  };

  // Filter file suggestions (cap at 100 for render performance)
  const filteredSuggestions = React.useMemo(() => {
    const val = inputValue.trim().toLowerCase();
    if (val.length < 2) return [];
    
    const matches: string[] = [];
    for (const file of repoFiles) {
      if (file.toLowerCase().includes(val)) {
        if (!selectedPaths.includes(file)) {
          matches.push(file);
          if (matches.length >= 100) break;
        }
      }
    }
    return matches;
  }, [inputValue, repoFiles, selectedPaths]);

  // Collect local branches and remote branches from core remotes only (like odoo, ent, enterprise)
  const localBranches = branches?.local || [];
  const remoteBranches = branches?.remotes
    .filter((r) => r.remote === 'odoo' || r.remote === 'ent' || r.remote === 'enterprise')
    .flatMap((r) => r.branches) || [];
  const allBranches = [...localBranches, ...remoteBranches];

  const uniqueBranchNames = Array.from(new Set(allBranches.map((b) => b.name))).sort();

  const filteredRevs = uniqueBranchNames.filter((name) =>
    name.toLowerCase().includes(revSearch.toLowerCase())
  );

  const toggleRevision = (rev: string) => {
    setSelectedRevs((prev) =>
      prev.includes(rev) ? prev.filter((r) => r !== rev) : [...prev, rev]
    );
  };

  const [collapsedVersions, setCollapsedVersions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCollapsedVersions({});
  }, [results]);

  const toggleVersionCollapse = (ver: string) => {
    setCollapsedVersions((prev) => ({
      ...prev,
      [ver]: !prev[ver],
    }));
  };

  const groupedResults = React.useMemo(() => {
    interface GroupedByFile {
      filePath: string;
      matches: GrepMatch[];
    }
    interface GroupedByVersion {
      version: string;
      files: GroupedByFile[];
      totalMatches: number;
    }

    const groups: Record<string, Record<string, GrepMatch[]>> = {};

    for (const match of results) {
      const verName = match.revision || 'Working Tree';
      const filePath = match.file;

      if (!groups[verName]) {
        groups[verName] = {};
      }
      if (!groups[verName][filePath]) {
        groups[verName][filePath] = [];
      }
      groups[verName][filePath].push(match);
    }

    const versionGroups: GroupedByVersion[] = [];
    const verNames = versionOrder.filter((v) => groups[v] !== undefined);

    for (const ver of verNames) {
      const filePaths = Object.keys(groups[ver]).sort();
      const files: GroupedByFile[] = [];
      let totalMatches = 0;

      for (const fp of filePaths) {
        files.push({
          filePath: fp,
          matches: groups[ver][fp],
        });
        totalMatches += groups[ver][fp].length;
      }

      versionGroups.push({
        version: ver,
        files,
        totalMatches,
      });
    }

    return versionGroups;
  }, [results, versionOrder]);

  // Helper to clean the query by stripping outer matching single/double quotes
  const getCleanedQuery = (q: string) => {
    let val = q.trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1).trim();
    }
    return val;
  };

  const handleSearch = async () => {
    const cleaned = getCleanedQuery(query);
    if (!activeRepoPath || !cleaned) return;
    setSearching(true);
    setCurrentSearchingRev(null);
    setErrorMsg('');
    setResults([]);
    setVersionOrder([]);

    const newSessionId = 'search_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    currentSessionIdRef.current = newSessionId;

    const targets = selectedRevs.length > 0 ? selectedRevs : ['Working Tree'];
    pendingRevsRef.current = new Set(targets);

    try {
      const searchOpts = {
        query: cleaned,
        revisions: selectedRevs.length > 0 ? selectedRevs : undefined,
        paths: selectedPaths.length > 0 ? selectedPaths : undefined,
        caseInsensitive,
        useRegex,
        sessionId: newSessionId,
      };

      await window.git.grepSearchStream(activeRepoPath, searchOpts);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to start search');
      setSearching(false);
    }
  };

  const handleCopyJson = () => {
    if (results.length === 0) return;
    const jsonStr = JSON.stringify(results, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Helper to highlight matching text in snippet
  const renderHighlightedContent = (content: string) => {
    const cleaned = getCleanedQuery(query);
    if (!cleaned) return content;
    try {
      const pattern = useRegex ? cleaned : cleaned.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(${pattern})`, caseInsensitive ? 'gi' : 'g');
      const parts = content.split(regex);
      return (
        <>
          {parts.map((part, index) =>
            regex.test(part) ? (
              <mark key={index} className="bg-accent/20 text-accent font-semibold px-0.5 rounded border border-accent/30">
                {part}
              </mark>
            ) : (
              part
            )
          )}
        </>
      );
    } catch {
      return content;
    }
  };

  return (
    <div className="flex h-full overflow-hidden text-[13px]">
      {/* Left Pane: Config Form */}
      <div className="w-80 border-r border-border bg-surface/30 p-4 flex flex-col gap-4 overflow-visible shrink-0">
        <div>
          <h3 className="section-header mb-3">MULTI-VERSION GREP</h3>
          <p className="text-muted text-[11px] leading-relaxed">
            Perform code searches using extended regular expressions across multiple branches, versions, and paths simultaneously.
          </p>
        </div>

        {/* Query Input */}
        <div>
          <label className="text-[12px] text-muted mb-1 block">Search Query</label>
          <input
            type="text"
            className="input-field w-full font-mono text-[12px]"
            placeholder="e.g. '9902'|'9904'"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>

        {/* Options */}
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-[12px] text-primary">
            <input
              type="checkbox"
              checked={caseInsensitive}
              onChange={(e) => setCaseInsensitive(e.target.checked)}
              className="accent-accent"
            />
            Case Insensitive
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-[12px] text-primary">
            <input
              type="checkbox"
              checked={useRegex}
              onChange={(e) => setUseRegex(e.target.checked)}
              className="accent-accent"
            />
            Regex Search
          </label>
        </div>

        {/* Paths Specifier */}
        <div className="relative">
          <label className="text-[12px] text-muted mb-1 block">
            Paths / Files
          </label>
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#0D1117] border border-border rounded focus-within:border-accent/70 transition-colors w-full cursor-text min-h-[36px] max-h-48 overflow-y-auto">
            {selectedPaths.map((p) => {
              const { dir, file } = getPathParts(p);
              return (
                <span
                  key={p}
                  className="inline-flex items-center gap-1.5 bg-accent/15 text-accent px-2 py-0.5 rounded text-[11px] font-mono select-none border border-accent/20 max-w-[270px] min-w-0"
                  title={p}
                >
                  {/* Filename: Always visible, never truncated */}
                  <span className="font-semibold text-accent shrink-0">{file}</span>
                  {/* Directory Path: Truncated to fit */}
                  {dir && (
                    <span className="text-muted/50 truncate min-w-0 text-[10px]">
                      ({dir})
                    </span>
                  )}
                  <button
                    type="button"
                    className="text-danger hover:scale-120 transition-all font-extrabold text-[15px] leading-none shrink-0 ml-0.5"
                    onClick={() => setSelectedPaths(selectedPaths.filter((path) => path !== p))}
                  >
                    ×
                  </button>
                </span>
              );
            })}
            <input
              type="text"
              className="bg-transparent border-none outline-none flex-1 min-w-[120px] text-primary text-[12px] font-mono p-0 h-[22px]"
              placeholder={selectedPaths.length === 0 ? "Search or type file path..." : ""}
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
                    addPath(filteredSuggestions[focusedIndex]);
                  } else if (inputValue.trim()) {
                    addPath(inputValue.trim());
                  }
                } else if (e.key === 'Escape') {
                  setShowSuggestions(false);
                  setFocusedIndex(-1);
                } else if (e.key === 'Backspace' && !inputValue && selectedPaths.length > 0) {
                  setSelectedPaths(selectedPaths.slice(0, -1));
                }
              }}
            />
          </div>

          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute left-0 w-[560px] mt-1 max-h-60 overflow-y-auto bg-[#1C2129] border border-border rounded shadow-xl z-[999] py-1 divide-y divide-border/10">
              {filteredSuggestions.map((suggestion, index) => {
                const { dir, file } = getPathParts(suggestion);
                return (
                  <div
                    key={suggestion}
                    className={`px-3 py-1.5 font-mono text-[11px] cursor-pointer flex items-center justify-between transition-colors ${
                      index === focusedIndex ? 'bg-accent/20 text-accent font-semibold' : 'text-primary hover:bg-border/30'
                    }`}
                    onClick={() => addPath(suggestion)}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {getFileIcon(file)}
                      <span className="font-semibold text-primary">{file}</span>
                    </div>
                    {dir && (
                      <span className="text-[10px] text-muted/60 truncate pl-4 shrink-0 max-w-[70%]">
                        {dir}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {loadingFiles && (
            <p className="text-[10px] text-accent mt-1 flex items-center gap-1">
              <svg className="spinner text-accent" width="10" height="10" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="20 12" />
              </svg>
              Indexing repository files...
            </p>
          )}

          <p className="text-[10px] text-muted mt-1 italic">
            Leave blank to search the entire repository (.).
          </p>
        </div>

        {/* Revisions Multi-select */}
        <div className="flex-1 flex flex-col min-h-[200px] overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[12px] text-muted">
              Target Branches / Revisions ({selectedRevs.length} selected)
            </label>
            {selectedRevs.length > 0 && (
              <button
                className="text-[10px] text-accent hover:underline"
                onClick={() => setSelectedRevs([])}
              >
                Clear all
              </button>
            )}
          </div>
          <input
            type="text"
            className="input-field w-full text-[11px] mb-2 shrink-0"
            placeholder="Filter branches..."
            value={revSearch}
            onChange={(e) => setRevSearch(e.target.value)}
          />
          <div className="flex-1 overflow-y-auto border border-border rounded divide-y divide-border/20 bg-surface/50 relative min-h-[150px]">
            {repoState?.loading.branches ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted text-[12px] bg-surface/40">
                <svg className="spinner mb-2 text-accent" width="18" height="18" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="20 12" />
                </svg>
                Loading versions...
              </div>
            ) : filteredRevs.length === 0 ? (
              <div className="p-3 text-muted text-center text-[12px]">No branches found</div>
            ) : (
              filteredRevs.map((rev) => {
                const isChecked = selectedRevs.includes(rev);
                return (
                  <label
                    key={rev}
                    className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-border/20 cursor-pointer select-none transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleRevision(rev)}
                      className="accent-accent"
                    />
                    <span className={`font-mono text-[11px] truncate ${isChecked ? 'text-accent font-semibold' : 'text-primary'}`}>
                      {rev}
                    </span>
                  </label>
                );
              })
            )}
          </div>
          <p className="text-[10px] text-muted mt-1 italic">
            Leave blank to search the current working tree.
          </p>
        </div>

        {/* Submit */}
        <button
          className={`btn-accent w-full py-2 justify-center font-semibold text-[13px] ${!query.trim() || searching ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={!query.trim() || searching}
          onClick={handleSearch}
        >
          {searching ? (
            <>
              <svg className="spinner mr-2" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="20 12" />
              </svg>
              {currentSearchingRev ? `Searching ${currentSearchingRev}...` : 'Searching...'}
            </>
          ) : (
            'Grep Search'
          )}
        </button>
      </div>

      {/* Right Pane: Results Grid */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#0D1117]">
        {/* Results Header */}
        <div className="px-4 py-3 border-b border-border bg-surface/40 flex justify-between items-center shrink-0">
          <div>
            <span className="font-semibold text-primary">Search Results</span>
            {results.length > 0 && (
              <span className="ml-2 text-muted text-[12px]">
                ({results.length} match{results.length > 1 ? 'es' : ''} found)
              </span>
            )}
          </div>
          {results.length > 0 && (
            <button
              onClick={handleCopyJson}
              className="btn-surface text-[11px] px-2.5 py-1.5 font-semibold flex items-center gap-1.5 transition-all active:scale-95"
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5 text-success animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>Copied as JSON!</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-muted hover:text-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z" />
                  </svg>
                  <span>Copy JSON</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto relative">
          {searching && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-accent/5 border-b border-border/20 text-accent text-[11px] font-mono shrink-0 select-none sticky top-0 backdrop-blur z-10">
              <svg className="spinner text-accent" width="12" height="12" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="20 12" />
              </svg>
              <span>Searching {currentSearchingRev || 'versions'}...</span>
            </div>
          )}

          {results.length === 0 && searching ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted">
              <svg className="spinner mb-2 text-accent" width="24" height="24" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="20 12" />
              </svg>
              <span>Running git grep...</span>
            </div>
          ) : errorMsg && results.length === 0 ? (
            <div className="p-4 text-danger bg-danger/10 border border-danger/20 rounded m-4 font-mono text-[12px]">
              {errorMsg}
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted px-6">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="mb-3 opacity-20">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
                <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="text-[14px] font-semibold text-primary">No matches found</span>
              <span className="text-[11px] text-muted/80 mt-1 text-center">Try relaxing your search terms or specifying fewer branches.</span>
              <div className="mt-4 p-3 bg-surface/30 border border-border/40 rounded text-[11px] text-muted max-w-md text-center leading-relaxed">
                <span className="text-accent font-semibold block mb-1">Tip for Odoo Developers:</span>
                Make sure you have selected the correct repository (Community vs Enterprise) in the left sidebar. Community files (e.g. <code className="text-warning">addons/*</code>) do not exist in the Enterprise repository.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-4 font-mono">
              {groupedResults.map((verGroup) => {
                const isCollapsed = collapsedVersions[verGroup.version];
                return (
                  <div
                    key={verGroup.version}
                    className="border border-border/40 rounded-lg overflow-hidden bg-[#161B22]/15 shadow-md hover:border-border/60 transition-colors"
                  >
                    {/* Version Group Header */}
                    <div
                      className="flex items-center justify-between px-4 py-3 bg-[#1C2129] hover:bg-[#21262D] cursor-pointer select-none transition-colors border-b border-border/30"
                      onClick={() => toggleVersionCollapse(verGroup.version)}
                    >
                      <div className="flex items-center gap-2.5">
                        {/* Chevron */}
                        <svg
                          className={`w-3.5 h-3.5 text-muted transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                        
                        {/* Version Badge */}
                        <span className={`px-2.5 py-0.5 rounded text-[11px] font-extrabold ${
                          verGroup.version === 'Working Tree'
                            ? 'bg-warning/10 text-warning border border-warning/30'
                            : 'bg-accent/10 text-accent border border-accent/30'
                        }`}>
                          {verGroup.version}
                        </span>
                      </div>
                      
                      <span className="text-[10px] text-muted font-semibold bg-border/25 px-2.5 py-0.5 rounded-full border border-border/20">
                        {verGroup.totalMatches} match{verGroup.totalMatches > 1 ? 'es' : ''}
                      </span>
                    </div>

                    {/* Version Files List */}
                    {!isCollapsed && (
                      <div className="bg-surface/5 p-4 flex flex-col gap-3">
                        {verGroup.files.map((fileGroup) => {
                          const { dir, file } = getPathParts(fileGroup.filePath);
                          return (
                            <div key={fileGroup.filePath} className="border border-border/10 rounded overflow-hidden bg-[#161B22]/35">
                              {/* File Header */}
                              <div
                                className="flex items-center justify-between px-3 py-1.5 bg-[#161B22]/65 hover:bg-[#161B22]/85 transition-colors cursor-pointer"
                                onClick={() => navigator.clipboard.writeText(fileGroup.filePath)}
                                title="Click to copy file path"
                              >
                                <div className="flex items-center gap-2 text-[11px] truncate mr-4">
                                  {getFileIcon(file)}
                                  <span className="font-semibold text-primary">{file}</span>
                                  {dir && <span className="text-muted/65 text-[10px]">({dir})</span>}
                                </div>
                                <span className="text-[10px] text-muted/80 bg-border/20 px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                                  {fileGroup.matches.length}
                                </span>
                              </div>

                              {/* Matches Snippets */}
                              <div className="divide-y divide-border/10">
                                {fileGroup.matches.map((match, idx) => (
                                  <div key={idx} className="px-3 py-2 flex flex-col gap-1.5 hover:bg-border/5">
                                    <div className="flex items-center gap-1.5 text-[10px] text-muted">
                                      <span>Line</span>
                                      <span className="text-warning font-semibold">{match.line}</span>
                                    </div>
                                    <pre className="bg-[#0D1117] p-2 rounded border border-border/20 overflow-x-auto text-[12px] leading-relaxed text-primary scrollbar-thin font-mono">
                                      <code>{renderHighlightedContent(match.content)}</code>
                                    </pre>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
