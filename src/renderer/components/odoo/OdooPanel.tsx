import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRepoStore } from '../../store/repos';
import { useGitStore } from '../../store/git';
import { useUIStore } from '../../store/ui';
import { Dropdown } from '../shared/Dropdown';
import { DbDropdown } from '../shared/DbDropdown';
import { useGit } from '../../hooks/useGit';

const stripAnsi = (str: string) => {
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
};

const ODOO_LOG_REGEX = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})\s+(\d+)\s+(INFO|WARNING|ERROR|DEBUG|CRITICAL)\s+(\S+)\s+([\w\.\-]+):\s*(.*)$/;
const WERKZEUG_REGEX = /^([\d\.]+) - - \[(.*?)\] "(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH) (.*?) HTTP\/[0-9\.]+" (\d{3}) (.*)$/;

const getLevelClass = (level: string) => {
  switch (level) {
    case 'INFO': return 'text-emerald-400';
    case 'WARNING': return 'text-amber-400';
    case 'ERROR':
    case 'CRITICAL': return 'text-rose-400 font-semibold';
    case 'DEBUG': return 'text-purple-400';
    default: return 'text-primary/75';
  }
};

const getStatusClass = (statusStr: string) => {
  const code = parseInt(statusStr, 10);
  if (code >= 200 && code < 300) return 'text-emerald-400 font-semibold';
  if (code >= 300 && code < 400) return 'text-sky-300';
  if (code >= 400 && code < 500) return 'text-amber-400 font-semibold';
  if (code >= 500) return 'text-rose-500 font-bold';
  return 'text-muted';
};

const getMethodClass = (method: string) => {
  switch (method) {
    case 'GET': return 'text-sky-400 font-semibold';
    case 'POST': return 'text-teal-400 font-semibold';
    case 'PUT':
    case 'PATCH': return 'text-purple-400 font-semibold';
    case 'DELETE': return 'text-rose-500 font-semibold';
    default: return 'text-yellow-400 font-semibold';
  }
};

const renderFormattedMessage = (logger: string, message: string) => {
  if (logger === 'werkzeug') {
    const match = message.match(WERKZEUG_REGEX);
    if (match) {
      const [_, ip, time, method, path, status, rest] = match;
      return (
        <span className="flex items-center gap-1.5 flex-wrap">
          <span className="text-muted/50 select-none shrink-0">{ip}</span>
          <span className="text-muted/40 select-none shrink-0">[{time}]</span>
          <span className={`${getMethodClass(method)} shrink-0`}>"{method}</span>
          <span className="text-primary break-all">{path} HTTP/1.1"</span>
          <span className={`${getStatusClass(status)} shrink-0`}>{status}</span>
          <span className="text-muted/65 break-all">{rest}</span>
        </span>
      );
    }
  }
  
  if (message.toLowerCase().includes('deprecated') || message.toLowerCase().includes('warning')) {
    return <span className="text-amber-300/90">{message}</span>;
  }
  if (message.toLowerCase().includes('fail') || message.toLowerCase().includes('error')) {
    return <span className="text-rose-300/90">{message}</span>;
  }

  return <span>{message}</span>;
};

const TerminalLine = React.memo(({ line }: { line: string }) => {
  if (!line.trim()) {
    return <div className="h-4" />;
  }

  const match = line.match(ODOO_LOG_REGEX);
  if (!match) {
    // 1. (Pdb) prompt
    if (line.trim() === '(Pdb)') {
      return (
        <div className="font-mono text-[11px] py-[1.5px] text-teal-400 font-bold tracking-wider select-none">
          (Pdb)
        </div>
      );
    }

    // 2. Python File/Line breakpoint location: > /path/to/file.py(123)func_name()
    const dbgMatch = line.match(/^>\s*(\/.*?\.py)\((\d+)\)(.*)$/);
    if (dbgMatch) {
      const [_, filePath, lineNum, funcName] = dbgMatch;
      return (
        <div className="font-mono text-[11px] py-[2px] border-b border-border/5 text-slate-350 leading-relaxed select-text">
          <span className="text-teal-400 font-bold mr-1">&gt;</span>
          <span className="text-teal-300 font-semibold hover:underline" title={filePath}>{filePath}</span>
          <span className="text-muted/40 font-semibold">(</span>
          <span className="text-amber-400 font-bold">{lineNum}</span>
          <span className="text-muted/40 font-semibold">)</span>
          <span className="text-sky-300 font-medium pl-1">{funcName}</span>
        </div>
      );
    }

    // 3. User command entered (starts with "> ")
    if (line.startsWith('> ')) {
      const command = line.substring(2);
      return (
        <div className="font-mono text-[11px] py-[1.5px] leading-relaxed select-text text-slate-200">
          <span className="text-teal-400 font-bold select-none">&gt; </span>
          <span className="font-semibold text-slate-100">{command}</span>
        </div>
      );
    }

    // 4. Code lines under debugger: ->  source_code
    if (line.trim().startsWith('->')) {
      return (
        <div className="font-mono text-[11px] py-[1.5px] text-yellow-250/90 font-medium pl-4 select-text leading-relaxed">
          {line}
        </div>
      );
    }

    // Default formatting for other outputs (tracebacks, general outputs, pdb stdout)
    let colorClass = 'text-slate-300/95';
    if (line.toLowerCase().includes('traceback') || line.startsWith('  File "')) {
      colorClass = 'text-rose-400/90';
    } else if (line.toLowerCase().includes('error') || line.toLowerCase().includes('exception')) {
      colorClass = 'text-rose-400 font-semibold';
    } else if (line.toLowerCase().includes('warning')) {
      colorClass = 'text-amber-300/90';
    } else if (line.startsWith('[App]')) {
      colorClass = 'text-sky-400 font-semibold';
    }
    
    return (
      <div className={`font-mono text-[11px] py-[1px] leading-relaxed break-all whitespace-pre-wrap ${colorClass} select-text`}>
        {line}
      </div>
    );
  }

  const [_, timestamp, pid, level, db, logger, message] = match;

  return (
    <div className="font-mono text-[11px] py-[1.5px] border-b border-border/5 hover:bg-white/5 transition-colors leading-relaxed break-all whitespace-pre-wrap select-text">
      <span className="text-muted/40 select-none mr-2">{timestamp}</span>
      <span className="text-blue-400/40 select-none mr-1.5 font-light">[{pid}]</span>
      <span className={`mr-2 font-semibold ${getLevelClass(level)}`}>
        {level}
      </span>
      <span className="text-cyan-400/60 mr-2 font-medium">[{db}]</span>
      <span className="text-amber-400/60 mr-1.5 font-medium">{logger}:</span>
      <span className="text-primary/90 pl-0.5">
        {renderFormattedMessage(logger, message)}
      </span>
    </div>
  );
});

TerminalLine.displayName = 'TerminalLine';

interface ModuleSelectorProps {
  label: string;
  modules: string[];
  onChange: (mods: string[]) => void;
  allModules: string[];
  placeholder?: string;
  disabled?: boolean;
}

