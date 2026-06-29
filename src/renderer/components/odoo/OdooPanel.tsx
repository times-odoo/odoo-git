import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRepoStore } from '../../store/repos';
import { useGitStore } from '../../store/git';
import { useUIStore } from '../../store/ui';
import { Dropdown } from '../shared/Dropdown';
import { DbDropdown } from '../shared/DbDropdown';

const stripAnsi = (str: string) => {
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
};

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
    testTags?: string;
    testPort?: number;
    testStopAfterInit?: boolean;
    testCustomArgs?: string;
    testUseCustomCommand?: boolean;
    testCustomCommand?: string;
  }

  const defaultPresets: OdooPreset[] = [
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
      testTags,
      testPort,
      testStopAfterInit,
      testCustomArgs,
      testUseCustomCommand,
      testCustomCommand,
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
      testTags,
      testPort,
      testStopAfterInit,
      testCustomArgs,
      testUseCustomCommand,
      testCustomCommand,
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
      testTagsVal = testTags;
      stopAfterInit = testStopAfterInit;
      customArgs = testCustomArgs;
      port = testPort;
    }

    const args: string[] = [];
    if (targetDb) {
      args.push('-d', targetDb);
    } else {
      args.push('--no-database');
    }

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
      if (withDemo === false) {
        args.push('--without-demo=all');
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
    testAddons, testDbName, testModules, testTags, testPort, testStopAfterInit, testCustomArgs,
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
    testAddons, testDbName, testModules, testTags, testPort, testStopAfterInit, testCustomArgs,
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
        {/* Left Side: Command Preview and Server Logs Terminal */}
        <div className="w-[45%] flex flex-col border-r border-border h-full bg-surface/10 overflow-hidden">
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
            <div className="flex-1 overflow-auto p-2.5 selection:bg-slate-700 select-text leading-tight whitespace-pre-wrap">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic py-4 text-center">No terminal logs recorded yet. Start server to stream output.</div>
              ) : (
                logs.map((log, idx) => <div key={idx}>{log}</div>)
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>

        {/* Right Side: Virtual Environment + Server controls & Console */}
        <div className="w-[55%] flex flex-col h-full overflow-hidden bg-bg">
          {/* Virtual Environment Selector & Preset Manager */}
          <div className="p-3 border-b border-border bg-surface/20 flex flex-col gap-3 shrink-0">
            {/* Presets section — comes first */}
            <div className="flex flex-col gap-1.5">
              <span className="font-semibold text-muted text-[10px] uppercase tracking-wider">
                Configuration Preset
              </span>
              <div className="flex items-center gap-2 h-[36px]">
                <Dropdown
                  options={filteredPresets.map((p) => ({ value: p.name, label: p.name }))}
                  value={selectedPresetName}
                  onChange={handleApplyPreset}
                  placeholder="Select Preset..."
                  className="flex-1"
                />
                {selectedPresetName && (
                  <>
                    <button
                      onClick={handleUpdateCurrentPreset}
                      className="w-[36px] shrink-0 h-full flex items-center justify-center bg-success/15 border border-success/30 hover:bg-success/25 text-success rounded transition-colors"
                      title="Save — update preset with current config"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeletePreset(selectedPresetName)}
                      className="w-[36px] shrink-0 h-full flex items-center justify-center bg-danger/15 border border-danger/30 hover:bg-danger/25 text-danger rounded transition-colors"
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
                  className="w-[36px] shrink-0 h-full flex items-center justify-center bg-accent/15 border border-accent/30 hover:bg-accent/25 text-accent rounded transition-colors"
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
              <span className="font-semibold text-muted text-[11px] uppercase tracking-wider">
                Python Virtual Environment (venv)
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
                  <div>
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
                  <div>
                    <label className="block text-[10px] text-muted font-bold uppercase mb-1">Addons Path</label>
                    <input
                      type="text"
                      disabled={runUseCustomCommand}
                      value={runAddons}
                      onChange={(e) => setRunAddons(e.target.value)}
                      className="w-full bg-[#0D1117]/60 text-[12px] py-1.5 px-3 border border-border rounded outline-none font-mono text-primary min-h-[36px] focus:border-accent/70 disabled:opacity-50 disabled:cursor-not-allowed"
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

                <div>
                  <label className="block text-[10px] text-muted font-bold uppercase mb-1">Addons Path</label>
                  <input
                    type="text"
                    disabled={upUseCustomCommand}
                    value={upAddons}
                    onChange={(e) => setUpAddons(e.target.value)}
                    className="w-full bg-bg text-[12px] py-1 px-2 border border-border rounded outline-none font-mono text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

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

                <div className="grid grid-cols-2 gap-3 items-end">
                  <ModuleSelector
                    label="Install Module (-i)"
                    modules={testModules}
                    onChange={setTestModules}
                    allModules={allModules}
                    placeholder="e.g. account_reports"
                    disabled={testUseCustomCommand}
                  />
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
                </div>

                <div>
                  <label className="block text-[10px] text-muted font-bold uppercase mb-1">Addons Path</label>
                  <input
                    type="text"
                    disabled={testUseCustomCommand}
                    value={testAddons}
                    onChange={(e) => setTestAddons(e.target.value)}
                    className="w-full bg-bg text-[12px] py-1 px-2 border border-border rounded outline-none font-mono text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

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
