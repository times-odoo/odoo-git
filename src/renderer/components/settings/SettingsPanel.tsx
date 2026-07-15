import React, { useState, useEffect, useMemo } from 'react';
import { useUIStore } from '../../store/ui';
import { useRepoStore } from '../../store/repos';
import { useGitStore } from '../../store/git';
import { Dropdown } from '../shared/Dropdown';
import { THEME_TEMPLATES } from '../../utils/themes';

export function SettingsPanel() {
  const activeRepoPath = useRepoStore((s) => s.activeRepoPath);
  const repoStates = useGitStore((s) => s.repoStates);
  const addToast = useUIStore((s) => s.addToast);
  const [trigram, setTrigram] = useState('');
  const [defaultVersion, setDefaultVersion] = useState('master');
  const [alwaysOpenSeparateTerminal, setAlwaysOpenSeparateTerminal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Theme states
  const themeIndex = useUIStore((s) => s.themeIndex);
  const setThemeIndex = useUIStore((s) => s.setThemeIndex);
  const customThemeColor = useUIStore((s) => s.customThemeColor);
  const setCustomThemeColor = useUIStore((s) => s.setCustomThemeColor);

  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
  };

  const rgbToHex = (rgb: string) => {
    const parts = rgb.split(',').map(s => parseInt(s.trim()));
    if (parts.length !== 3 || parts.some(isNaN)) return '#ff0000';
    return '#' + parts.map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  };

  // GitHub PAT state
  const [githubUsername, setGithubUsername] = useState('');
  const [githubPat, setGithubPat] = useState('');
  const [showPat, setShowPat] = useState(false);
  const [patSaved, setPatSaved] = useState(false);
  const [patSaving, setPatSaving] = useState(false);
  const [patTesting, setPatTesting] = useState(false);
  const [patTestResult, setPatTestResult] = useState<'success' | 'error' | null>(null);

  // PostgreSQL states
  const [dbUser, setDbUser] = useState('odoo');
  const [dbHost, setDbHost] = useState('127.0.0.1');
  const [dbPassword, setDbPassword] = useState('');
  const [showDbPassword, setShowDbPassword] = useState(false);
  const [isDbConnected, setIsDbConnected] = useState<boolean | null>(null);
  const [loadingDbTest, setLoadingDbTest] = useState(false);

  // Extract versions from odoo or ent remotes across all repositories (preferring active repo)
  const dynamicVersions = useMemo(() => {
    const versionsSet = new Set<string>();
    const activeState = activeRepoPath ? repoStates[activeRepoPath] : null;
    const statesToSearch = activeState ? [activeState] : Object.values(repoStates);

    for (const state of statesToSearch) {
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
  }, [activeRepoPath, repoStates]);

  useEffect(() => {
    loadSettings();
  }, []);

  // Keep defaultVersion synchronized with available dynamic versions
  useEffect(() => {
    if (dynamicVersions.length > 0 && !dynamicVersions.includes(defaultVersion)) {
      const preferred = dynamicVersions.includes('master') ? 'master' : dynamicVersions[0];
      setDefaultVersion(preferred);
    }
  }, [dynamicVersions]);

  const loadSettings = async () => {
    try {
      const settings = await window.git.getSettings();
      setTrigram(settings.trigram || '');
      setDefaultVersion(settings.defaultVersion || 'master');
      setGithubUsername(settings.githubUsername || '');
      setGithubPat(settings.githubPat || '');
      setAlwaysOpenSeparateTerminal(settings.alwaysOpenSeparateTerminal || false);
      if (settings.githubPat) {
        setPatSaved(true);
      }
    } catch {}

    try {
      const savedUser = (await window.odoo.getStoreValue('dbUser')) || 'odoo';
      const savedHost = (await window.odoo.getStoreValue('dbHost')) || '127.0.0.1';
      const savedPassword = (await window.odoo.getStoreValue('dbPassword')) || '';
      setDbUser(savedUser);
      setDbHost(savedHost);
      setDbPassword(savedPassword);
      // Verify DB connection
      await window.odoo.listDbs(savedUser, savedHost, savedPassword);
      setIsDbConnected(true);
    } catch {
      setIsDbConnected(false);
    }

    setLoading(false);
  };

  const handleSaveDbConfig = async () => {
    setLoadingDbTest(true);
    try {
      await window.odoo.setStoreValue('dbUser', dbUser);
      await window.odoo.setStoreValue('dbHost', dbHost);
      await window.odoo.setStoreValue('dbPassword', dbPassword);
      
      // Test the connection
      await window.odoo.listDbs(dbUser, dbHost, dbPassword);
      setIsDbConnected(true);
      addToast({ type: 'success', message: 'PostgreSQL connection saved & verified!' });
    } catch (err: any) {
      setIsDbConnected(false);
      addToast({ type: 'error', message: err?.message || 'Failed to connect to PostgreSQL.' });
    } finally {
      setLoadingDbTest(false);
    }
  };

  const handleSave = async () => {
    try {
      await window.git.saveSettings({
        trigram,
        defaultVersion,
        alwaysOpenSeparateTerminal,
      } as any);
      addToast({ message: 'Settings saved', type: 'success' });
    } catch (e: any) {
      addToast({ message: 'Failed to save settings', type: 'error' });
    }
  };

  const handleSavePat = async () => {
    if (!githubPat.trim()) {
      addToast({ message: 'Please enter a Personal Access Token', type: 'warning' });
      return;
    }
    setPatSaving(true);
    try {
      await window.git.saveGithubPat(githubUsername.trim(), githubPat.trim());
      setPatSaved(true);
      setPatTestResult(null);
      addToast({ message: 'GitHub token saved & applied to git credentials', type: 'success' });
    } catch (e: any) {
      addToast({ message: 'Failed to save token', type: 'error' });
    } finally {
      setPatSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!githubPat.trim()) {
      addToast({ message: 'Save the token first', type: 'warning' });
      return;
    }
    setPatTesting(true);
    setPatTestResult(null);
    try {
      const result = await window.git.testGithubPat(githubPat.trim());
      if (result.success) {
        setPatTestResult('success');
        // Auto-fill username from GitHub API response
        if (result.login && !githubUsername.trim()) {
          setGithubUsername(result.login);
          // Re-save with the correct username
          await window.git.saveGithubPat(result.login, githubPat.trim());
        }
        addToast({ message: `Authenticated as ${result.name || result.login}`, type: 'success' });
      } else {
        setPatTestResult('error');
        addToast({ message: result.error || 'Authentication failed', type: 'error' });
      }
    } catch (e: any) {
      setPatTestResult('error');
      addToast({ message: `Connection test failed: ${e?.message || 'Unknown error'}`, type: 'error' });
    } finally {
      setPatTesting(false);
    }
  };

  const handleClearPat = async () => {
    try {
      await window.git.saveGithubPat('', '');
      setGithubPat('');
      setGithubUsername('');
      setPatSaved(false);
      setPatTestResult(null);
      addToast({ message: 'GitHub token removed', type: 'info' });
    } catch {
      addToast({ message: 'Failed to clear token', type: 'error' });
    }
  };

  const maskPat = (pat: string) => {
    if (!pat) return '';
    if (pat.length <= 8) return '•'.repeat(pat.length);
    return pat.substring(0, 4) + '•'.repeat(pat.length - 8) + pat.substring(pat.length - 4);
  };

  if (loading) return null;

  return (
    <div className="h-full overflow-y-auto w-full">
      <div className="p-6 space-y-6 w-full">
        <h3 className="section-header text-[12px] font-bold tracking-wider">SETTINGS</h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Column 1: GitHub & PostgreSQL Connection */}
          <div className="space-y-6">
            {/* GitHub Connection */}
            <div className="border border-border rounded-lg bg-surface/5">
            <div className="bg-surface/50 px-4 py-2.5 border-b border-border flex items-center gap-2 rounded-t-lg">
              <svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span className="text-[13px] font-semibold text-primary">GitHub Connection</span>
              {patSaved && (
                <span className="ml-auto flex items-center gap-1 text-[11px] text-success">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  Connected
                </span>
              )}
            </div>
            <div className="p-4 space-y-4">
              <p className="text-[11px] text-muted leading-relaxed">
                A <strong className="text-primary">Personal Access Token (PAT)</strong> is required to access private repositories
                like <span className="font-mono text-accent">odoo/enterprise</span>. The token is stored locally and written
                to <span className="font-mono text-[10px]">~/.git-credentials</span> so all git operations authenticate automatically.
              </p>

              {/* Username */}
              <div>
                <label className="text-[12px] text-muted mb-1 block">GitHub Username</label>
                <input
                  type="text"
                  className="input-field font-mono w-full"
                  value={githubUsername}
                  onChange={(e) => {
                    setGithubUsername(e.target.value);
                    setPatSaved(false);
                  }}
                  placeholder="e.g. times-odoo"
                  spellCheck={false}
                />
              </div>

              {/* PAT */}
              <div>
                <label className="text-[12px] text-muted mb-1 block">Personal Access Token</label>
                <div className="relative">
                  <input
                    type={showPat ? 'text' : 'password'}
                    className="input-field font-mono w-full pr-10"
                    value={githubPat}
                    onChange={(e) => {
                      setGithubPat(e.target.value);
                      setPatSaved(false);
                      setPatTestResult(null);
                    }}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    spellCheck={false}
                  />
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors"
                    onClick={() => setShowPat(!showPat)}
                    title={showPat ? 'Hide token' : 'Show token'}
                    type="button"
                  >
                    {showPat ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542 7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-muted mt-1">
                  Generate at <a className="text-accent hover:underline cursor-pointer">github.com → Settings → Developer settings → Personal access tokens</a>
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 items-center flex-wrap">
                <button
                  className="btn-accent text-[12px] px-4"
                  onClick={handleSavePat}
                  disabled={patSaving || (!githubPat.trim())}
                >
                  {patSaving ? (
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving...
                    </span>
                  ) : patSaved ? (
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      Saved
                    </span>
                  ) : (
                    'Save Token'
                  )}
                </button>

                <button
                  className="btn-surface text-[12px] px-4"
                  onClick={handleTestConnection}
                  disabled={patTesting || !patSaved}
                >
                  {patTesting ? (
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Testing...
                    </span>
                  ) : (
                    'Test Connection'
                  )}
                </button>

                {patSaved && (
                  <button
                    className="text-[11px] text-danger hover:text-danger-hover transition-colors ml-auto"
                    onClick={handleClearPat}
                  >
                    Remove Token
                  </button>
                )}
              </div>

              {/* Test Result Indicator */}
              {patTestResult && (
                <div className={`flex items-center gap-2 text-[12px] px-3 py-2 rounded border ${
                  patTestResult === 'success'
                    ? 'bg-success/10 border-success/30 text-success'
                    : 'bg-danger/10 border-danger/30 text-danger'
                } fade-in`}>
                  {patTestResult === 'success' ? (
                    <>
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      Authentication successful — GitHub API verified
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Authentication failed — check your token and username
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* PostgreSQL Connection Card */}
          <div className="border border-border rounded-lg bg-surface/5">
              <div className="bg-surface/50 px-4 py-2.5 border-b border-border flex items-center gap-2 rounded-t-lg">
                <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
                <span className="text-[13px] font-semibold text-primary">PostgreSQL Connection</span>
                {isDbConnected !== null && (
                  <span className={`ml-auto flex items-center gap-1 text-[11px] ${isDbConnected ? 'text-success' : 'text-danger'}`}>
                    {isDbConnected ? (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    {isDbConnected ? 'Connected' : 'Disconnected'}
                  </span>
                )}
              </div>
              <div className="p-4 space-y-4">
                <p className="text-[11px] text-muted leading-relaxed">
                  Configure your PostgreSQL database connection credentials. OdooGit needs these to list, create, duplicate, and drop database registries for testing.
                </p>

                {/* DB User & DB Host in one line */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[12px] text-muted mb-1 block">DB User</label>
                    <input
                      type="text"
                      className="input-field font-mono w-full"
                      value={dbUser}
                      onChange={(e) => {
                        setDbUser(e.target.value);
                        setIsDbConnected(null);
                      }}
                      placeholder="odoo"
                      spellCheck={false}
                    />
                  </div>
                  <div>
                    <label className="text-[12px] text-muted mb-1 block">DB Host</label>
                    <input
                      type="text"
                      className="input-field font-mono w-full"
                      value={dbHost}
                      onChange={(e) => {
                        setDbHost(e.target.value);
                        setIsDbConnected(null);
                      }}
                      placeholder="127.0.0.1"
                      spellCheck={false}
                    />
                  </div>
                </div>

                 {/* Password */}
                 <div>
                   <label className="text-[12px] text-muted mb-1 block">Password</label>
                   <div className="relative">
                     <input
                       type={showDbPassword ? 'text' : 'password'}
                       className="input-field font-mono w-full pr-10"
                       value={dbPassword}
                       onChange={(e) => {
                         setDbPassword(e.target.value);
                         setIsDbConnected(null);
                       }}
                       placeholder="none"
                       spellCheck={false}
                     />
                     <button
                       className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors"
                       onClick={() => setShowDbPassword(!showDbPassword)}
                       title={showDbPassword ? 'Hide password' : 'Show password'}
                       type="button"
                     >
                       {showDbPassword ? (
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                         </svg>
                       ) : (
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542 7z" />
                         </svg>
                       )}
                     </button>
                   </div>
                 </div>

                {/* Connect Button */}
                <div className="flex gap-2">
                  <button
                    className="btn-accent text-[12px] px-4"
                    onClick={handleSaveDbConfig}
                    disabled={loadingDbTest}
                  >
                    {loadingDbTest ? 'Connecting...' : 'Connect'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: General Settings & About */}
          <div className="space-y-6">
            {/* General Settings */}
            <div className="border border-border rounded-lg bg-surface/5">
              <div className="bg-surface/50 px-4 py-2.5 border-b border-border rounded-t-lg">
                <span className="text-[13px] font-semibold text-primary">General</span>
              </div>
              <div className="p-4 space-y-4">
                {/* Trigram */}
                <div>
                  <label className="text-[12px] text-muted mb-1 block">Trigram</label>
                  <p className="text-[11px] text-muted mb-1.5">
                    Your personal identifier appended to branch names.
                  </p>
                  <input
                    type="text"
                    className="input-field font-mono w-32"
                    value={trigram}
                    onChange={(e) => setTrigram(e.target.value.toLowerCase())}
                    placeholder="times"
                    maxLength={5}
                  />
                </div>

                {/* Default Version */}
                <div>
                  <label className="text-[12px] text-muted mb-1 block">Default version for new branches</label>
                  <Dropdown
                    options={dynamicVersions}
                    value={defaultVersion}
                    onChange={setDefaultVersion}
                    searchable={true}
                    className="w-48"
                  />
                </div>

                {/* Odoo Server Terminal Preferences */}
                <div className="border-t border-border/50 pt-4 space-y-3">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">Odoo Server Terminal</span>
                  
                  <label className="flex items-start gap-2.5 text-[12px] text-primary cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={alwaysOpenSeparateTerminal}
                      onChange={(e) => {
                        setAlwaysOpenSeparateTerminal(e.target.checked);
                      }}
                      className="rounded border-border text-accent cursor-pointer focus:ring-accent bg-bg mt-0.5"
                    />
                    <div>
                      <span className="font-semibold block">Always open server in separate terminal</span>
                      <span className="text-[11px] text-muted block mt-0.5">
                        Spawn Odoo server processes in an external system terminal window (Gnome Terminal).
                      </span>
                    </div>
                  </label>
                </div>

                <button className="btn-accent" onClick={handleSave}>
                  Save Settings
                </button>
              </div>
            </div>

            {/* Theme Settings */}
            <div className="border border-border rounded-lg bg-surface/5">
              <div className="bg-surface/50 px-4 py-2.5 border-b border-border rounded-t-lg">
                <span className="text-[13px] font-semibold text-primary">Theme Selection</span>
              </div>
              <div className="p-4">
                <p className="text-[11px] text-muted leading-relaxed mb-4">
                  Select a color template to instantly restyle the application.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                  {THEME_TEMPLATES.map((theme, idx) => (
                    <div
                      key={theme.name}
                      onClick={() => setThemeIndex(idx)}
                      className={`cursor-pointer rounded-lg border flex flex-col overflow-hidden transition-all duration-200 hover:scale-105 ${
                        themeIndex === idx ? 'border-accent shadow-[0_0_8px_rgba(var(--color-accent),0.5)]' : 'border-border/50 hover:border-border'
                      }`}
                      style={{ backgroundColor: theme.bg }}
                    >
                      <div className="h-8 flex items-center justify-between px-2" style={{ backgroundColor: theme.surface }}>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `rgb(${theme.accent})` }} />
                        <div className="text-[9px] font-mono opacity-60 text-white">{theme.name.split(' ')[0]}</div>
                      </div>
                      <div className="h-10 p-2 flex items-center justify-center">
                        <span className="text-[10px] font-semibold tracking-wide" style={{ color: theme.primary }}>
                          {theme.name}
                        </span>
                      </div>
                    </div>
                  ))}
                  {/* Custom Theme Card */}
                  <div
                    onClick={() => setThemeIndex(-1)}
                    className={`cursor-pointer rounded-lg border flex flex-col overflow-hidden transition-all duration-200 hover:scale-105 ${
                      themeIndex === -1 ? 'border-accent shadow-[0_0_8px_rgba(var(--color-accent),0.5)]' : 'border-border/50 hover:border-border'
                    }`}
                    style={{ backgroundColor: THEME_TEMPLATES[0].bg }}
                  >
                    <div className="h-8 flex items-center justify-between px-2" style={{ backgroundColor: THEME_TEMPLATES[0].surface }}>
                      <input
                        type="color"
                        value={rgbToHex(customThemeColor)}
                        onChange={(e) => {
                          setCustomThemeColor(hexToRgb(e.target.value));
                          setThemeIndex(-1);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-5 h-5 p-0 border-0 rounded cursor-pointer bg-transparent"
                        title="Pick custom accent color"
                      />
                      <div className="text-[9px] font-mono opacity-60 text-white">Custom</div>
                    </div>
                    <div className="h-10 p-2 flex items-center justify-center">
                      <span className="text-[10px] font-semibold tracking-wide" style={{ color: THEME_TEMPLATES[0].primary }}>
                        Custom Color
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* App Background Settings */}
            <div className="border border-border rounded-lg bg-surface/5">
              <div className="bg-surface/50 px-4 py-2.5 border-b border-border rounded-t-lg">
                <span className="text-[13px] font-semibold text-primary">App Background</span>
              </div>
              <div className="p-4 space-y-4">
                <p className="text-[11px] text-muted leading-relaxed">
                  Set a custom background image for the app. The image will be applied as a full-screen overlay behind the UI. Adjust opacity to ensure readability.
                </p>
                <div>
                  <label className="text-[12px] text-muted mb-1 block">Background Image (Local Path or URL)</label>
                  <input
                    type="text"
                    className="input-field font-mono w-full text-[11px]"
                    value={useUIStore((s) => s.appBackgroundImage)}
                    onChange={(e) => useUIStore.getState().setAppBackgroundImage(e.target.value)}
                    placeholder="/home/user/Pictures/bg.jpg or https://..."
                  />
                </div>
                <div>
                  <label className="text-[12px] text-muted mb-1 flex items-center justify-between">
                    <span>Opacity Overlay</span>
                    <span className="text-accent">{useUIStore((s) => s.appBackgroundOpacity)}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    className="w-full accent-accent cursor-pointer"
                    value={useUIStore((s) => s.appBackgroundOpacity)}
                    onChange={(e) => useUIStore.getState().setAppBackgroundOpacity(parseInt(e.target.value, 10))}
                  />
                </div>
              </div>
            </div>

            {/* Help & Walkthrough */}
            <div className="border border-border rounded-lg bg-surface/5">
              <div className="bg-surface/50 px-4 py-2.5 border-b border-border rounded-t-lg">
                <span className="text-[13px] font-semibold text-primary">Help & Tutorial</span>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-[11px] text-muted leading-relaxed">
                  Need a refresher on how to navigate OdooGit? Restart the interactive walkthrough tour at any time.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('odoogit_hasSeenTour');
                    window.location.reload();
                  }}
                  className="btn-surface text-[12px] px-4 py-1.5"
                >
                  Start App Tour
                </button>
              </div>
            </div>

            {/* About */}
            <div className="border border-border rounded-lg bg-surface/5">
              <div className="bg-surface/50 px-4 py-2.5 border-b border-border rounded-t-lg">
                <span className="text-[13px] font-semibold text-primary">About</span>
              </div>
              <div className="p-4">
                <div className="text-[12px] text-muted space-y-1">
                  <p><strong className="text-primary">OdooGit</strong> v1.0.0</p>
                  <p>Git GUI for Odoo R&D developers</p>
                  <p>Electron + React + TypeScript</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
