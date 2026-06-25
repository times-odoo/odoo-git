import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRepoStore } from '../../store/repos';
import { useGitStore } from '../../store/git';
import { useUIStore } from '../../store/ui';
import { Dropdown } from '../shared/Dropdown';

const stripAnsi = (str: string) => {
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
};

interface ModuleSelectorProps {
  label: string;
  modules: string[];
  onChange: (mods: string[]) => void;
  allModules: string[];
  placeholder?: string;
}

export function ModuleSelector({ label, modules, onChange, allModules, placeholder }: ModuleSelectorProps) {
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
    const trimmed = modName.trim();
    if (trimmed && !modules.includes(trimmed)) {
      onChange([...modules, trimmed]);
    }
    setInputValue('');
    setFocusedIndex(-1);
    setShowSuggestions(false);
  };

  const removeModule = (modName: string) => {
    onChange(modules.filter((m) => m !== modName));
  };

  return (
    <div className="relative">
      <label className="block text-[10px] text-muted font-bold uppercase mb-1">{label}</label>
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#0D1117]/60 border border-border rounded focus-within:border-accent/70 transition-colors w-full cursor-text min-h-[34px]">
        {modules.map((m) => (
          <span
            key={m}
            className="inline-flex items-center gap-1 bg-accent/15 text-accent font-semibold px-2 py-0.5 rounded text-[11px] font-mono select-none"
          >
            {m}
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
          </span>
        ))}
        <input
          type="text"
          className="bg-transparent border-none outline-none flex-1 min-w-[120px] text-primary text-[12px] font-mono p-0 h-[20px]"
          placeholder={modules.length === 0 ? placeholder : ""}
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

export function OdooPanel() {
  const repos = useRepoStore((s) => s.repos);
  const activeRepoPath = useRepoStore((s) => s.activeRepoPath);

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
  const [branchDbMap, setBranchDbMap] = useState<Record<string, string>>({});
  const [dbFilter, setDbFilter] = useState('');
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
  const [activeTab, setActiveTab] = useState<'run' | 'upgrade' | 'test'>('run');

  // Creation/Duplication Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createDbName, setCreateDbName] = useState('');
  const [createTemplateSource, setCreateTemplateSource] = useState('');

  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [dupSrcDb, setDupSrcDb] = useState('');
  const [dupDestDb, setDupDestDb] = useState('');

  // Terminal scroll helper
  const terminalEndRef = useRef<HTMLDivElement>(null);

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

  const branchKey = communityRepoPath ? `${communityRepoPath}:${currentBranch}` : '';
  const currentLinkedDb = branchDbMap[branchKey] || null;

  // Dynamically build command string for preview
  const previewCmd = useMemo(() => {
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
      targetDb = runDbName || currentLinkedDb || '';
      addons = runAddons;
      initModules = runInstallModules;
      updateModules = runUpdateModules;
      devAll = runDevAll;
      withDemo = runWithDemo;
      stopAfterInit = runStopAfterInit;
      customArgs = runCustomArgs;
      port = runPort;
    } else if (activeTab === 'upgrade') {
      targetDb = upDbName || currentLinkedDb || '';
      addons = upAddons;
      updateModules = upUpdateModules;
      stopAfterInit = upStopAfterInit;
      customArgs = upCustomArgs;
      upgradePaths = upUpgradePaths;
    } else if (activeTab === 'test') {
      targetDb = testDbName || currentLinkedDb || '';
      addons = testAddons;
      initModules = testModules;
      testTagsVal = testTags;
      stopAfterInit = testStopAfterInit;
      customArgs = testCustomArgs;
      port = testPort;
    }

    const args: string[] = [];
    if (dbUser) args.push(`--db_user=${dbUser}`);
    if (dbHost) args.push(`--db_host=${dbHost}`);
    if (dbPassword) args.push(`--db_password=${dbPassword}`);

    const resolvedAddons = addons || 'addons,../enterprise';
    args.push(`--addons-path=${resolvedAddons}`);

    if (activeTab === 'run' || activeTab === 'test') {
      args.push(`--http-port=${port}`);
    }

    if (activeTab === 'run' && devAll) {
      args.push('--dev=all');
    }

    if (activeTab === 'run') {
      if (withDemo === true) {
        args.push('--with-demo');
      } else if (withDemo === false) {
        args.push('--without-demo');
      }
    }

    if (targetDb) {
      args.push('-d');
      args.push(targetDb);
    }

    if (activeTab === 'run') {
      if (initModules.length > 0) {
        args.push('-i');
        args.push(initModules.join(','));
      }
      if (updateModules.length > 0) {
        args.push('-u');
        args.push(updateModules.join(','));
      }
    } else if (activeTab === 'upgrade') {
      const resolvedUpgradePath = upgradePaths || '../upgrade-util/src,../upgrade/migrations';
      args.push(`--upgrade-path=${resolvedUpgradePath}`);
      if (updateModules.length > 0) {
        args.push('-u');
        args.push(updateModules.join(','));
      } else {
        args.push('-u all');
      }
    } else if (activeTab === 'test') {
      args.push('--test-enable');
      if (initModules.length > 0) {
        args.push('-i');
        args.push(initModules.join(','));
      }
      if (testTagsVal) {
        args.push(`--test-tags=${testTagsVal}`);
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
    upDbName, upUpgradePaths, upAddons, upUpdateModules, upRestoreTemplate, upTemplateDb, upStopAfterInit, upCustomArgs,
    testAddons, testDbName, testModules, testTags, testPort, testStopAfterInit, testCustomArgs,
    dbUser, dbHost, dbPassword, selectedVenv, currentLinkedDb
  ]);

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

    localStorage.setItem('odoo_upDbName', upDbName);
    localStorage.setItem('odoo_upUpgradePaths', upUpgradePaths);
    localStorage.setItem('odoo_upAddons', upAddons);
    localStorage.setItem('odoo_upUpdateModules', JSON.stringify(upUpdateModules));
    localStorage.setItem('odoo_upRestoreTemplate', upRestoreTemplate.toString());
    localStorage.setItem('odoo_upTemplateDb', upTemplateDb);
    localStorage.setItem('odoo_upStopAfterInit', upStopAfterInit.toString());
    localStorage.setItem('odoo_upCustomArgs', upCustomArgs);

    localStorage.setItem('odoo_testAddons', testAddons);
    localStorage.setItem('odoo_testDbName', testDbName);
    localStorage.setItem('odoo_testModules', JSON.stringify(testModules));
    localStorage.setItem('odoo_testTags', testTags);
    localStorage.setItem('odoo_testPort', testPort.toString());
    localStorage.setItem('odoo_testStopAfterInit', testStopAfterInit.toString());
    localStorage.setItem('odoo_testCustomArgs', testCustomArgs);
  }, [
    runPort, runDbName, runInterface, runAddons, runInstallModules, runUpdateModules, runDevAll, runWithDemo, runStopAfterInit, runCustomArgs,
    upDbName, upUpgradePaths, upAddons, upUpdateModules, upRestoreTemplate, upTemplateDb, upStopAfterInit, upCustomArgs,
    testAddons, testDbName, testModules, testTags, testPort, testStopAfterInit, testCustomArgs
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

  // Handle server logs and status changes from IPC
  useEffect(() => {
    const unsubLog = window.odoo.onLog((text) => {
      const cleanText = stripAnsi(text);
      setLogs((prev) => {
        const next = [...prev, cleanText];
        if (next.length > 1000) return next.slice(next.length - 1000);
        return next;
      });
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
    };
  }, []);

  // Scroll to bottom when new logs come in
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const loadSettings = async () => {
    try {
      const dbMap = (await window.odoo.getStoreValue('branchDbMap')) || {};
      setBranchDbMap(dbMap);

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


  // Branch Linking Actions
  const handleLinkDb = async (dbName: string) => {
    if (!branchKey) return;
    try {
      const updated = { ...branchDbMap, [branchKey]: dbName };
      await window.odoo.setStoreValue('branchDbMap', updated);
      setBranchDbMap(updated);
      addToast({ type: 'success', message: `Linked branch to database ${dbName}` });
    } catch {
      addToast({ type: 'error', message: 'Failed to link branch to database.' });
    }
  };

  const handleUnlinkDb = async () => {
    if (!branchKey) return;
    try {
      const updated = { ...branchDbMap };
      delete updated[branchKey];
      await window.odoo.setStoreValue('branchDbMap', updated);
      setBranchDbMap(updated);
      addToast({ type: 'success', message: 'Unlinked branch database.' });
    } catch {
      addToast({ type: 'error', message: 'Failed to unlink branch database.' });
    }
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

  const handleDropDb = async (dbName: string) => {
    if (confirm(`Are you absolutely sure you want to completely DROP database ${dbName}? This cannot be undone.`)) {
      try {
        await window.odoo.dropDb(dbName, dbUser, dbHost, dbPassword);
        addToast({ type: 'success', message: `Database ${dbName} dropped.` });
        refreshDbList(dbUser, dbHost, dbPassword, false);
      } catch (err: any) {
        addToast({ type: 'error', message: err.message || 'Failed to drop database.' });
      }
    }
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

  // Run Server Execution Trigger
  const handleStartServer = async () => {
    if (!communityRepoPath) return;

    let targetDb = '';
    if (activeTab === 'run') {
      targetDb = runDbName || currentLinkedDb || '';
    } else if (activeTab === 'upgrade') {
      targetDb = upDbName || currentLinkedDb || '';
    } else if (activeTab === 'test') {
      targetDb = testDbName || currentLinkedDb || '';
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
      targetDb = runDbName || currentLinkedDb || '';
    } else if (activeTab === 'upgrade') {
      targetDb = upDbName || currentLinkedDb || '';
    } else if (activeTab === 'test') {
      targetDb = testDbName || currentLinkedDb || '';
    }

    let opts: any = {
      repoPath: communityRepoPath,
      venvPath: selectedVenv || undefined,
      commandType: activeTab,
      dbUser: dbUser,
      dbHost: dbHost,
      dbPassword: dbPassword,
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

  const handleQuickRun = (dbName: string) => {
    handleLinkDb(dbName);
    setActiveTab('run');
  };

  const venvOptions = [
    { value: '', label: 'System Default Python' },
    ...venvs.map((v) => ({ value: v, label: v })),
  ];

  const dbOptions = [
    { value: '', label: `[Linked Database: ${currentLinkedDb || 'None'}]` },
    ...dbs.map((db) => ({ value: db, label: db })),
  ];

  const templateOptions = [
    { value: '', label: '-- Choose Template --' },
    ...templates.map((t) => ({ value: t, label: t })),
  ];

  const createTemplateOptions = [
    { value: '', label: '-- Fresh Empty DB --' },
    ...dbs.map((db) => ({ value: db, label: db })),
  ];

  const filteredDbs = dbs.filter((db) => db.toLowerCase().includes(dbFilter.toLowerCase()));

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
        <div className="flex items-center gap-4">
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
      <div className="flex flex-1 overflow-hidden">
        {/* Left Side: Postgres DB List */}
        <div className="w-[45%] flex flex-col border-r border-border h-full bg-surface/10">
          <div className="p-3 border-b border-border space-y-2 bg-surface/20 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-muted text-[11px] uppercase tracking-wider">
                  Databases ({filteredDbs.length})
                </span>
                <span className={`w-1.5 h-1.5 rounded-full ${isDbConnected ? 'bg-success' : 'bg-muted'}`} title={isDbConnected ? 'Connected' : 'Disconnected'} />
              </div>
              <button
                className={`p-1 hover:bg-border/60 text-muted hover:text-primary rounded ${
                  loadingDbs ? 'opacity-50 pointer-events-none' : ''
                }`}
                onClick={() => refreshDbList(dbUser, dbHost, dbPassword, true)}
                title="Refresh Database list"
              >
                <svg
                  className={`w-3.5 h-3.5 ${loadingDbs ? 'spinner text-accent' : ''}`}
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M13.5 8a5.5 5.5 0 1 1-1.61-3.89L13.5 5.5M13.5 2.5v3h-3" />
                </svg>
              </button>
            </div>

            <div className="flex gap-2 relative">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Filter databases..."
                  className="w-full bg-bg text-[11.5px] py-1 px-2.5 border border-border rounded outline-none focus:border-accent pr-6"
                  value={dbFilter}
                  onChange={(e) => setDbFilter(e.target.value)}
                />
                {dbFilter && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-primary text-[14px]"
                    onClick={() => setDbFilter('')}
                  >
                    ×
                  </button>
                )}
              </div>
              <button
                className="px-2.5 py-1 bg-accent border border-accent hover:bg-accent/80 text-[10.5px] text-white font-semibold rounded transition-colors shrink-0 flex items-center justify-center gap-1"
                onClick={() => setShowCreateModal(true)}
              >
                + New DB
              </button>
            </div>
          </div>

          {/* Database Grid list */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/40 p-2 space-y-1.5">
            {loadingDbs ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted text-[12px] gap-2">
                <svg className="spinner text-accent animate-spin" width="16" height="16" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="20 12" />
                </svg>
                Loading databases...
              </div>
            ) : !isDbConnected ? (
              <div className="flex flex-col items-center justify-center p-6 text-center bg-surface/10 border border-dashed border-border rounded-lg m-2">
                <svg className="w-8 h-8 text-muted mb-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <h4 className="text-[13px] font-medium text-primary mb-1">PostgreSQL Disconnected</h4>
                <p className="text-[11px] text-muted max-w-[240px] leading-relaxed">
                  Please enter your credentials and click Connect in the PostgreSQL Connection card above.
                </p>
              </div>
            ) : filteredDbs.length === 0 ? (
              <div className="p-8 text-center text-muted text-[12px] italic">No databases found.</div>
            ) : (
              filteredDbs.map((db) => {
                const isTemplate = templates.includes(db);
                const isLinked = currentLinkedDb === db;
                return (
                  <div
                    key={db}
                    className={`group p-2.5 rounded-lg border transition-all flex items-center justify-between bg-surface/30 cursor-pointer ${
                      isLinked
                        ? 'border-success/30 bg-success/5 shadow-inner'
                        : 'border-border/60 hover:border-border hover:bg-surface/50'
                    }`}
                    onClick={() => isLinked ? handleUnlinkDb() : handleLinkDb(db)}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-semibold text-primary truncate">{db}</span>
                        {isLinked && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-success/20 text-success uppercase tracking-wide">
                            Linked
                          </span>
                        )}
                        {isTemplate && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-warning/20 text-warning uppercase tracking-wide flex items-center gap-0.5">
                            <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                              <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.4 8.168L12 18.896l-7.334 3.857 1.4-8.168L.133 9.21l8.2-1.192z" />
                            </svg>
                            Template
                          </span>
                        )}
                      </div>
                    </div>

                    {/* DB Action options */}
                    <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        className="p-1.5 rounded hover:bg-border/60 text-muted hover:text-warning"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleTemplate(db);
                        }}
                        title={isTemplate ? 'Unmark template' : 'Mark as Template'}
                      >
                        <svg className="w-4 h-4" fill={isTemplate ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </button>
                      <button
                        className="p-1.5 rounded hover:bg-border/60 text-muted hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDupSrcDb(db);
                          setDupDestDb(`${db}_copy`);
                          setShowDuplicateModal(true);
                        }}
                        title="Duplicate Database"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                        </svg>
                      </button>
                      <button
                        className="p-1.5 rounded hover:bg-border/60 text-muted hover:text-success"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickRun(db);
                        }}
                        title="Run Server with this DB"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      <button
                        className="p-1.5 rounded hover:bg-border/60 text-muted hover:text-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDropDb(db);
                        }}
                        title="Drop Database"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Virtual Environment + Server controls & Console */}
        <div className="w-[55%] flex flex-col h-full overflow-hidden bg-bg">
          {/* Virtual Environment Selector */}
          <div className="p-3 border-b border-border bg-surface/20 flex flex-col gap-2 shrink-0">
            <span className="font-semibold text-muted text-[11px] uppercase tracking-wider">
              Python Virtual Environment (venv)
            </span>
            <div className="flex items-center gap-2 w-full">
              <div className="flex items-center gap-1.5 flex-[1.2] min-w-[200px]">
                <Dropdown
                  options={venvOptions}
                  value={selectedVenv}
                  onChange={handleSelectVenv}
                  searchable={true}
                  placeholder="System Default Python"
                  className="flex-1"
                />
                {selectedVenv && (
                  <button
                    onClick={() => handleRemoveVenv(selectedVenv)}
                    className="px-2 py-1 text-danger bg-danger/10 border border-danger/20 hover:bg-danger/25 text-[11px] font-medium rounded transition-colors shrink-0"
                    title="Remove selected path from list"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-[2] min-w-[280px]">
                <input
                  type="text"
                  placeholder="Paste absolute path to venv folder (e.g. /home/user/venv/)"
                  value={newVenvPath}
                  onChange={(e) => setNewVenvPath(e.target.value)}
                  className="bg-bg text-[11px] py-1 px-2 border border-border rounded outline-none focus:border-accent flex-1 text-primary min-w-0"
                />
                <button
                  onClick={handleAddVenv}
                  className="px-2.5 py-1 bg-accent border border-accent hover:bg-accent/80 text-[11px] text-white font-semibold rounded transition-colors shrink-0"
                >
                  Add Path
                </button>
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
                  <div>
                    <label className="block text-[10px] text-muted font-bold uppercase mb-1">Target DB</label>
                    <Dropdown
                      options={dbOptions}
                      value={runDbName}
                      onChange={setRunDbName}
                      searchable={true}
                      placeholder={`[Linked Database: ${currentLinkedDb || 'None'}]`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted font-bold uppercase mb-1">HTTP Port</label>
                    <input
                      type="number"
                      value={runPort}
                      onChange={(e) => setRunPort(parseInt(e.target.value) || 8069)}
                      className="w-full bg-[#0D1117]/60 text-[12px] py-1.5 px-3 border border-border rounded outline-none text-primary min-h-[36px] focus:border-accent/70"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-muted font-bold uppercase mb-1">HTTP Interface</label>
                    <input
                      type="text"
                      value={runInterface}
                      onChange={(e) => setRunInterface(e.target.value)}
                      className="w-full bg-[#0D1117]/60 text-[12px] py-1.5 px-3 border border-border rounded outline-none text-primary min-h-[36px] focus:border-accent/70"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted font-bold uppercase mb-1">Addons Path</label>
                    <input
                      type="text"
                      value={runAddons}
                      onChange={(e) => setRunAddons(e.target.value)}
                      className="w-full bg-[#0D1117]/60 text-[12px] py-1.5 px-3 border border-border rounded outline-none font-mono text-primary min-h-[36px] focus:border-accent/70"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <ModuleSelector
                    label="Install Module (-i)"
                    modules={runInstallModules}
                    onChange={setRunInstallModules}
                    allModules={allModules}
                    placeholder="e.g. sale, purchase"
                  />
                  <ModuleSelector
                    label="Update Module (-u)"
                    modules={runUpdateModules}
                    onChange={setRunUpdateModules}
                    allModules={allModules}
                    placeholder="e.g. sale, purchase"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 py-1.5">
                  <label className="flex items-center gap-1.5 text-[11px] text-primary cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={runDevAll}
                      onChange={(e) => setRunDevAll(e.target.checked)}
                      className="rounded border-border text-accent cursor-pointer focus:ring-accent bg-bg"
                    />
                    --dev=all
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] text-primary cursor-pointer select-none" title="Loads demo data in Odoo 19+. Disables demo load on older versions when unchecked.">
                    <input
                      type="checkbox"
                      checked={runWithDemo}
                      onChange={(e) => setRunWithDemo(e.target.checked)}
                      className="rounded border-border text-accent cursor-pointer focus:ring-accent bg-bg"
                    />
                    With Demo Data
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] text-primary cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={runStopAfterInit}
                      onChange={(e) => setRunStopAfterInit(e.target.checked)}
                      className="rounded border-border text-accent cursor-pointer focus:ring-accent bg-bg"
                    />
                    Stop after init
                  </label>
                </div>

                <div>
                  <label className="block text-[10px] text-muted font-bold uppercase mb-1">Custom Raw Arguments</label>
                  <input
                    type="text"
                    placeholder="e.g. --log-level=debug --workers=0"
                    value={runCustomArgs}
                    onChange={(e) => setRunCustomArgs(e.target.value)}
                    className="w-full bg-bg text-[12px] py-1 px-2 border border-border rounded outline-none font-mono text-primary"
                  />
                </div>
              </div>
            )}

            {activeTab === 'upgrade' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-muted font-bold uppercase mb-1">Target DB</label>
                    <Dropdown
                      options={dbOptions}
                      value={upDbName}
                      onChange={setUpDbName}
                      searchable={true}
                      placeholder={`[Linked Database: ${currentLinkedDb || 'None'}]`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted font-bold uppercase mb-1">Upgrade Paths</label>
                    <input
                      type="text"
                      value={upUpgradePaths}
                      onChange={(e) => setUpUpgradePaths(e.target.value)}
                      className="w-full bg-bg text-[12px] py-1 px-2 border border-border rounded outline-none font-mono text-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-muted font-bold uppercase mb-1">Addons Path</label>
                  <input
                    type="text"
                    value={upAddons}
                    onChange={(e) => setUpAddons(e.target.value)}
                    className="w-full bg-bg text-[12px] py-1 px-2 border border-border rounded outline-none font-mono text-primary"
                  />
                </div>

                <ModuleSelector
                  label="Update Module (-u)"
                  modules={upUpdateModules}
                  onChange={setUpUpdateModules}
                  allModules={allModules}
                  placeholder="e.g. sale, purchase (leave empty to upgrade all)"
                />

                <div className="border border-warning/20 bg-warning/5 rounded p-3 space-y-2.5">
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-warning cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={upRestoreTemplate}
                      onChange={(e) => setUpRestoreTemplate(e.target.checked)}
                      className="rounded border-border text-warning cursor-pointer focus:ring-warning bg-bg"
                    />
                    Restore DB from template before upgrade
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
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 py-1">
                  <label className="flex items-center gap-1.5 text-[11px] text-primary cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={upStopAfterInit}
                      onChange={(e) => setUpStopAfterInit(e.target.checked)}
                      className="rounded border-border text-accent cursor-pointer focus:ring-accent bg-bg"
                    />
                    --stop-after-init
                  </label>
                </div>

                <div>
                  <label className="block text-[10px] text-muted font-bold uppercase mb-1">Custom Raw Arguments</label>
                  <input
                    type="text"
                    placeholder="e.g. --log-level=info"
                    value={upCustomArgs}
                    onChange={(e) => setUpCustomArgs(e.target.value)}
                    className="w-full bg-bg text-[12px] py-1 px-2 border border-border rounded outline-none font-mono text-primary"
                  />
                </div>
              </div>
            )}

            {activeTab === 'test' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-muted font-bold uppercase mb-1">Target DB</label>
                    <Dropdown
                      options={dbOptions}
                      value={testDbName}
                      onChange={setTestDbName}
                      searchable={true}
                      placeholder={`[Linked Database: ${currentLinkedDb || 'None'}]`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted font-bold uppercase mb-1">HTTP Port (0 = Auto)</label>
                    <input
                      type="number"
                      value={testPort}
                      onChange={(e) => setTestPort(parseInt(e.target.value) || 0)}
                      className="w-full bg-bg text-[12px] py-1 px-2 border border-border rounded outline-none text-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 items-end">
                  <ModuleSelector
                    label="Install Module (-i)"
                    modules={testModules}
                    onChange={setTestModules}
                    allModules={allModules}
                    placeholder="e.g. account_reports"
                  />
                  <div>
                    <label className="block text-[10px] text-muted font-bold uppercase mb-1">Test Tags</label>
                    <input
                      type="text"
                      placeholder="e.g. account_reports"
                      value={testTags}
                      onChange={(e) => setTestTags(e.target.value)}
                      className="w-full bg-[#0D1117]/60 text-[12px] py-1.5 px-2 border border-border rounded outline-none text-primary min-h-[34px] focus:border-accent/70 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-muted font-bold uppercase mb-1">Addons Path</label>
                  <input
                    type="text"
                    value={testAddons}
                    onChange={(e) => setTestAddons(e.target.value)}
                    className="w-full bg-bg text-[12px] py-1 px-2 border border-border rounded outline-none font-mono text-primary"
                  />
                </div>

                <div className="flex items-center gap-4 py-1">
                  <label className="flex items-center gap-1.5 text-[11px] text-primary cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={testStopAfterInit}
                      onChange={(e) => setTestStopAfterInit(e.target.checked)}
                      className="rounded border-border text-accent cursor-pointer focus:ring-accent bg-bg"
                    />
                    --stop-after-init
                  </label>
                </div>

                <div>
                  <label className="block text-[10px] text-muted font-bold uppercase mb-1">Custom Raw Arguments</label>
                  <input
                    type="text"
                    placeholder="e.g. --log-level=test"
                    value={testCustomArgs}
                    onChange={(e) => setTestCustomArgs(e.target.value)}
                    className="w-full bg-bg text-[12px] py-1 px-2 border border-border rounded outline-none font-mono text-primary"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Command Preview bar */}
          <div className="px-4 py-2.5 border-t border-border bg-surface/20 shrink-0">
            <div className="space-y-1">
              <div className="text-[9px] text-muted font-bold uppercase tracking-wider">
                {serverStatus !== 'stopped' ? 'Running Command' : 'Command Preview'}
              </div>
              <div className="text-[9.5px] font-mono text-primary/80 whitespace-pre-wrap break-all border border-border/40 p-1.5 rounded bg-bg/50 select-all hover:text-primary transition-colors" title={serverStatus !== 'stopped' ? runningCmd : previewCmd}>
                {serverStatus !== 'stopped' ? runningCmd : previewCmd}
              </div>
            </div>
          </div>

          {/* Live Terminal Output Console */}
          <div className="h-44 border-t border-border flex flex-col bg-slate-950 font-mono text-[11px] text-slate-200 shrink-0">
            <div className="px-3 py-1 bg-slate-900 border-b border-border/40 flex items-center justify-between shrink-0">
              <span className="text-slate-400 font-bold uppercase text-[9px]">Server Logs Terminal</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleOpenExternalTerminal}
                  className="text-slate-400 hover:text-white text-[9px] transition-colors flex items-center gap-1 border border-slate-700/60 rounded px-1.5 py-0.5 bg-slate-800/40 hover:bg-slate-800"
                  title="Open command in external Ubuntu terminal"
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                  <span>Open Terminal</span>
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
            <div className="flex-1 overflow-auto p-2 selection:bg-slate-700 select-text leading-tight whitespace-pre-wrap">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic py-4 text-center">No terminal logs recorded yet. Start server to stream output.</div>
              ) : (
                logs.map((log, idx) => <div key={idx}>{log}</div>)
              )}
              <div ref={terminalEndRef} />
            </div>
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
                  type="text"
                  placeholder="e.g. odoo_dev_db"
                  value={createDbName}
                  onChange={(e) => setCreateDbName(e.target.value)}
                  className="w-full bg-bg text-[12px] py-1.5 px-3 border border-border rounded-md outline-none text-primary"
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
                type="text"
                placeholder="e.g. odoo_dev_db_copy"
                value={dupDestDb}
                onChange={(e) => setDupDestDb(e.target.value)}
                className="w-full bg-bg text-[12px] py-1.5 px-3 border border-border rounded-md outline-none text-primary"
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
    </div>
  );
}
