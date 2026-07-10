import Store from 'electron-store';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

interface StoreSchema {
  trigram: string;
  defaultVersion: string;
  repos: { path: string; name: string }[];
  lastActiveRepo: string | null;
  windowBounds: { width: number; height: number; x?: number; y?: number } | null;
  githubPat: string;
  githubUsername: string;
  pendingDbs: string[];
  odooRootDir: string;
  alwaysOpenSeparateTerminal?: boolean;
}

const store = new Store<StoreSchema>({
  name: 'odoogit-config',
  defaults: {
    trigram: '',
    defaultVersion: 'master',
    repos: [],
    lastActiveRepo: null,
    windowBounds: null,
    githubPat: '',
    githubUsername: '',
    pendingDbs: [],
    odooRootDir: '',
    alwaysOpenSeparateTerminal: false,
  },
});

// Clear any pending databases from previous sessions on startup
store.set('pendingDbs', []);

export function getSettings() {
  return {
    trigram: store.get('trigram'),
    defaultVersion: store.get('defaultVersion'),
    repos: store.get('repos'),
    lastActiveRepo: store.get('lastActiveRepo'),
    githubPat: store.get('githubPat'),
    githubUsername: store.get('githubUsername'),
    odooRootDir: store.get('odooRootDir'),
    alwaysOpenSeparateTerminal: store.get('alwaysOpenSeparateTerminal'),
  };
}

export function saveSettings(partial: Partial<StoreSchema>) {
  for (const [key, value] of Object.entries(partial)) {
    store.set(key as keyof StoreSchema, value);
  }
}

export function getWindowBounds() {
  return store.get('windowBounds');
}

export function setWindowBounds(bounds: { width: number; height: number; x?: number; y?: number }) {
  store.set('windowBounds', bounds);
}

/**
 * Write a GitHub PAT into ~/.git-credentials and ensure
 * git credential.helper is set to 'store'.
 * Called on app startup (if a PAT is saved) and whenever
 * the user saves a new PAT from the Settings panel.
 */
export function applyGitCredentials(username: string, pat: string) {
  if (!pat) return;
  const user = username || 'oauth2';
  try {
    // Ensure credential.helper store is configured
    try {
      execSync('git config --global credential.helper store', { stdio: 'ignore' });
    } catch { /* already set or no git */ }

    const credPath = path.join(os.homedir(), '.git-credentials');
    const entry = `https://${user}:${pat}@github.com`;

    // Read existing entries, replace any github.com line, or append
    let lines: string[] = [];
    if (fs.existsSync(credPath)) {
      lines = fs.readFileSync(credPath, 'utf-8').split('\n').filter(Boolean);
    }
    lines = lines.filter((l) => !l.includes('github.com'));
    lines.push(entry);

    fs.writeFileSync(credPath, lines.join('\n') + '\n', { mode: 0o600 });
  } catch (err) {
    console.error('Failed to write git-credentials:', err);
  }
}

export { store };