export function ModuleSelector({ label, modules, onChange, allModules, placeholder, disabled = false }: ModuleSelectorProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

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
    if (disabled) return;
    const trimmed = modName.trim();
    if (trimmed && !modules.includes(trimmed)) {
      onChange([...modules, trimmed]);
    }
    setInputValue('');
    setFocusedIndex(-1);
    setShowSuggestions(false);
  };

  const removeModule = (modName: string) => {
    if (disabled) return;
    onChange(modules.filter((m) => m !== modName));
  };

  return (
    <div className="relative">
      <label className="block text-[10px] text-muted font-bold uppercase mb-1">{label}</label>
      <div className={`flex flex-wrap items-center gap-1.5 p-1.5 bg-[#0D1117]/60 border border-border rounded focus-within:border-accent/70 transition-colors w-full min-h-[34px] ${
        disabled ? 'opacity-50 cursor-not-allowed pointer-events-none bg-[#0D1117]/30' : 'cursor-text'
      }`}>
        {modules.map((m) => (
          <span
            key={m}
            className="inline-flex items-center gap-1 bg-accent/15 text-accent font-semibold px-2 py-0.5 rounded text-[11px] font-mono select-none"
          >
            {m}
            {!disabled && (
              <button
                type="button"
                className="text-danger hover:scale-125 transition-all font-extrabold text-[14px] leading-none shrink-0 ml-1"
                onClick={(e) => {
                  e.stopPropagation();
                  removeModule(m);
                }}
              >
                ×
              </button>
            )}
          </span>
        ))}
        <input
          type="text"
          disabled={disabled}
          className="bg-transparent border-none outline-none flex-1 min-w-[120px] text-primary text-[12px] font-mono p-0 h-[20px] disabled:cursor-not-allowed"
          placeholder={modules.length === 0 ? placeholder : ""}
          value={inputValue}
          onChange={(e) => {
            if (disabled) return;
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
              onChange(modules.slice(0, -1));
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
  );
}

interface AddonPathRowProps {
  path: string;
  absPath: string;
  onRemove: () => void;
  disabled?: boolean;
}

function AddonPathRow({ path, absPath, onRemove, disabled = false }: AddonPathRowProps) {
  const repos = useRepoStore((s) => s.repos);
  const repoStates = useGitStore((s) => s.repoStates);

  // Find matching repository in the workspace
  const matchedRepo = useMemo(() => {
    return repos.find(r => 
      absPath.toLowerCase() === r.path.toLowerCase() || 
      absPath.toLowerCase().startsWith(r.path.toLowerCase() + '/')
    );
  }, [absPath, repos]);

  const repoPath = matchedRepo?.path || null;
  const { refreshAll, checkoutBranch, pullBranch } = useGit(repoPath);

  const repoState = repoStates[repoPath || ''];
  const currentBranch = repoState?.status?.current || '';
  const branchesList = repoState?.branches?.local || [];
  const isPulling = repoState?.loading.pull;
  const isCheckingOut = repoState?.loading.checkout;
  const checkingOutBranchName = repoState?.checkingOutBranchName || null;

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    if (repoPath) {
      refreshAll();
    }
  }, [repoPath]);

  const handlePull = async () => {
    if (!repoPath || !repoState) return;
    const remote = repoState.status?.tracking?.split('/')[0] || repoState.remotes[0]?.name || 'origin';
    const branchName = currentBranch || 'master';
    await pullBranch(remote, branchName);
  };

  return (
    <div className={`flex items-center justify-between gap-3 py-1.5 px-3 hover:bg-[#161B22]/40 transition-colors first:rounded-t-md last:rounded-b-md relative ${
      isDropdownOpen ? 'z-[50]' : 'z-auto'
    }`}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {!disabled && (
          <button
            type="button"
            onClick={onRemove}
            className="text-muted hover:text-danger hover:scale-110 transition-all font-bold text-[16px] leading-none shrink-0"
            title="Remove path"
          >
            ×
          </button>
        )}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[12px] font-mono text-primary truncate" title={absPath}>
            {path}
          </span>
          {matchedRepo ? (
            <span className="text-[8px] text-success/80 font-semibold bg-success/5 px-1 rounded border border-success/10 uppercase tracking-wider shrink-0">
              git
            </span>
          ) : (
            <span className="text-[8px] text-muted font-semibold bg-muted/10 px-1 rounded border border-muted/15 uppercase tracking-wider shrink-0">
              local
            </span>
          )}
        </div>
      </div>

      {matchedRepo && (
        <div className="flex items-center gap-2 shrink-0 w-[320px]">
          <div className="flex-1 min-w-0">
            <Dropdown
              options={branchesList.map((b) => b.name)}
              value={currentBranch}
              onChange={(val) => checkoutBranch(val)}
              disabled={disabled || isCheckingOut || isPulling}
              size="sm"
              searchable={true}
              placeholder="Select branch..."
              onOpenChange={setIsDropdownOpen}
              loading={isCheckingOut}
              loadingLabel={checkingOutBranchName || undefined}
            />
          </div>
          <button
            type="button"
            onClick={handlePull}
            disabled={disabled || isCheckingOut || isPulling || !currentBranch}
            className="btn-accent py-0.5 px-2 h-[24px] text-[10px] font-semibold shrink-0 flex items-center justify-center gap-1"
          >
            {isPulling ? (
              <>
                <svg className="spinner text-accent shrink-0 animate-spin" width="10" height="10" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="20 12" />
                </svg>
                <span>Pulling</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 text-accent shrink-0" viewBox="0 0 16 16" fill="none">
                  <path d="M8 4V12M5 9L8 12L11 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Pull</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

interface AddonsPathInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function AddonsPathInput({ label, value, onChange, disabled = false }: AddonsPathInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="block text-[10px] text-muted font-bold uppercase mb-1">{label}</label>
      <input
        type="text"
        disabled={disabled}
        className="w-full bg-[#0D1117]/60 text-[12px] py-1.5 px-3 border border-border rounded outline-none font-mono text-primary min-h-[34px] focus:border-accent/70 disabled:opacity-50 disabled:cursor-not-allowed"
        placeholder="e.g. addons,../enterprise"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

interface AddonPathRowsListProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  communityRepoPath: string;
}

function AddonPathRowsList({ value, onChange, disabled = false, communityRepoPath }: AddonPathRowsListProps) {
  const getAbsPath = (pathStr: string) => {
    if (!pathStr) return '';
    if (pathStr.startsWith('/') || pathStr.match(/^[a-zA-Z]:\\/)) {
      return pathStr;
    }
    if (!communityRepoPath) return pathStr;
    const baseParts = communityRepoPath.split('/').filter(Boolean);
    const relParts = pathStr.split('/').filter(Boolean);
    for (const part of relParts) {
      if (part === '..') {
        baseParts.pop();
      } else if (part !== '.') {
        baseParts.push(part);
      }
    }
    return '/' + baseParts.join('/');
  };

  const pathList = useMemo(() => {
    return value.split(',').map((s) => s.trim()).filter(Boolean);
  }, [value]);

  const handleRemovePath = (targetPath: string) => {
    if (disabled) return;
    const newList = pathList.filter((p) => p !== targetPath);
    onChange(newList.join(','));
  };

  if (pathList.length === 0) return null;

  return (
    <div className="border border-border/50 rounded-md bg-[#161B22]/10 divide-y divide-border/40">
      {pathList.map((path) => (
        <AddonPathRow
          key={path}
          path={path}
          absPath={getAbsPath(path)}
          onRemove={() => handleRemovePath(path)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

export function OdooPanel() {
  const repos = useRepoStore((s) => s.repos);
  const activeRepoPath = useRepoStore((s) => s.activeRepoPath);
  const repoStates = useGitStore((s) => s.repoStates);
  const isCheckingOut = useMemo(() => {
    return Object.values(repoStates).some((state) => state?.loading?.checkout);
  }, [repoStates]);

  // Compute community repo path (must contain 'odoo' and not 'enterprise', 'theme', 'design')
  const communityRepoPath = useMemo(() => {
    const exactOdoo = repos.find((r) => r.name.toLowerCase() === 'odoo');
    if (exactOdoo) return exactOdoo.path;

    const matched = repos.find((r) => {
      const name = r.name.toLowerCase();
      return name.includes('odoo') && !name.includes('enterprise') && !name.includes('theme') && !name.includes('design');
    });
    if (matched) return matched.path;

    return repos[0]?.path || '';
  }, [repos]);

  const repoState = useGitStore((s) => (communityRepoPath ? s.repoStates[communityRepoPath] : null));
  const currentBranch = repoState?.status?.current || 'detached';
  const { addToast, showModal } = useUIStore();

  // DB and Host Config
  const [dbUser, setDbUser] = useState('odoo');
  const [dbHost, setDbHost] = useState('127.0.0.1');
  const [dbPassword, setDbPassword] = useState('');

  // DB list & Statuses
  const [dbs, setDbs] = useState<string[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);
  const [loadingDbs, setLoadingDbs] = useState(false);
  const [isDbConnected, setIsDbConnected] = useState(false);

  // Venvs
  const [venvs, setVenvs] = useState<string[]>([]);
  const [selectedVenv, setSelectedVenv] = useState('');
  const [newVenvPath, setNewVenvPath] = useState('');

  // Server State
  const [serverStatus, setServerStatus] = useState<'starting' | 'running' | 'stopped'>('stopped');
  const [runningCmd, setRunningCmd] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [stdinInput, setStdinInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tempInput, setTempInput] = useState('');
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = localStorage.getItem('odoo_leftWidth');
    return saved !== null ? parseFloat(saved) : 45;
  });
  const [isTerminalMaximized, setIsTerminalMaximized] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  const handleScroll = () => {
    const el = logsContainerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 45;
    shouldAutoScrollRef.current = isAtBottom;
  };

  const processedLines = useMemo(() => {
    const lines: string[] = [];
    for (let i = 0; i < logs.length; i++) {
      const parts = logs[i].split('\n');
      for (let j = 0; j < parts.length; j++) {
        const part = parts[j];
        if (j === parts.length - 1 && part === '') continue;
        lines.push(part);
      }
    }
    if (lines.length > 1000) {
      return lines.slice(lines.length - 1000);
    }
    return lines;
  }, [logs]);
  const [activeTab, setActiveTab] = useState<'run' | 'upgrade' | 'test'>('run');

  // Creation/Duplication Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createDbName, setCreateDbName] = useState('');
  const [createTemplateSource, setCreateTemplateSource] = useState('');

  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [dupSrcDb, setDupSrcDb] = useState('');
  const [dupDestDb, setDupDestDb] = useState('');

  // Drop DB confirm modal
  const [showDropConfirmModal, setShowDropConfirmModal] = useState(false);
  const [dropTargetDb, setDropTargetDb] = useState('');

  // Terminal scroll helper
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const createDbInputRef = useRef<HTMLInputElement>(null);
  const duplicateDbInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showCreateModal) {
      setTimeout(() => {
        createDbInputRef.current?.focus();
        createDbInputRef.current?.select();
      }, 50);
    }
  }, [showCreateModal]);

  useEffect(() => {
    if (showDuplicateModal) {
      setTimeout(() => {
        duplicateDbInputRef.current?.focus();
        duplicateDbInputRef.current?.select();
      }, 50);
    }
  }, [showDuplicateModal]);

  // Form Configurations
  // Run Server Form
  const [runPort, setRunPort] = useState(() => {
    const saved = localStorage.getItem('odoo_runPort');
    return saved !== null ? parseInt(saved, 10) : 8069;
  });
  const [runDbName, setRunDbName] = useState(() => {
    return localStorage.getItem('odoo_runDbName') ?? '';
  });
  const [runInterface, setRunInterface] = useState(() => {
    return localStorage.getItem('odoo_runInterface') ?? '127.0.0.1';
  });
  const [runAddons, setRunAddons] = useState(() => {
    return localStorage.getItem('odoo_runAddons') ?? 'addons,../enterprise';
  });
  const [runDevAll, setRunDevAll] = useState(() => {
    const saved = localStorage.getItem('odoo_runDevAll');
    return saved !== null ? saved === 'true' : true;
  });
  const [runWithDemo, setRunWithDemo] = useState(() => {
    const saved = localStorage.getItem('odoo_runWithDemo');
    return saved !== null ? saved === 'true' : true;
  });
  const [runStopAfterInit, setRunStopAfterInit] = useState(() => {
    const saved = localStorage.getItem('odoo_runStopAfterInit');
    return saved !== null ? saved === 'true' : false;
  });
  const [runCustomArgs, setRunCustomArgs] = useState(() => {
    return localStorage.getItem('odoo_runCustomArgs') ?? '';
  });
  const [runUseCustomCommand, setRunUseCustomCommand] = useState(() => {
    const saved = localStorage.getItem('odoo_runUseCustomCommand');
    return saved !== null ? saved === 'true' : false;
  });
  const [runCustomCommand, setRunCustomCommand] = useState(() => {
    return localStorage.getItem('odoo_runCustomCommand') ?? '';
  });

  // Upgrade Form
  const [upUpgradePaths, setUpUpgradePaths] = useState(() => {
    return localStorage.getItem('odoo_upUpgradePaths') ?? '../upgrade-util/src,../upgrade/migrations';
  });
  const [upAddons, setUpAddons] = useState(() => {
    return localStorage.getItem('odoo_upAddons') ?? 'addons,../enterprise';
  });
  const [upDbName, setUpDbName] = useState(() => {
    return localStorage.getItem('odoo_upDbName') ?? '';
  });
  const [upRestoreTemplate, setUpRestoreTemplate] = useState(() => {
    const saved = localStorage.getItem('odoo_upRestoreTemplate');
    return saved !== null ? saved === 'true' : false;
  });
  const [upTemplateDb, setUpTemplateDb] = useState(() => {
    return localStorage.getItem('odoo_upTemplateDb') ?? '';
  });
  const [upStopAfterInit, setUpStopAfterInit] = useState(() => {
    const saved = localStorage.getItem('odoo_upStopAfterInit');
    return saved !== null ? saved === 'true' : true;
  });
  const [upCustomArgs, setUpCustomArgs] = useState(() => {
    return localStorage.getItem('odoo_upCustomArgs') ?? '';
  });
  const [upUseCustomCommand, setUpUseCustomCommand] = useState(() => {
    const saved = localStorage.getItem('odoo_upUseCustomCommand');
    return saved !== null ? saved === 'true' : false;
  });
  const [upCustomCommand, setUpCustomCommand] = useState(() => {
    return localStorage.getItem('odoo_upCustomCommand') ?? '';
  });

  // Combined upgrade and addons path list for branch dropdown/pull rows
  const upCombinedPaths = useMemo(() => {
    return [upUpgradePaths, upAddons].filter(Boolean).join(',');
  }, [upUpgradePaths, upAddons]);

  const handleUpCombinedChange = useCallback((newVal: string) => {
    const newPathsList = newVal.split(',').map(s => s.trim()).filter(Boolean);
    const origUpgradeList = upUpgradePaths.split(',').map(s => s.trim()).filter(Boolean);
    const origAddonsList = upAddons.split(',').map(s => s.trim()).filter(Boolean);

    const nextUpgradeList = origUpgradeList.filter(p => newPathsList.includes(p));
    const nextAddonsList = origAddonsList.filter(p => newPathsList.includes(p));

    setUpUpgradePaths(nextUpgradeList.join(','));
    setUpAddons(nextAddonsList.join(','));

    localStorage.setItem('odoo_upUpgradePaths', nextUpgradeList.join(','));
    localStorage.setItem('odoo_upAddons', nextAddonsList.join(','));
  }, [upUpgradePaths, upAddons]);

  // Test Form
  const [testAddons, setTestAddons] = useState(() => {
    return localStorage.getItem('odoo_testAddons') ?? 'addons,../enterprise';
  });
  const [testDbName, setTestDbName] = useState(() => {
    return localStorage.getItem('odoo_testDbName') ?? '';
  });
  const [testTags, setTestTags] = useState(() => {
    return localStorage.getItem('odoo_testTags') ?? '';
  });
  const [testPort, setTestPort] = useState(() => {
    const saved = localStorage.getItem('odoo_testPort');
    return saved !== null ? parseInt(saved, 10) : 0;
  });
  const [testStopAfterInit, setTestStopAfterInit] = useState(() => {
    const saved = localStorage.getItem('odoo_testStopAfterInit');
    return saved !== null ? saved === 'true' : true;
  });
  const [testCustomArgs, setTestCustomArgs] = useState(() => {
    return localStorage.getItem('odoo_testCustomArgs') ?? '';
  });
  const [testUseCustomCommand, setTestUseCustomCommand] = useState(() => {
    const saved = localStorage.getItem('odoo_testUseCustomCommand');
    return saved !== null ? saved === 'true' : false;
  });
  const [testCustomCommand, setTestCustomCommand] = useState(() => {
    return localStorage.getItem('odoo_testCustomCommand') ?? '';
  });

  // Module Lists
  const [allModules, setAllModules] = useState<string[]>([]);
  const [runUpdateModules, setRunUpdateModules] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('odoo_runUpdateModules');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [runInstallModules, setRunInstallModules] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('odoo_runInstallModules');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [upUpdateModules, setUpUpdateModules] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('odoo_upUpdateModules');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [testModules, setTestModules] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('odoo_testModules');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [testUpdateModules, setTestUpdateModules] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('odoo_testUpdateModules');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });



  // Preset Manager
  interface OdooPreset {
    name: string;
    isCustom?: boolean;
    odooVersion: string;
    activeTab: 'run' | 'upgrade' | 'test';
    venvPath?: string;
    // run
    runPort?: number;
    runDbName?: string;
    runInterface?: string;
    runAddons?: string;
    runInstallModules?: string[];
    runUpdateModules?: string[];
    runDevAll?: boolean;
    runWithDemo?: boolean;
    runStopAfterInit?: boolean;
    runCustomArgs?: string;
    runUseCustomCommand?: boolean;
    runCustomCommand?: string;
    // upgrade
    upUpgradePaths?: string;
    upAddons?: string;
    upDbName?: string;
    upRestoreTemplate?: boolean;
    upTemplateDb?: string;
    upUpdateModules?: string[];
    upStopAfterInit?: boolean;
    upCustomArgs?: string;
    upUseCustomCommand?: boolean;
    upCustomCommand?: string;
    // test
    testAddons?: string;
    testDbName?: string;
    testModules?: string[];
    testUpdateModules?: string[];
    testTags?: string;
    testPort?: number;
    testStopAfterInit?: boolean;
    testCustomArgs?: string;
    testUseCustomCommand?: boolean;
    testCustomCommand?: string;
    branches?: Record<string, string>;
  }

  const defaultPresets: OdooPreset[] = [
    {
      name: 'Odoo 16.0 Default Run',
      odooVersion: '16.0',
      activeTab: 'run',
      runPort: 8069,
      runDbName: '',
      runInterface: '127.0.0.1',
      runAddons: 'addons,../enterprise',
      runInstallModules: [],
      runUpdateModules: [],
      runDevAll: true,
      runWithDemo: false,
      runStopAfterInit: false,
      runCustomArgs: '',
    },
    {
      name: 'Odoo 17.0 Default Run',
      odooVersion: '17.0',
      activeTab: 'run',
      runPort: 8069,
      runDbName: '',
      runInterface: '127.0.0.1',
      runAddons: 'addons,../enterprise',
      runInstallModules: [],
      runUpdateModules: [],
      runDevAll: true,
      runWithDemo: false,
      runStopAfterInit: false,
      runCustomArgs: '',
    },
    {
      name: 'Odoo 17.0 Default Upgrade',
      odooVersion: '17.0',
      activeTab: 'upgrade',
      upUpgradePaths: '../upgrade-util/src,../upgrade/migrations',
      upAddons: 'addons,../enterprise',
      upDbName: '',
      upRestoreTemplate: false,
      upTemplateDb: '',
      upUpdateModules: ['base'],
      upStopAfterInit: true,
      upCustomArgs: '',
    },
    {
      name: 'Odoo 17.0 Default Test',
      odooVersion: '17.0',
      activeTab: 'test',
      testAddons: 'addons,../enterprise',
      testDbName: 'test_db',
      testTags: '',
      testPort: 0,
      testStopAfterInit: true,
      testCustomArgs: '',
    },
    {
      name: 'Odoo 18.0 Default Run',
      odooVersion: '18.0',
      activeTab: 'run',
      runPort: 8069,
      runDbName: '',
      runInterface: '127.0.0.1',
      runAddons: 'addons,../enterprise',
      runInstallModules: [],
      runUpdateModules: [],
      runDevAll: true,
      runWithDemo: true,
      runStopAfterInit: false,
      runCustomArgs: '',
    },
    {
      name: 'Odoo 18.0 Default Upgrade',
      odooVersion: '18.0',
      activeTab: 'upgrade',
      upUpgradePaths: '../upgrade-util/src,../upgrade/migrations',
      upAddons: 'addons,../enterprise',
      upDbName: '',
      upRestoreTemplate: false,
      upTemplateDb: '',
      upUpdateModules: ['base'],
      upStopAfterInit: true,
      upCustomArgs: '',
    },
    {
      name: 'Odoo 18.0 Default Test',
      odooVersion: '18.0',
      activeTab: 'test',
      testAddons: 'addons,../enterprise',
      testDbName: 'test_db',
      testTags: '',
      testPort: 0,
      testStopAfterInit: true,
      testCustomArgs: '',
    },
    {
      name: 'Odoo 19.0 Default Run',
      odooVersion: '19.0',
      activeTab: 'run',
      runPort: 8069,
      runDbName: '',
      runInterface: '127.0.0.1',
      runAddons: 'addons,../enterprise',
      runInstallModules: [],
      runUpdateModules: [],
      runDevAll: true,
      runWithDemo: true,
      runStopAfterInit: false,
      runCustomArgs: '',
    },
    {
      name: 'Odoo 19.0 Default Upgrade',
      odooVersion: '19.0',
      activeTab: 'upgrade',
      upUpgradePaths: '../upgrade-util/src,../upgrade/migrations',
      upAddons: 'addons,../enterprise',
      upDbName: '',
      upRestoreTemplate: false,
      upTemplateDb: '',
      upUpdateModules: ['base'],
      upStopAfterInit: true,
      upCustomArgs: '',
    },
    {
      name: 'Odoo 19.0 Default Test',
      odooVersion: '19.0',
      activeTab: 'test',
      testAddons: 'addons,../enterprise',
      testDbName: 'test_db',
      testTags: '',
      testPort: 0,
      testStopAfterInit: true,
      testCustomArgs: '',
    },
  ];

  const [customPresets, setCustomPresets] = useState<OdooPreset[]>(() => {
    try {
      const saved = localStorage.getItem('odoo_custom_presets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [deletedDefaults, setDeletedDefaults] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('odoo_deleted_defaults');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const allPresets = useMemo(() => {
    const merged = defaultPresets.map((dp) => {
      const override = customPresets.find((cp) => cp.name === dp.name);
      return override || dp;
    }).concat(customPresets.filter((cp) => !defaultPresets.some((dp) => dp.name === cp.name)));

    return merged.filter((p) => !deletedDefaults.includes(p.name));
  }, [customPresets, deletedDefaults]);

  // Per-tab preset selection — each tab remembers its own last chosen preset
  const [selectedPresetNames, setSelectedPresetNames] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('odoo_selectedPresetNames');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Derived: the preset name for the currently active tab
  const selectedPresetName = selectedPresetNames[activeTab] ?? '';

  const setSelectedPresetName = (name: string) => {
    setSelectedPresetNames((prev) => {
      const next = { ...prev, [activeTab]: name };
      localStorage.setItem('odoo_selectedPresetNames', JSON.stringify(next));
      return next;
    });
  };
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  const autoVersion = useMemo(() => {
    if (currentBranch.includes('16.0')) return '16.0';
    if (currentBranch.includes('17.0')) return '17.0';
    if (currentBranch.includes('18.0')) return '18.0';
    const match = currentBranch.match(/(\d+\.\d+)/);
    return match ? match[1] : '19.0';
  }, [currentBranch]);

  const selectedPreset = useMemo(() => {
    return allPresets.find((p) => p.name === selectedPresetName);
  }, [allPresets, selectedPresetName]);

  const odooVersion = selectedPreset?.odooVersion || autoVersion;

  // Filter presets based on the active tab
  const filteredPresets = useMemo(() => {
    return allPresets.filter((p) => p.activeTab === activeTab);
  }, [allPresets, activeTab]);



  const handleApplyPreset = (presetName: string) => {
    const preset = allPresets.find((p) => p.name === presetName);
    if (!preset) return;
    // Store per the preset's own tab so switching back to that tab shows it
    setSelectedPresetNames((prev) => {
      const next = { ...prev, [preset.activeTab]: presetName };
      localStorage.setItem('odoo_selectedPresetNames', JSON.stringify(next));
      return next;
    });
    setActiveTab(preset.activeTab);

    if (preset.venvPath !== undefined) {
      setSelectedVenv(preset.venvPath);
      window.odoo.setStoreValue('selectedVenv', preset.venvPath);
    }

    // Run Tab
    if (preset.runPort !== undefined) {
      setRunPort(preset.runPort);
      localStorage.setItem('odoo_runPort', String(preset.runPort));
    }
    if (preset.runDbName !== undefined) {
      setRunDbName(preset.runDbName);
      localStorage.setItem('odoo_runDbName', preset.runDbName);
    }
    if (preset.runInterface !== undefined) {
      setRunInterface(preset.runInterface);
      localStorage.setItem('odoo_runInterface', preset.runInterface);
    }
    if (preset.runAddons !== undefined) {
      setRunAddons(preset.runAddons);
      localStorage.setItem('odoo_runAddons', preset.runAddons);
    }
    if (preset.runInstallModules !== undefined) {
      setRunInstallModules(preset.runInstallModules);
      localStorage.setItem('odoo_runInstallModules', JSON.stringify(preset.runInstallModules));
    }
    if (preset.runUpdateModules !== undefined) {
      setRunUpdateModules(preset.runUpdateModules);
      localStorage.setItem('odoo_runUpdateModules', JSON.stringify(preset.runUpdateModules));
    }
    if (preset.runDevAll !== undefined) {
      setRunDevAll(preset.runDevAll);
      localStorage.setItem('odoo_runDevAll', String(preset.runDevAll));
    }
    if (preset.runWithDemo !== undefined) {
      setRunWithDemo(preset.runWithDemo);
      localStorage.setItem('odoo_runWithDemo', String(preset.runWithDemo));
    }
    if (preset.runStopAfterInit !== undefined) {
      setRunStopAfterInit(preset.runStopAfterInit);
      localStorage.setItem('odoo_runStopAfterInit', String(preset.runStopAfterInit));
    }
    if (preset.runCustomArgs !== undefined) {
      setRunCustomArgs(preset.runCustomArgs);
      localStorage.setItem('odoo_runCustomArgs', preset.runCustomArgs);
    }
    if (preset.runUseCustomCommand !== undefined) {
      setRunUseCustomCommand(preset.runUseCustomCommand);
      localStorage.setItem('odoo_runUseCustomCommand', String(preset.runUseCustomCommand));
    }
    if (preset.runCustomCommand !== undefined) {
      setRunCustomCommand(preset.runCustomCommand);
      localStorage.setItem('odoo_runCustomCommand', preset.runCustomCommand);
    }

    // Upgrade Tab
    if (preset.upUpgradePaths !== undefined) {
      setUpUpgradePaths(preset.upUpgradePaths);
      localStorage.setItem('odoo_upUpgradePaths', preset.upUpgradePaths);
    }
    if (preset.upAddons !== undefined) {
      setUpAddons(preset.upAddons);
      localStorage.setItem('odoo_upAddons', preset.upAddons);
    }
    if (preset.upDbName !== undefined) {
      setUpDbName(preset.upDbName);
      localStorage.setItem('odoo_upDbName', preset.upDbName);
    }
    if (preset.upRestoreTemplate !== undefined) {
      setUpRestoreTemplate(preset.upRestoreTemplate);
      localStorage.setItem('odoo_upRestoreTemplate', String(preset.upRestoreTemplate));
    }
    if (preset.upTemplateDb !== undefined) {
      setUpTemplateDb(preset.upTemplateDb);
      localStorage.setItem('odoo_upTemplateDb', preset.upTemplateDb);
    }
    if (preset.upUpdateModules !== undefined) {
      setUpUpdateModules(preset.upUpdateModules);
      localStorage.setItem('odoo_upUpdateModules', JSON.stringify(preset.upUpdateModules));
    }
    if (preset.upStopAfterInit !== undefined) {
      setUpStopAfterInit(preset.upStopAfterInit);
      localStorage.setItem('odoo_upStopAfterInit', String(preset.upStopAfterInit));
    }
    if (preset.upCustomArgs !== undefined) {
      setUpCustomArgs(preset.upCustomArgs);
      localStorage.setItem('odoo_upCustomArgs', preset.upCustomArgs);
    }
    if (preset.upUseCustomCommand !== undefined) {
      setUpUseCustomCommand(preset.upUseCustomCommand);
      localStorage.setItem('odoo_upUseCustomCommand', String(preset.upUseCustomCommand));
    }
    if (preset.upCustomCommand !== undefined) {
      setUpCustomCommand(preset.upCustomCommand);
      localStorage.setItem('odoo_upCustomCommand', preset.upCustomCommand);
    }

    // Test Tab
    if (preset.testAddons !== undefined) {
      setTestAddons(preset.testAddons);
      localStorage.setItem('odoo_testAddons', preset.testAddons);
    }
    if (preset.testDbName !== undefined) {
      setTestDbName(preset.testDbName);
      localStorage.setItem('odoo_testDbName', preset.testDbName);
    }
    if (preset.testModules !== undefined) {
      setTestModules(preset.testModules);
      localStorage.setItem('odoo_testModules', JSON.stringify(preset.testModules));
    }
    if (preset.testUpdateModules !== undefined) {
      setTestUpdateModules(preset.testUpdateModules);
      localStorage.setItem('odoo_testUpdateModules', JSON.stringify(preset.testUpdateModules));
    }
    if (preset.testTags !== undefined) {
      setTestTags(preset.testTags);
      localStorage.setItem('odoo_testTags', preset.testTags);
    }
    if (preset.testPort !== undefined) {
      setTestPort(preset.testPort);
      localStorage.setItem('odoo_testPort', String(preset.testPort));
    }
    if (preset.testStopAfterInit !== undefined) {
      setTestStopAfterInit(preset.testStopAfterInit);
      localStorage.setItem('odoo_testStopAfterInit', String(preset.testStopAfterInit));
    }
    if (preset.testCustomArgs !== undefined) {
      setTestCustomArgs(preset.testCustomArgs);
      localStorage.setItem('odoo_testCustomArgs', preset.testCustomArgs);
    }
    if (preset.testUseCustomCommand !== undefined) {
      setTestUseCustomCommand(preset.testUseCustomCommand);
      localStorage.setItem('odoo_testUseCustomCommand', String(preset.testUseCustomCommand));
    }
    if (preset.testCustomCommand !== undefined) {
      setTestCustomCommand(preset.testCustomCommand);
      localStorage.setItem('odoo_testCustomCommand', preset.testCustomCommand);
    }

    if (preset.branches) {
      Object.entries(preset.branches).forEach(async ([path, branchName]) => {
        try {
          useGitStore.getState().setRepoState(path, { checkingOutBranchName: branchName });
          useGitStore.getState().setLoading(path, 'checkout', true);
          await window.git.checkout(path, branchName);
          const [status, branches] = await Promise.all([
            window.git.status(path),
            window.git.branches(path)
          ]);
          useGitStore.getState().setRepoState(path, { status, branches });
        } catch (e) {
          console.error(`Failed to checkout branch ${branchName} for ${path}:`, e);
          addToast({ message: `Failed to switch ${path.split('/').pop()} to ${branchName}`, type: 'error' });
        } finally {
          useGitStore.getState().setRepoState(path, { checkingOutBranchName: null });
          useGitStore.getState().setLoading(path, 'checkout', false);
        }
      });
    }

    addToast({ type: 'success', message: `Preset "${presetName}" applied.` });
  };

  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;

    let suffix = '';
    if (activeTab === 'run') suffix = ' - Run';
    else if (activeTab === 'upgrade') suffix = ' - Upgrade';
    else if (activeTab === 'test') suffix = ' - Test';

    let finalName = newPresetName.trim();
    if (!finalName.toLowerCase().endsWith(suffix.toLowerCase())) {
      finalName += suffix;
    }

    if (allPresets.some((p) => p.name.toLowerCase() === finalName.toLowerCase())) {
      addToast({ type: 'error', message: 'A preset with this name already exists.' });
      return;
    }

    const branchesMap: Record<string, string> = {};
    for (const r of repos) {
      const curBranch = repoStates[r.path]?.status?.current;
      if (curBranch) {
        branchesMap[r.path] = curBranch;
      }
    }

    const newPreset: OdooPreset = {
      name: finalName,
      isCustom: true,
      odooVersion,
      activeTab,
      venvPath: selectedVenv,
      runPort,
      runDbName,
      runInterface,
      runAddons,
      runInstallModules,
      runUpdateModules,
      runDevAll,
      runWithDemo,
      runStopAfterInit,
      runCustomArgs,
      runUseCustomCommand,
      runCustomCommand,
      // upgrade
      upUpgradePaths,
      upAddons,
      upDbName,
      upRestoreTemplate,
      upTemplateDb,
      upUpdateModules,
      upStopAfterInit,
      upCustomArgs,
      upUseCustomCommand,
      upCustomCommand,
      // test
      testAddons,
      testDbName,
      testModules,
      testUpdateModules,
      testTags,
      testPort,
      testStopAfterInit,
      testCustomArgs,
      testUseCustomCommand,
      testCustomCommand,
      branches: branchesMap,
    };

    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    localStorage.setItem('odoo_custom_presets', JSON.stringify(updated));
    setSelectedPresetName(newPreset.name);
    setNewPresetName('');
    setShowSavePresetModal(false);
    addToast({ type: 'success', message: `Preset "${newPreset.name}" saved.` });
  };

  const handleUpdateCurrentPreset = () => {
    if (!selectedPresetName) return;

    const branchesMap: Record<string, string> = {};
    for (const r of repos) {
      const curBranch = repoStates[r.path]?.status?.current;
      if (curBranch) {
        branchesMap[r.path] = curBranch;
      }
    }

    const updatedPreset: OdooPreset = {
      name: selectedPresetName,
      isCustom: true,
      odooVersion,
      venvPath: selectedVenv,
      activeTab,
      // run
      runPort,
      runDbName,
      runInterface,
      runAddons,
      runInstallModules,
      runUpdateModules,
      runDevAll,
      runWithDemo,
      runStopAfterInit,
      runCustomArgs,
      runUseCustomCommand,
      runCustomCommand,
      // upgrade
      upUpgradePaths,
      upAddons,
      upDbName,
      upRestoreTemplate,
      upTemplateDb,
      upUpdateModules,
      upStopAfterInit,
      upCustomArgs,
      upUseCustomCommand,
      upCustomCommand,
      // test
      testAddons,
      testDbName,
      testModules,
      testUpdateModules,
      testTags,
      testPort,
      testStopAfterInit,
      testCustomArgs,
      testUseCustomCommand,
      testCustomCommand,
      branches: branchesMap,
    };

    const index = customPresets.findIndex((p) => p.name === selectedPresetName);
    let updated;
    if (index === -1) {
      updated = [...customPresets, updatedPreset];
    } else {
      updated = [...customPresets];
      updated[index] = updatedPreset;
    }

    setCustomPresets(updated);
    localStorage.setItem('odoo_custom_presets', JSON.stringify(updated));

    // Remove from deleted defaults if it was previously hidden
    if (deletedDefaults.includes(selectedPresetName)) {
      const updatedDeleted = deletedDefaults.filter((n) => n !== selectedPresetName);
      setDeletedDefaults(updatedDeleted);
      localStorage.setItem('odoo_deleted_defaults', JSON.stringify(updatedDeleted));
    }

    addToast({ type: 'success', message: `Preset "${selectedPresetName}" saved.` });
  };

  const handleDeletePreset = (presetName: string) => {
    // Remove override
    const updatedCustoms = customPresets.filter((p) => p.name !== presetName);
    setCustomPresets(updatedCustoms);
    localStorage.setItem('odoo_custom_presets', JSON.stringify(updatedCustoms));

    // Mark default as deleted if it's a built-in default preset
    if (defaultPresets.some((dp) => dp.name === presetName)) {
      const updatedDeleted = [...deletedDefaults, presetName];
      setDeletedDefaults(updatedDeleted);
      localStorage.setItem('odoo_deleted_defaults', JSON.stringify(updatedDeleted));
    }

    if (selectedPresetName === presetName) {
      setSelectedPresetName('');
    }
    addToast({ type: 'success', message: `Preset "${presetName}" deleted.` });
  };

  // Dynamically build command string for preview
  const previewCmd = useMemo(() => {
    if (activeTab === 'run' && runUseCustomCommand) {
      return runCustomCommand || './odoo-bin';
    }
    if (activeTab === 'upgrade' && upUseCustomCommand) {
      return upCustomCommand || './odoo-bin';
    }
    if (activeTab === 'test' && testUseCustomCommand) {
      return testCustomCommand || './odoo-bin';
    }

    let targetDb = '';
    let addons = '';
    let initModules: string[] = [];
    let updateModules: string[] = [];
    let stopAfterInit = false;
    let customArgs = '';
    let testTagsVal = '';
    let port = 8069;
    let devAll = false;
    let withDemo: boolean | null = null;
    let upgradePaths = '';

    if (activeTab === 'run') {
      targetDb = runDbName;
      addons = runAddons;
      initModules = runInstallModules;
      updateModules = runUpdateModules;
      devAll = runDevAll;
      withDemo = runWithDemo;
      stopAfterInit = runStopAfterInit;
      customArgs = runCustomArgs;
      port = runPort;
    } else if (activeTab === 'upgrade') {
      targetDb = upDbName;
      addons = upAddons;
      updateModules = upUpdateModules;
      stopAfterInit = upStopAfterInit;
      customArgs = upCustomArgs;
      upgradePaths = upUpgradePaths;
    } else if (activeTab === 'test') {
      targetDb = testDbName;
      addons = testAddons;
      initModules = testModules;
      updateModules = testUpdateModules;
      testTagsVal = testTags;
      stopAfterInit = testStopAfterInit;
      customArgs = testCustomArgs;
      port = testPort;
    }

    const args: string[] = [];
    if (dbUser && dbUser !== 'odoo') {
      args.push('--db_user', dbUser);
    }
    if (dbHost && dbHost !== '127.0.0.1') {
      args.push('--db_host', dbHost);
    }
    if (dbPassword) {
      args.push('--db_password', dbPassword);
    }

    if (addons) {
      args.push('--addons-path', addons);
    }

    if (targetDb) {
      args.push('-d', targetDb);
    } else {
      args.push('--no-database');
    }

    if (activeTab === 'run') {
      if (port && port !== 8069) {
        args.push('--http-port', port.toString());
      }
      if (initModules.length > 0) {
        args.push('-i', initModules.join(','));
      }
      if (updateModules.length > 0) {
        args.push('-u', updateModules.join(','));
      }
      if (devAll) {
        args.push('--dev=all');
      }
      
      const withDemoBool = withDemo === true;
      if (withDemoBool) {
        args.push('--with-demo');
      }
    } else if (activeTab === 'upgrade') {
      if (upgradePaths) {
        args.push('--upgrade-path', upgradePaths);
      }
      if (updateModules.length > 0) {
        args.push('-u', updateModules.join(','));
      }
    } else if (activeTab === 'test') {
      if (port) {
        args.push('--http-port', port.toString());
      }
      args.push('--test-enable');
      if (initModules.length > 0) {
        args.push('-i', initModules.join(','));
      }
      if (updateModules.length > 0) {
        args.push('-u', updateModules.join(','));
      }
      if (testTagsVal) {
        args.push('--test-tags', testTagsVal);
      }
    }

    if (stopAfterInit) {
      args.push('--stop-after-init');
    }

    if (customArgs) {
      const parts = customArgs.split(/\s+/).filter(Boolean);
      args.push(...parts);
    }

    let execCmd = './odoo-bin';
    let execArgs = args;

    if (selectedVenv) {
      execCmd = selectedVenv.endsWith('python') ? selectedVenv : `${selectedVenv}/bin/python`;
      execArgs = ['./odoo-bin', ...args];
    }

    return `${execCmd} ${execArgs.join(' ')}`;
  }, [
    activeTab,
    runDbName, runPort, runInterface, runAddons, runInstallModules, runUpdateModules, runDevAll, runWithDemo, runStopAfterInit, runCustomArgs,
    runUseCustomCommand, runCustomCommand,
    upDbName, upUpgradePaths, upAddons, upUpdateModules, upRestoreTemplate, upTemplateDb, upStopAfterInit, upCustomArgs,
    upUseCustomCommand, upCustomCommand,
    testAddons, testDbName, testModules, testUpdateModules, testTags, testPort, testStopAfterInit, testCustomArgs,
    testUseCustomCommand, testCustomCommand,
    dbUser, dbHost, dbPassword, selectedVenv, odooVersion
  ]);

  const isCustomCommandActive = useMemo(() => {
    if (activeTab === 'run') return runUseCustomCommand;
    if (activeTab === 'upgrade') return upUseCustomCommand;
    if (activeTab === 'test') return testUseCustomCommand;
    return false;
  }, [activeTab, runUseCustomCommand, upUseCustomCommand, testUseCustomCommand]);

  // Persist form states to localStorage
  useEffect(() => {
    localStorage.setItem('odoo_runPort', runPort.toString());
    localStorage.setItem('odoo_runDbName', runDbName);
    localStorage.setItem('odoo_runInterface', runInterface);
    localStorage.setItem('odoo_runAddons', runAddons);
    localStorage.setItem('odoo_runInstallModules', JSON.stringify(runInstallModules));
    localStorage.setItem('odoo_runUpdateModules', JSON.stringify(runUpdateModules));
    localStorage.setItem('odoo_runDevAll', runDevAll.toString());
    localStorage.setItem('odoo_runWithDemo', runWithDemo.toString());
    localStorage.setItem('odoo_runStopAfterInit', runStopAfterInit.toString());
    localStorage.setItem('odoo_runCustomArgs', runCustomArgs);
    localStorage.setItem('odoo_runUseCustomCommand', runUseCustomCommand.toString());
    localStorage.setItem('odoo_runCustomCommand', runCustomCommand);

    localStorage.setItem('odoo_upDbName', upDbName);
    localStorage.setItem('odoo_upUpgradePaths', upUpgradePaths);
    localStorage.setItem('odoo_upAddons', upAddons);
    localStorage.setItem('odoo_upUpdateModules', JSON.stringify(upUpdateModules));
    localStorage.setItem('odoo_upRestoreTemplate', upRestoreTemplate.toString());
    localStorage.setItem('odoo_upTemplateDb', upTemplateDb);
    localStorage.setItem('odoo_upStopAfterInit', upStopAfterInit.toString());
    localStorage.setItem('odoo_upCustomArgs', upCustomArgs);
    localStorage.setItem('odoo_upUseCustomCommand', upUseCustomCommand.toString());
    localStorage.setItem('odoo_upCustomCommand', upCustomCommand);

    localStorage.setItem('odoo_testAddons', testAddons);
    localStorage.setItem('odoo_testDbName', testDbName);
    localStorage.setItem('odoo_testModules', JSON.stringify(testModules));
    localStorage.setItem('odoo_testUpdateModules', JSON.stringify(testUpdateModules));
    localStorage.setItem('odoo_testTags', testTags);
    localStorage.setItem('odoo_testPort', testPort.toString());
    localStorage.setItem('odoo_testStopAfterInit', testStopAfterInit.toString());
    localStorage.setItem('odoo_testCustomArgs', testCustomArgs);
    localStorage.setItem('odoo_testUseCustomCommand', testUseCustomCommand.toString());
    localStorage.setItem('odoo_testCustomCommand', testCustomCommand);
  }, [
    runPort, runDbName, runInterface, runAddons, runInstallModules, runUpdateModules, runDevAll, runWithDemo, runStopAfterInit, runCustomArgs,
    runUseCustomCommand, runCustomCommand,
    upDbName, upUpgradePaths, upAddons, upUpdateModules, upRestoreTemplate, upTemplateDb, upStopAfterInit, upCustomArgs,
    upUseCustomCommand, upCustomCommand,
    testAddons, testDbName, testModules, testUpdateModules, testTags, testPort, testStopAfterInit, testCustomArgs,
    testUseCustomCommand, testCustomCommand
  ]);

  // Fetch all modules for suggestions from all active repositories
  useEffect(() => {
    if (repos.length === 0) {
      setAllModules([]);
      return;
    }

    Promise.all(
      repos.map((repo) =>
        window.git.getOdooModules(repo.path).catch((err) => {
          console.error(`Failed to get modules for ${repo.path}:`, err);
          return [] as string[];
        })
      )
    ).then((allResults) => {
      const uniqueModules = Array.from(new Set(allResults.flat())).sort();
      setAllModules(uniqueModules);
    });
  }, [repos]);

  // Initial loads
  useEffect(() => {
    const init = async () => {
      const creds = await loadSettings();
      if (creds && creds.savedPassword) {
        await refreshDbList(creds.savedUser, creds.savedHost, creds.savedPassword, false);
      } else {
        setIsDbConnected(false);
      }
      await checkServerStatus();
    };
    init();
  }, []);

  // A local ref to accumulate log chunks as they come from IPC
  const logBufferRef = useRef<string[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle server logs and status changes from IPC
  useEffect(() => {
    const unsubLog = window.odoo.onLog((text) => {
      const cleanText = stripAnsi(text);
      logBufferRef.current.push(cleanText);

      // Schedule a flush at 16fps (every 60ms) to ensure smooth rendering and low CPU load
      if (!flushTimerRef.current) {
        flushTimerRef.current = setTimeout(() => {
          const newChunks = logBufferRef.current;
          logBufferRef.current = [];
          flushTimerRef.current = null;

          setLogs((prev) => {
            let next = [...prev, ...newChunks];
            if (next.length > 1000) {
              next = next.slice(next.length - 1000);
            }
            return next;
          });
        }, 60);
      }
    });

    const unsubState = window.odoo.onStateChange((state) => {
      setServerStatus(state.status);
      if (state.cmd) setRunningCmd(state.cmd);
      if (state.error) {
        addToast({ type: 'error', message: `Server error: ${state.error}` });
      }
    });

    return () => {
      unsubLog();
      unsubState();
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, []);

  // Scroll to bottom when new logs come in (high performance setting)
  useEffect(() => {
    const el = logsContainerRef.current;
    if (el && shouldAutoScrollRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs]);

  const loadSettings = async () => {
    try {


      const templateList = (await window.odoo.getStoreValue('odooTemplates')) || [];
      setTemplates(templateList);

      const savedVenvs = (await window.odoo.getStoreValue('odooVenvs')) || [];
      setVenvs(savedVenvs);

      const curVenv = (await window.odoo.getStoreValue('selectedVenv')) || '';
      setSelectedVenv(curVenv);

      const savedUser = (await window.odoo.getStoreValue('dbUser')) || 'odoo';
      const savedHost = (await window.odoo.getStoreValue('dbHost')) || '127.0.0.1';
      const savedPassword = (await window.odoo.getStoreValue('dbPassword')) || '';
      setDbUser(savedUser);
      setDbHost(savedHost);
      setDbPassword(savedPassword);
      return { savedUser, savedHost, savedPassword };
    } catch {
      return null;
    }
  };

  const refreshDbList = async (user?: string, host?: string, pass?: string, isManual?: boolean) => {
    setLoadingDbs(true);
    const targetUser = user !== undefined ? user : dbUser;
    const targetHost = host !== undefined ? host : dbHost;
    const targetPass = pass !== undefined ? pass : dbPassword;
    try {
      const list = await window.odoo.listDbs(targetUser, targetHost, targetPass);
      setDbs(list);
      setIsDbConnected(true);
    } catch (err: any) {
      setIsDbConnected(false);
      if (isManual) {
        addToast({ type: 'error', message: err.message || 'Failed to connect to PostgreSQL.' });
      }
    } finally {
      setLoadingDbs(false);
    }
  };

  const checkServerStatus = async () => {
    try {
      const res = await window.odoo.getServerStatus();
      setServerStatus(res.status);
      if (res.cmd) setRunningCmd(res.cmd);
    } catch {}
  };




  // Template toggle
  const handleToggleTemplate = async (dbName: string) => {
    try {
      let updated: string[];
      if (templates.includes(dbName)) {
        updated = templates.filter((t) => t !== dbName);
      } else {
        updated = [...templates, dbName];
      }
      await window.odoo.setStoreValue('odooTemplates', updated);
      setTemplates(updated);
      addToast({
        type: 'success',
        message: templates.includes(dbName)
          ? `Removed ${dbName} from templates.`
          : `Marked ${dbName} as a template database.`,
      });
    } catch {
      addToast({ type: 'error', message: 'Failed to update templates.' });
    }
  };

  // DB Creation / Duplication / Dropping
  const handleCreateDb = async () => {
    if (!createDbName.trim()) return;
    try {
      await window.odoo.createDb(createDbName.trim(), createTemplateSource || undefined, dbUser, dbHost, dbPassword);
      addToast({ type: 'success', message: `Database ${createDbName} created successfully.` });
      setCreateDbName('');
      setCreateTemplateSource('');
      setShowCreateModal(false);
      refreshDbList(dbUser, dbHost, dbPassword, false);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to create database.' });
    }
  };

  const handleDuplicateDb = async () => {
    if (!dupDestDb.trim()) return;
    try {
      await window.odoo.duplicateDb(dupSrcDb, dupDestDb.trim(), dbUser, dbHost, dbPassword);
      addToast({ type: 'success', message: `Database cloned successfully into ${dupDestDb}.` });
      setDupDestDb('');
      setShowDuplicateModal(false);
      refreshDbList(dbUser, dbHost, dbPassword, false);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to duplicate database.' });
    }
  };

  const triggerDuplicate = (db: string) => {
    setDupSrcDb(db);
    setDupDestDb(`${db}_copy`);
    setShowDuplicateModal(true);
  };

  const handleDropDb = (dbName: string) => {
    setDropTargetDb(dbName);
    setShowDropConfirmModal(true);
  };

  const confirmDropDb = async () => {
    setShowDropConfirmModal(false);
    try {
      await window.odoo.dropDb(dropTargetDb, dbUser, dbHost, dbPassword);
      addToast({ type: 'success', message: `Database ${dropTargetDb} dropped.` });
      if (runDbName === dropTargetDb) {
        setRunDbName('');
        localStorage.removeItem('odoo_runDbName');
      }
      if (upDbName === dropTargetDb) {
        setUpDbName('');
        localStorage.removeItem('odoo_upDbName');
      }
      if (testDbName === dropTargetDb) {
        setTestDbName('');
        localStorage.removeItem('odoo_testDbName');
      }
      refreshDbList(dbUser, dbHost, dbPassword, false);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to drop database.' });
    }
    setDropTargetDb('');
  };

  // Venv Handlers
  const handleAddVenv = async () => {
    if (!newVenvPath.trim()) return;
    try {
      const updated = [...venvs.filter((v) => v !== newVenvPath), newVenvPath];
      await window.odoo.setStoreValue('odooVenvs', updated);
      setVenvs(updated);
      setSelectedVenv(newVenvPath);
      await window.odoo.setStoreValue('selectedVenv', newVenvPath);
      setNewVenvPath('');
      addToast({ type: 'success', message: 'Venv path added.' });
    } catch {
      addToast({ type: 'error', message: 'Failed to add venv.' });
    }
  };

  const handleSelectVenv = async (path: string) => {
    setSelectedVenv(path);
    await window.odoo.setStoreValue('selectedVenv', path);
  };

  const handleRemoveVenv = async (pathToRemove: string) => {
    try {
      const updated = venvs.filter((v) => v !== pathToRemove);
      await window.odoo.setStoreValue('odooVenvs', updated);
      setVenvs(updated);
      if (selectedVenv === pathToRemove) {
        setSelectedVenv('');
        await window.odoo.setStoreValue('selectedVenv', '');
      }
      addToast({ type: 'success', message: 'Venv path removed.' });
    } catch {
      addToast({ type: 'error', message: 'Failed to remove venv.' });
    }
  };



  const handleSendStdin = async (e: React.FormEvent) => {
    e.preventDefault();

    const enteredText = stdinInput;
    setLogs((prev) => [...prev, `> ${enteredText}\n`]);
    setStdinInput('');

    if (enteredText.trim()) {
      setCommandHistory((prev) => {
        if (prev.length > 0 && prev[prev.length - 1] === enteredText) {
          setHistoryIndex(prev.length);
          return prev;
        }
        const nextHistory = [...prev, enteredText];
        setHistoryIndex(nextHistory.length);
        return nextHistory;
      });
    } else {
      setHistoryIndex(commandHistory.length);
    }

    try {
      await window.odoo.writeStdin(enteredText + '\n');
    } catch (err: any) {
      addToast({ type: 'error', message: `Failed to send input: ${err.message}` });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;

      let nextIndex = historyIndex;
      if (historyIndex === commandHistory.length || historyIndex === -1) {
        setTempInput(stdinInput);
        nextIndex = commandHistory.length - 1;
      } else if (historyIndex > 0) {
        nextIndex = historyIndex - 1;
      } else {
        return;
      }

      setHistoryIndex(nextIndex);
      setStdinInput(commandHistory[nextIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1 || historyIndex === commandHistory.length) return;

      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);

      if (nextIndex === commandHistory.length) {
        setStdinInput(tempInput);
      } else {
        setStdinInput(commandHistory[nextIndex]);
      }
    }
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftWidth;
    const containerWidth = splitContainerRef.current?.getBoundingClientRect().width || 1;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / containerWidth) * 100;
      const newWidth = Math.min(Math.max(startWidth + deltaPercent, 30), 70);
      setLeftWidth(newWidth);
      localStorage.setItem('odoo_leftWidth', newWidth.toString());
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [leftWidth]);

  // Run Server Execution Trigger
  const handleStartServer = async () => {
    if (!communityRepoPath) return;

    let targetDb = '';
    if (activeTab === 'run') {
      targetDb = runDbName;
    } else if (activeTab === 'upgrade') {
      targetDb = upDbName;
    } else if (activeTab === 'test') {
      targetDb = testDbName;
    }

    // Handle template restoration prior to running upgrade
    if (activeTab === 'upgrade' && upRestoreTemplate && upTemplateDb && targetDb) {
      try {
        setLogs([`[App] Re-creating database "${targetDb}" from template "${upTemplateDb}"...\n`]);
        setServerStatus('starting');
        try {
          await window.odoo.dropDb(targetDb, dbUser, dbHost, dbPassword);
        } catch {} // ignore error if database doesn't exist
        await window.odoo.createDb(targetDb, upTemplateDb, dbUser, dbHost, dbPassword);
        setLogs((prev) => [...prev, `[App] Database duplication finished. Launching upgrade run...\n\n`]);
      } catch (err: any) {
        addToast({ type: 'error', message: `Template restoration failed: ${err.message}` });
        setServerStatus('stopped');
        return;
      }
    }

    try {
      setLogs([]);
      let opts: any = {
        repoPath: communityRepoPath,
        venvPath: selectedVenv || undefined,
        commandType: activeTab,
        dbUser: dbUser,
        dbHost: dbHost,
        dbPassword: dbPassword,
        odooVersion: odooVersion,
      };

      if (activeTab === 'run') {
        opts = {
          ...opts,
          port: runPort,
          interface: runInterface,
          addonsPath: runAddons,
          dbName: targetDb || undefined,
          initModules: runInstallModules.length > 0 ? runInstallModules.join(',') : undefined,
          updateModules: runUpdateModules.length > 0 ? runUpdateModules.join(',') : undefined,
          devAll: runDevAll,
          withDemo: runWithDemo,
          stopAfterInit: runStopAfterInit,
          customArgs: runCustomArgs,
          useCustomCommand: runUseCustomCommand,
          customCommand: runCustomCommand || undefined,
        };
      } else if (activeTab === 'upgrade') {
        opts = {
          ...opts,
          dbName: targetDb || undefined,
          addonsPath: upAddons,
          upgradePaths: upUpgradePaths,
          updateModules: upUpdateModules.length > 0 ? upUpdateModules.join(',') : undefined,
          stopAfterInit: upStopAfterInit,
          customArgs: upCustomArgs,
          useCustomCommand: upUseCustomCommand,
          customCommand: upCustomCommand || undefined,
        };
      } else if (activeTab === 'test') {
        opts = {
          ...opts,
          dbName: targetDb || undefined,
          addonsPath: testAddons,
          initModules: testModules.length > 0 ? testModules.join(',') : undefined,
          testTags: testTags || undefined,
          port: testPort,
          stopAfterInit: testStopAfterInit,
          customArgs: testCustomArgs,
          useCustomCommand: testUseCustomCommand,
          customCommand: testCustomCommand || undefined,
        };
      }

      await window.odoo.startServer(opts);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to start Odoo server.' });
    }
  };

  const handleStopServer = async () => {
    try {
      await window.odoo.stopServer();
    } catch {}
  };

  const handleOpenExternalTerminal = async () => {
    if (!communityRepoPath) return;

    if (serverStatus !== 'stopped') {
      await handleStopServer();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    let targetDb = '';
    if (activeTab === 'run') {
      targetDb = runDbName;
    } else if (activeTab === 'upgrade') {
      targetDb = upDbName;
    } else if (activeTab === 'test') {
      targetDb = testDbName;
    }

    let opts: any = {
      repoPath: communityRepoPath,
      venvPath: selectedVenv || undefined,
      commandType: activeTab,
      dbUser: dbUser,
      dbHost: dbHost,
      dbPassword: dbPassword,
      odooVersion: odooVersion,
    };

    if (activeTab === 'run') {
      opts = {
        ...opts,
        port: runPort,
        interface: runInterface,
        addonsPath: runAddons,
        dbName: targetDb || undefined,
        initModules: runInstallModules.length > 0 ? runInstallModules.join(',') : undefined,
        updateModules: runUpdateModules.length > 0 ? runUpdateModules.join(',') : undefined,
        devAll: runDevAll,
        withDemo: runWithDemo,
        stopAfterInit: runStopAfterInit,
        customArgs: runCustomArgs,
        useCustomCommand: runUseCustomCommand,
        customCommand: runCustomCommand || undefined,
      };
    } else if (activeTab === 'upgrade') {
      opts = {
        ...opts,
        dbName: targetDb || undefined,
        addonsPath: upAddons,
        upgradePaths: upUpgradePaths,
        updateModules: upUpdateModules.length > 0 ? upUpdateModules.join(',') : undefined,
        stopAfterInit: upStopAfterInit,
        customArgs: upCustomArgs,
        useCustomCommand: upUseCustomCommand,
        customCommand: upCustomCommand || undefined,
      };
    } else if (activeTab === 'test') {
      opts = {
        ...opts,
        dbName: targetDb || undefined,
        addonsPath: testAddons,
        initModules: testModules.length > 0 ? testModules.join(',') : undefined,
        testTags: testTags || undefined,
        port: testPort,
        stopAfterInit: testStopAfterInit,
        customArgs: testCustomArgs,
        useCustomCommand: testUseCustomCommand,
        customCommand: testCustomCommand || undefined,
      };
    }

    try {
      const res = await window.odoo.openExternalTerminal(opts);
      if (res.success) {
        addToast({ type: 'success', message: 'Opened Ubuntu terminal outside the app.' });
      } else {
        addToast({ type: 'error', message: res.error || 'Failed to open Ubuntu terminal.' });
      }
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to open Ubuntu terminal.' });
    }
  };



  const venvOptions = [
    { value: '', label: 'System Default Python' },
    ...venvs.map((v) => ({ value: v, label: v })),
  ];

  const templateOptions = [
    { value: '', label: '-- Choose Template --' },
    ...templates.map((t) => ({ value: t, label: t })),
  ];

  const createTemplateOptions = [
    { value: '', label: '-- Fresh Empty DB --' },
    ...dbs.map((db) => ({ value: db, label: db })),
  ];

  return (
    <div className="flex flex-col h-full bg-bg select-none">
      {/* Header Panel */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0 bg-surface/30">
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-semibold text-primary tracking-wide">Odoo & PostgreSQL Integration</h2>
          <div className="flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            Branch: {currentBranch}
          </div>
        </div>

        {/* Server Control / Status in Header */}
        <div className="flex items-center gap-4 tour-odoo-run-btn">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted font-bold uppercase tracking-wider">Status:</span>
            <div className="flex items-center gap-1.5 bg-surface border border-border/60 rounded px-2.5 py-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  serverStatus === 'running'
                    ? 'bg-success animate-pulse'
                    : serverStatus === 'starting'
                    ? 'bg-warning animate-pulse'
                    : 'bg-muted'
                }`}
              />
              <span className="text-[11px] font-mono text-primary font-bold uppercase tracking-wide">
                {serverStatus === 'running' ? 'Running' : serverStatus === 'starting' ? 'Starting...' : 'Stopped'}
              </span>
            </div>
          </div>

          {serverStatus !== 'stopped' ? (
            <button
              className="px-4 py-1.5 rounded text-[11px] bg-danger border border-danger hover:bg-danger/80 text-white font-bold transition-all shadow active:scale-95"
              onClick={handleStopServer}
            >
              STOP SERVER
            </button>
          ) : (
            <button
              className="px-4 py-1.5 rounded text-[11px] bg-success border border-success hover:bg-success/80 text-white font-bold transition-all shadow active:scale-95"
              onClick={handleStartServer}
            >
              START ODOO
            </button>
          )}
        </div>
      </div>

      {/* Main Split Section */}
      <div ref={splitContainerRef} className="flex flex-1 overflow-hidden">
        <div
          style={{ width: isTerminalMaximized ? '100%' : `${leftWidth}%` }}
          className="flex flex-col border-r border-border h-full bg-surface/10 overflow-hidden shrink-0"
        >
          {/* Command Preview bar */}
          <div className="px-4 py-3 border-b border-border bg-surface/20 shrink-0">
            <div className="space-y-1.5">
              <div className="text-[10px] text-muted font-bold uppercase tracking-wider">
                {serverStatus !== 'stopped' ? 'Running Command' : 'Command Preview'}
              </div>
              <div className="text-[10px] font-mono text-primary/80 whitespace-pre-wrap break-all border border-border/40 p-2 rounded bg-bg/50 select-all hover:text-primary transition-colors" title={serverStatus !== 'stopped' ? runningCmd : previewCmd}>
                {serverStatus !== 'stopped' ? runningCmd : previewCmd}
              </div>
            </div>
          </div>

          {/* Live Terminal Output Console */}
          <div className="flex-1 flex flex-col bg-slate-950 font-mono text-[11px] text-slate-200 overflow-hidden">
            <div className="px-3 py-2 bg-slate-900 border-b border-border/40 flex items-center justify-between shrink-0">
              <span className="text-slate-400 font-bold uppercase text-[9px]">Server Logs Terminal</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsTerminalMaximized(!isTerminalMaximized)}
                  className="text-slate-400 hover:text-white text-[9px] transition-colors flex items-center gap-1 border border-slate-700/60 rounded px-1.5 py-0.5 bg-slate-800/40 hover:bg-slate-800"
                  title={isTerminalMaximized ? "Exit full screen" : "Maximize terminal"}
                >
                  {isTerminalMaximized ? (
                    <>
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3 3m12 6V4.5M15 9h4.5M15 9l6-6m-6 15v4.5M15 15h4.5M15 15l6 6m-6-6v4.5M9 15H4.5M9 15l-6 6"></path>
                      </svg>
                      <span>Exit Full Screen</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 9m5.25 11.25v-4.5m0 4.5h-4.5m4.5 0L15 15"></path>
                      </svg>
                      <span>Full Screen</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleOpenExternalTerminal}
                  className="text-slate-400 hover:text-white text-[9px] transition-colors flex items-center gap-1 border border-slate-700/60 rounded px-1.5 py-0.5 bg-slate-800/40 hover:bg-slate-800"
                  title="Open command in external Ubuntu terminal"
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                  <span>Open in terminal</span>
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(logs.join(''));
                    addToast({ type: 'info', message: 'Logs copied to clipboard.' });
                  }}
                  className="text-slate-400 hover:text-white text-[9px] transition-colors"
                >
                  Copy
                </button>
                <button
                  onClick={() => setLogs([])}
                  className="text-slate-400 hover:text-white text-[9px] transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
            <div
              ref={logsContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-auto p-2.5 selection:bg-slate-700 select-text leading-tight whitespace-pre-wrap"
            >
              {processedLines.length === 0 ? (
                <div className="text-slate-500 italic py-4 text-center">No terminal logs recorded yet. Start server to stream output.</div>
              ) : (
                processedLines.map((line, idx) => <TerminalLine key={idx} line={line} />)
              )}
              <div ref={terminalEndRef} />
            </div>

            {/* Stdin Input Bar */}
            {serverStatus === 'running' && (
              <form
                onSubmit={handleSendStdin}
                className="flex items-center gap-2 px-3 py-1.5 border-t border-border/20 bg-slate-950/80 shrink-0"
              >
                <span className="text-accent font-semibold text-[11px] select-none shrink-0">&gt;</span>
                <input
                  type="text"
                  value={stdinInput}
                  onChange={(e) => setStdinInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type input here and press Enter to send to process (e.g. for pdb breakpoint)..."
                  className="flex-1 bg-transparent border-none text-[11px] font-mono text-slate-100 focus:outline-none focus:ring-0 p-0 placeholder:text-slate-600"
                />
                <button
                  type="submit"
                  className="btn-accent w-[20px] h-[20px] p-0 flex items-center justify-center rounded shrink-0"
                  title="Send input to process (Enter)"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"></path>
                  </svg>
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Resizable Divider Handle */}
        {!isTerminalMaximized && (
          <div
            onMouseDown={handleMouseDown}
            className="w-[4px] hover:w-[6px] bg-border hover:bg-accent cursor-col-resize transition-all h-full shrink-0 relative z-10 active:bg-accent"
          />
        )}

        {/* Right Side: Virtual Environment + Server controls & Console */}
        <div
          style={{
            width: isTerminalMaximized ? '0%' : `${100 - leftWidth}%`,
            display: isTerminalMaximized ? 'none' : 'flex',
          }}
          className="flex flex-col h-full overflow-hidden bg-bg shrink-0"
        >
          {/* Virtual Environment Selector & Preset Manager */}
          <div className="p-3 border-b border-border bg-surface/20 flex flex-col gap-3 shrink-0">
            {/* Presets section — comes first */}
            <div className="flex flex-col gap-1.5 tour-odoo-preset">
              <span className="font-semibold text-muted text-[10px] uppercase tracking-wider flex items-center gap-1.5 select-none">
                Configuration Preset
                <span className="group relative inline-flex items-center">
                  <svg className="w-3.5 h-3.5 text-slate-500 hover:text-white transition-colors cursor-help" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" strokeLinecap="round" />
                    <line x1="12" y1="8" x2="12.01" y2="8" strokeLinecap="round" strokeWidth="2.5" />
                  </svg>
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-56 bg-[#161B22] border border-border text-[10px] text-muted p-2 rounded shadow-2xl leading-normal normal-case font-normal z-50">
                    Save all configuration parameters (database, port, venv, flags) under a custom name to switch projects quickly.
                  </span>
                </span>
              </span>
              <div className="flex items-center gap-2 h-[36px]">
                <Dropdown
                  options={filteredPresets.map((p) => ({ value: p.name, label: p.name }))}
                  value={selectedPresetName}
                  onChange={handleApplyPreset}
                  placeholder="Select Preset..."
                  className="flex-1"
                  disabled={isCheckingOut}
                />
                {selectedPresetName && (
                  <>
                    <button
                      onClick={handleUpdateCurrentPreset}
                      disabled={isCheckingOut}
                      className={`w-[36px] shrink-0 h-full flex items-center justify-center bg-success/15 border border-success/30 hover:bg-success/25 text-success rounded transition-colors ${
                        isCheckingOut ? 'opacity-40 cursor-not-allowed' : ''
                      }`}
                      title="Save — update preset with current config"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeletePreset(selectedPresetName)}
                      disabled={isCheckingOut}
                      className={`w-[36px] shrink-0 h-full flex items-center justify-center bg-danger/15 border border-danger/30 hover:bg-danger/25 text-danger rounded transition-colors ${
                        isCheckingOut ? 'opacity-40 cursor-not-allowed' : ''
                      }`}
                      title="Delete preset"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowSavePresetModal(true)}
                  disabled={isCheckingOut}
                  className={`w-[36px] shrink-0 h-full flex items-center justify-center bg-accent/15 border border-accent/30 hover:bg-accent/25 text-accent rounded transition-colors ${
                    isCheckingOut ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                  title="New preset — save current config as new preset"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Venv Row — below preset */}
            <div className={`flex flex-col gap-1.5 border-t border-border/40 pt-2.5 ${isCustomCommandActive ? 'opacity-50 pointer-events-none' : ''}`}>
              <span className="font-semibold text-muted text-[10px] uppercase tracking-wider flex items-center gap-1.5 select-none">
                Python Virtual Environment (venv)
                <span className="group relative inline-flex items-center">
                  <svg className="w-3.5 h-3.5 text-slate-500 hover:text-white transition-colors cursor-help" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" strokeLinecap="round" />
                    <line x1="12" y1="8" x2="12.01" y2="8" strokeLinecap="round" strokeWidth="2.5" />
                  </svg>
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-56 bg-[#161B22] border border-border text-[10px] text-muted p-2 rounded shadow-2xl leading-normal normal-case font-normal z-50">
                    Selects the Python virtual environment containing the dependencies needed for this Odoo version.
                  </span>
                </span>
              </span>
              <div className="flex items-stretch gap-2 w-full h-[36px]">
                <div className="flex items-stretch gap-1.5 flex-[1.2] min-w-[200px]">
                  <Dropdown
                    options={venvOptions}
                    value={selectedVenv}
                    onChange={handleSelectVenv}
                    searchable={true}
                    placeholder="System Default Python"
                    className="flex-1"
                    disabled={isCustomCommandActive}
                  />
                  {selectedVenv && !isCustomCommandActive && (
                    <button
                      onClick={() => handleRemoveVenv(selectedVenv)}
                      className="w-[36px] shrink-0 h-full flex items-center justify-center text-danger bg-danger/10 border border-danger/20 hover:bg-danger/25 rounded transition-colors"
                      title="Remove selected venv from list"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="flex items-stretch gap-1.5 flex-[2] min-w-[280px]">
                  <input
                    type="text"
                    disabled={isCustomCommandActive}
                    placeholder="Paste absolute path to venv folder (e.g. /home/user/venv/)"
                    value={newVenvPath}
                    onChange={(e) => setNewVenvPath(e.target.value)}
                    className="bg-bg text-[11px] px-2 border border-border rounded outline-none focus:border-accent flex-1 text-primary min-w-0 h-full disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    onClick={handleAddVenv}
                    disabled={isCustomCommandActive}
                    className="w-[36px] shrink-0 h-full flex items-center justify-center bg-accent border border-accent hover:bg-accent/80 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Add venv path"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Configuration Form Tab Links */}
          <div className="flex border-b border-border bg-surface/10 shrink-0">
            <button
              onClick={() => setActiveTab('run')}
              className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-all ${
                activeTab === 'run' ? 'text-accent border-accent bg-accent/5' : 'text-muted border-transparent hover:text-primary'
              }`}
            >
              Run Server
            </button>
            <button
              onClick={() => setActiveTab('upgrade')}
              className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-all ${
                activeTab === 'upgrade' ? 'text-accent border-accent bg-accent/5' : 'text-muted border-transparent hover:text-primary'
              }`}
            >
              Upgrade DB
            </button>
            <button
              onClick={() => setActiveTab('test')}
              className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-all ${
                activeTab === 'test' ? 'text-accent border-accent bg-accent/5' : 'text-muted border-transparent hover:text-primary'
              }`}
            >
              Run Tests
            </button>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-surface/5">
            {activeTab === 'run' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="tour-odoo-db-field">
                    <label className="block text-[10px] text-muted font-bold uppercase mb-1">Target DB</label>
                    <DbDropdown
                      value={runDbName}
                      onChange={setRunDbName}
                      dbs={dbs}
                      templates={templates}
                      loadingDbs={loadingDbs}
                      onToggleTemplate={handleToggleTemplate}
                      onDuplicate={triggerDuplicate}
                      onDrop={handleDropDb}
                      onRefresh={() => refreshDbList(dbUser, dbHost, dbPassword, true)}
                      onCreateNew={() => {
                        setCreateTemplateSource('');
                        setShowCreateModal(true);
                      }}
                      disabled={runUseCustomCommand}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted font-bold uppercase mb-1">HTTP Port</label>
                    <input
                      type="number"
                      disabled={runUseCustomCommand}
                      value={runPort}
                      onChange={(e) => setRunPort(parseInt(e.target.value) || 8069)}
                      className="w-full bg-[#0D1117]/60 text-[12px] py-1.5 px-3 border border-border rounded outline-none text-primary min-h-[36px] focus:border-accent/70 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-muted font-bold uppercase mb-1">HTTP Interface</label>
                    <input
                      type="text"
                      disabled={runUseCustomCommand}
                      value={runInterface}
                      onChange={(e) => setRunInterface(e.target.value)}
                      className="w-full bg-[#0D1117]/60 text-[12px] py-1.5 px-3 border border-border rounded outline-none text-primary min-h-[36px] focus:border-accent/70 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                  <AddonsPathInput
                    label="Addons Path"
                    value={runAddons}
                    onChange={setRunAddons}
                    disabled={runUseCustomCommand}
                  />
                </div>

                <AddonPathRowsList
                  value={runAddons}
                  onChange={setRunAddons}
                  disabled={runUseCustomCommand}
                  communityRepoPath={communityRepoPath}
                />

                <div className="grid grid-cols-2 gap-3">
                  <ModuleSelector
                    label="Install Module (-i)"
                    modules={runInstallModules}
                    onChange={setRunInstallModules}
                    allModules={allModules}
                    placeholder="e.g. sale, purchase"
                    disabled={runUseCustomCommand}
                  />
                  <ModuleSelector
                    label="Update Module (-u)"
                    modules={runUpdateModules}
                    onChange={setRunUpdateModules}
                    allModules={allModules}
                    placeholder="e.g. sale, purchase"
                    disabled={runUseCustomCommand}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 py-1.5">
                  <label className={`flex items-center gap-1.5 text-[11px] text-primary cursor-pointer select-none ${runUseCustomCommand ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}>
                    <input
                      type="checkbox"
                      disabled={runUseCustomCommand}
                      checked={runDevAll}
                      onChange={(e) => setRunDevAll(e.target.checked)}
                      className="rounded border-border text-accent cursor-pointer focus:ring-accent bg-bg disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    --dev=all
                  </label>
                  <label className={`flex items-center gap-1.5 text-[11px] text-primary cursor-pointer select-none ${runUseCustomCommand ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`} title="Loads demo data in Odoo 19+. Disables demo load on older versions when unchecked.">
                    <input
                      type="checkbox"
                      disabled={runUseCustomCommand}
                      checked={runWithDemo}
                      onChange={(e) => setRunWithDemo(e.target.checked)}
                      className="rounded border-border text-accent cursor-pointer focus:ring-accent bg-bg disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    With Demo Data
                  </label>
                  <label className={`flex items-center gap-1.5 text-[11px] text-primary cursor-pointer select-none ${runUseCustomCommand ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}>
                    <input
                      type="checkbox"
                      disabled={runUseCustomCommand}
                      checked={runStopAfterInit}
                      onChange={(e) => setRunStopAfterInit(e.target.checked)}
                      className="rounded border-border text-accent cursor-pointer focus:ring-accent bg-bg disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    Stop after init
                  </label>
                </div>

                <div>
                  <label className="block text-[10px] text-muted font-bold uppercase mb-1">Custom Raw Arguments</label>
                  <input
                    type="text"
                    disabled={runUseCustomCommand}
                    placeholder="e.g. --log-level=debug --workers=0"
                    value={runCustomArgs}
                    onChange={(e) => setRunCustomArgs(e.target.value)}
                    className="w-full bg-bg text-[12px] py-1 px-2 border border-border rounded outline-none font-mono text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Custom Command Override Section */}
                <div className="border-t border-border/40 pt-3 mt-1 space-y-2">
                  <label className="flex items-center gap-2 text-[11px] font-semibold text-accent cursor-pointer select-none w-full bg-accent/5 hover:bg-accent/10 border border-accent/20 rounded-md p-2.5 transition-all duration-150 shadow-sm">
                    <input
                      type="checkbox"
                      checked={runUseCustomCommand}
                      onChange={(e) => setRunUseCustomCommand(e.target.checked)}
                      className="rounded border-border text-accent cursor-pointer focus:ring-accent bg-bg"
                    />
                    Use Custom Command
                  </label>
                  {runUseCustomCommand && (
                    <div>
                      <label className="block text-[10px] text-accent font-bold uppercase mb-1">Custom Command String</label>
                      <input
                        type="text"
                        placeholder="e.g. /home/odoo/venv/bin/python ./odoo-bin -d master-db"
                        value={runCustomCommand}
                        onChange={(e) => setRunCustomCommand(e.target.value)}
                        className="w-full bg-bg text-[12px] py-1.5 px-3 border border-accent/40 focus:border-accent rounded outline-none font-mono text-primary"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'upgrade' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-muted font-bold uppercase mb-1">Target DB</label>
                    <DbDropdown
                      value={upDbName}
                      onChange={setUpDbName}
                      dbs={dbs}
                      templates={templates}
                      loadingDbs={loadingDbs}
                      onToggleTemplate={handleToggleTemplate}
                      onDuplicate={triggerDuplicate}
                      onDrop={handleDropDb}
                      onRefresh={() => refreshDbList(dbUser, dbHost, dbPassword, true)}
                      onCreateNew={() => {
                        setCreateTemplateSource('');
                        setShowCreateModal(true);
                      }}
                      disabled={upUseCustomCommand}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted font-bold uppercase mb-1">Upgrade Paths</label>
                    <input
                      type="text"
                      disabled={upUseCustomCommand}
                      value={upUpgradePaths}
                      onChange={(e) => setUpUpgradePaths(e.target.value)}
                      className="w-full bg-bg text-[12px] py-1 px-2 border border-border rounded outline-none font-mono text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <AddonsPathInput
                  label="Addons Path"
                  value={upAddons}
                  onChange={setUpAddons}
                  disabled={upUseCustomCommand}
                />

                <AddonPathRowsList
                  value={upCombinedPaths}
                  onChange={handleUpCombinedChange}
                  disabled={upUseCustomCommand}
                  communityRepoPath={communityRepoPath}
                />

                <ModuleSelector
                  label="Update Module (-u)"
                  modules={upUpdateModules}
                  onChange={setUpUpdateModules}
                  allModules={allModules}
                  placeholder="e.g. sale, purchase (leave empty to upgrade all)"
                  disabled={upUseCustomCommand}
                />

                <div className={`border border-warning/20 bg-warning/5 rounded p-3 space-y-2.5 ${upUseCustomCommand ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-warning cursor-pointer select-none">
                    <input
                      type="checkbox"
                      disabled={upUseCustomCommand}
                      checked={upRestoreTemplate}
                      onChange={(e) => setUpRestoreTemplate(e.target.checked)}
                      className="rounded border-border text-warning cursor-pointer focus:ring-warning bg-bg disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span>Restore DB from template before upgrade</span>
                    <span
                      className="group relative inline-flex items-center ml-1"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      <svg className="w-3.5 h-3.5 text-warning/75 hover:text-white transition-colors cursor-help" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" strokeLinecap="round" />
                        <line x1="12" y1="8" x2="12.01" y2="8" strokeLinecap="round" strokeWidth="2.5" />
                      </svg>
                      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 bg-[#161B22] border border-border text-[10px] text-muted p-2.5 rounded shadow-2xl leading-relaxed normal-case font-normal z-50">
                        Automatically drops your target DB and creates a fresh copy from the selected template before executing the upgrade. Perfect for running migrations/upgrades repeatedly on clean data.
                      </span>
                    </span>
                  </label>
                  {upRestoreTemplate && (
                    <div>
                      <label className="block text-[10px] text-warning/80 font-bold uppercase mb-1">Select Template Source</label>
                      <Dropdown
                        options={templateOptions}
                        value={upTemplateDb}
                        onChange={setUpTemplateDb}
                        searchable={true}
                        placeholder="-- Choose Template --"
                        disabled={upUseCustomCommand}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 py-1">
                  <label className={`flex items-center gap-1.5 text-[11px] text-primary cursor-pointer select-none ${upUseCustomCommand ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}>
                    <input
                      type="checkbox"
                      disabled={upUseCustomCommand}
                      checked={upStopAfterInit}
                      onChange={(e) => setUpStopAfterInit(e.target.checked)}
                      className="rounded border-border text-accent cursor-pointer focus:ring-accent bg-bg disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    --stop-after-init
                  </label>
                </div>

                <div>
                  <label className="block text-[10px] text-muted font-bold uppercase mb-1">Custom Raw Arguments</label>
                  <input
                    type="text"
                    disabled={upUseCustomCommand}
                    placeholder="e.g. --log-level=info"
                    value={upCustomArgs}
                    onChange={(e) => setUpCustomArgs(e.target.value)}
                    className="w-full bg-bg text-[12px] py-1 px-2 border border-border rounded outline-none font-mono text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Custom Command Override Section */}
                <div className="border-t border-border/40 pt-3 mt-1 space-y-2">
                  <label className="flex items-center gap-2 text-[11px] font-semibold text-accent cursor-pointer select-none w-full bg-accent/5 hover:bg-accent/10 border border-accent/20 rounded-md p-2.5 transition-all duration-150 shadow-sm">
                    <input
                      type="checkbox"
                      checked={upUseCustomCommand}
                      onChange={(e) => setUpUseCustomCommand(e.target.checked)}
                      className="rounded border-border text-accent cursor-pointer focus:ring-accent bg-bg"
                    />
                    Use Custom Command
                  </label>
                  {upUseCustomCommand && (
                    <div>
                      <label className="block text-[10px] text-accent font-bold uppercase mb-1">Custom Command String</label>
                      <input
                        type="text"
                        placeholder="e.g. /home/odoo/venv/bin/python ./odoo-bin -d master-db"
                        value={upCustomCommand}
                        onChange={(e) => setUpCustomCommand(e.target.value)}
                        className="w-full bg-bg text-[12px] py-1.5 px-3 border border-accent/40 focus:border-accent rounded outline-none font-mono text-primary"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'test' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-muted font-bold uppercase mb-1">Target DB</label>
                    <DbDropdown
                      value={testDbName}
                      onChange={setTestDbName}
                      dbs={dbs}
                      templates={templates}
                      loadingDbs={loadingDbs}
                      onToggleTemplate={handleToggleTemplate}
                      onDuplicate={triggerDuplicate}
                      onDrop={handleDropDb}
                      onRefresh={() => refreshDbList(dbUser, dbHost, dbPassword, true)}
                      onCreateNew={() => {
                        setCreateTemplateSource('');
                        setShowCreateModal(true);
                      }}
                      disabled={testUseCustomCommand}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted font-bold uppercase mb-1">HTTP Port (0 = Auto)</label>
                    <input
                      type="number"
                      disabled={testUseCustomCommand}
                      value={testPort}
                      onChange={(e) => setTestPort(parseInt(e.target.value) || 0)}
                      className="w-full bg-bg text-[12px] py-1 px-2 border border-border rounded outline-none text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <ModuleSelector
                    label="Install Module (-i)"
                    modules={testModules}
                    onChange={setTestModules}
                    allModules={allModules}
                    placeholder="e.g. account_reports"
                    disabled={testUseCustomCommand}
                  />
                  <ModuleSelector
                    label="Update Module (-u)"
                    modules={testUpdateModules}
                    onChange={setTestUpdateModules}
                    allModules={allModules}
                    placeholder="e.g. account_reports"
                    disabled={testUseCustomCommand}
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-muted font-bold uppercase mb-1">Test Tags</label>
                  <input
                    type="text"
                    disabled={testUseCustomCommand}
                    placeholder="e.g. account_reports"
                    value={testTags}
                    onChange={(e) => setTestTags(e.target.value)}
                    className="w-full bg-[#0D1117]/60 text-[12px] py-1.5 px-2 border border-border rounded outline-none text-primary min-h-[34px] focus:border-accent/70 font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <AddonsPathInput
                  label="Addons Path"
                  value={testAddons}
                  onChange={setTestAddons}
                  disabled={testUseCustomCommand}
                />

                <AddonPathRowsList
                  value={testAddons}
                  onChange={setTestAddons}
                  disabled={testUseCustomCommand}
                  communityRepoPath={communityRepoPath}
                />

                <div className="flex items-center gap-4 py-1">
                  <label className={`flex items-center gap-1.5 text-[11px] text-primary cursor-pointer select-none ${testUseCustomCommand ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}>
                    <input
                      type="checkbox"
                      disabled={testUseCustomCommand}
                      checked={testStopAfterInit}
                      onChange={(e) => setTestStopAfterInit(e.target.checked)}
                      className="rounded border-border text-accent cursor-pointer focus:ring-accent bg-bg disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    --stop-after-init
                  </label>
                </div>

                <div>
                  <label className="block text-[10px] text-muted font-bold uppercase mb-1">Custom Raw Arguments</label>
                  <input
                    type="text"
                    disabled={testUseCustomCommand}
                    placeholder="e.g. --log-level=test"
                    value={testCustomArgs}
                    onChange={(e) => setTestCustomArgs(e.target.value)}
                    className="w-full bg-bg text-[12px] py-1 px-2 border border-border rounded outline-none font-mono text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Custom Command Override Section */}
                <div className="border-t border-border/40 pt-3 mt-1 space-y-2">
                  <label className="flex items-center gap-2 text-[11px] font-semibold text-accent cursor-pointer select-none w-full bg-accent/5 hover:bg-accent/10 border border-accent/20 rounded-md p-2.5 transition-all duration-150 shadow-sm">
                    <input
                      type="checkbox"
                      checked={testUseCustomCommand}
                      onChange={(e) => setTestUseCustomCommand(e.target.checked)}
                      className="rounded border-border text-accent cursor-pointer focus:ring-accent bg-bg"
                    />
                    Use Custom Command
                  </label>
                  {testUseCustomCommand && (
                    <div>
                      <label className="block text-[10px] text-accent font-bold uppercase mb-1">Custom Command String</label>
                      <input
                        type="text"
                        placeholder="e.g. /home/odoo/venv/bin/python ./odoo-bin -d master-db"
                        value={testCustomCommand}
                        onChange={(e) => setTestCustomCommand(e.target.value)}
                        className="w-full bg-bg text-[12px] py-1.5 px-3 border border-accent/40 focus:border-accent rounded outline-none font-mono text-primary"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Creation DB Dialog Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-surface border border-border rounded-xl w-full max-w-sm p-4 space-y-4 shadow-2xl">
            <h3 className="text-[14px] font-bold text-primary">Create New PostgreSQL Database</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-muted font-bold uppercase mb-1">Database Name</label>
                <input
                  ref={createDbInputRef}
                  type="text"
                  placeholder="e.g. odoo_dev_db"
                  value={createDbName}
                  onChange={(e) => setCreateDbName(e.target.value)}
                  className="w-full bg-bg text-[12px] py-1.5 px-3 border border-border rounded-md outline-none text-primary"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] text-muted font-bold uppercase mb-1">Template Source (Optional)</label>
                <Dropdown
                  options={createTemplateOptions}
                  value={createTemplateSource}
                  onChange={setCreateTemplateSource}
                  searchable={true}
                  placeholder="-- Fresh Empty DB --"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                className="px-3 py-1.5 rounded-md hover:bg-border/60 text-[11px] font-semibold text-primary border border-border transition-colors"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 rounded-md bg-accent hover:bg-accent/80 text-[11px] font-semibold text-white transition-colors"
                onClick={handleCreateDb}
                disabled={!createDbName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate DB Dialog Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-surface border border-border rounded-xl w-full max-w-sm p-4 space-y-4 shadow-2xl">
            <h3 className="text-[14px] font-bold text-primary">Duplicate Database: {dupSrcDb}</h3>
            <div>
              <label className="block text-[10px] text-muted font-bold uppercase mb-1">New Database Name</label>
              <input
                ref={duplicateDbInputRef}
                type="text"
                placeholder="e.g. odoo_dev_db_copy"
                value={dupDestDb}
                onChange={(e) => setDupDestDb(e.target.value)}
                className="w-full bg-bg text-[12px] py-1.5 px-3 border border-border rounded-md outline-none text-primary"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                className="px-3 py-1.5 rounded-md hover:bg-border/60 text-[11px] font-semibold text-primary border border-border transition-colors"
                onClick={() => setShowDuplicateModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 rounded-md bg-accent hover:bg-accent/80 text-[11px] font-semibold text-white transition-colors"
                onClick={handleDuplicateDb}
                disabled={!dupDestDb.trim()}
              >
                Clone DB
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Preset Dialog Modal */}
      {showSavePresetModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-surface border border-border rounded-xl w-full max-w-sm p-4 space-y-4 shadow-2xl">
            <h3 className="text-[14px] font-bold text-primary">Save Configuration Preset</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-muted font-bold uppercase mb-1">Preset Name</label>
                <input
                  type="text"
                  placeholder="e.g. Odoo 17 Project Setup"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  className="w-full bg-bg text-[12px] py-1.5 px-3 border border-border rounded-md outline-none text-primary"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSavePreset();
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                className="px-3 py-1.5 rounded-md hover:bg-border/60 text-[11px] font-semibold text-primary border border-border transition-colors"
                onClick={() => {
                  setShowSavePresetModal(false);
                  setNewPresetName('');
                }}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 rounded-md bg-accent hover:bg-accent/80 text-[11px] font-semibold text-white transition-colors"
                onClick={handleSavePreset}
                disabled={!newPresetName.trim()}
              >
                Save Preset
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Drop DB Confirm Modal */}
      {showDropConfirmModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-surface border border-border rounded-xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-danger/15 border border-danger/30 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-[13px] font-bold text-primary">Drop Database</h3>
                <p className="text-[11px] text-muted mt-1">
                  Are you sure you want to permanently drop{' '}
                  <span className="text-danger font-semibold">{dropTargetDb}</span>?{' '}
                  This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                className="px-3 py-1.5 rounded-md hover:bg-border/60 text-[11px] font-semibold text-primary border border-border transition-colors"
                onClick={() => { setShowDropConfirmModal(false); setDropTargetDb(''); }}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 rounded-md bg-danger hover:bg-danger/80 text-[11px] font-semibold text-white transition-colors"
                onClick={confirmDropDb}
                autoFocus
              >
                Drop Database
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
