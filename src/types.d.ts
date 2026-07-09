// Shared types between main and renderer processes

export interface RepoConfig {
  path: string;
  name: string;
}

export interface GitStatus {
  current: string | null;
  tracking: string | null;
  ahead: number;
  behind: number;
  modified: string[];
  staged: string[];
  deleted: string[];
  untracked: string[];
  conflicted: string[];
  isClean: boolean;
}

export interface BranchInfo {
  name: string;
  current: boolean;
  linkedWorkTree: boolean;
  commit: string;
  label: string;
}

export interface BranchSummary {
  local: BranchInfo[];
  remotes: { remote: string; branches: BranchInfo[] }[];
}

export interface LogEntry {
  hash: string;
  hashShort: string;
  message: string;
  author: string;
  date: string;
  refs: string;
}

export interface DiffFile {
  file: string;
  binary: boolean;
  insertions: number;
  deletions: number;
  chunks: DiffChunk[];
}

export interface DiffChunk {
  header: string;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'added' | 'removed' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface RemoteInfo {
  name: string;
  fetchUrl: string;
  pushUrl: string;
}

export interface StashEntry {
  index: number;
  date: string;
  message: string;
  branch: string;
  hash: string;
}

export interface OdooBranchConfig {
  version: string;
  tag: string;
  module: string;
  description: string;
  trigram: string;
  base: string;
}

export interface AppSettings {
  trigram: string;
  defaultVersion: string;
  repos: RepoConfig[];
  lastActiveRepo: string | null;
  githubPat: string;
  githubUsername: string;
  odooRootDir: string;
}

export type PushResult = {
  success: boolean;
  message: string;
};

export type CherryPickResult = {
  success: boolean;
  conflicts: string[];
  message: string;
};

// IPC API exposed on window.git
export interface GitAPI {
  status(repoPath: string): Promise<GitStatus>;
  getAheadBehindCount(repoPath: string, target: string): Promise<{ ahead: number; behind: number }>;
  log(repoPath: string, opts?: { maxCount?: number; from?: string; to?: string }): Promise<LogEntry[]>;
  diff(repoPath: string, opts?: { base?: string; staged?: boolean; file?: string }): Promise<DiffFile[]>;
  diffRaw(repoPath: string, args: string[]): Promise<string>;
  branches(repoPath: string): Promise<BranchSummary>;
  remotes(repoPath: string): Promise<RemoteInfo[]>;
  setRemoteUrl(repoPath: string, remote: string, url: string, isPush?: boolean): Promise<void>;
  addRemote(repoPath: string, name: string, url: string): Promise<void>;
  renameRemote(repoPath: string, oldName: string, newName: string): Promise<void>;
  deleteRemote(repoPath: string, name: string): Promise<void>;
  deleteRemoteBranch(repoPath: string, remote: string, branch: string): Promise<void>;
  checkout(repoPath: string, branch: string): Promise<void>;
  checkoutNew(repoPath: string, branch: string, startPoint: string): Promise<void>;
  fetch(repoPath: string, remote?: string): Promise<void>;
  fetchAll(repoPath: string): Promise<{ success: boolean; errors: string[] }>;
  push(repoPath: string, remote: string, branch: string, opts?: { force?: boolean; forceWithLease?: boolean }): Promise<PushResult>;
  pull(repoPath: string, remote: string, branch: string, opts?: { rebase?: boolean }): Promise<void>;
  rebase(repoPath: string, onto: string): Promise<{ success: boolean; conflicts: string[] }>;
  rebaseAbort(repoPath: string): Promise<void>;
  rebaseContinue(repoPath: string): Promise<void>;
  stash(repoPath: string, message?: string, includeUntracked?: boolean): Promise<void>;
  stashList(repoPath: string): Promise<StashEntry[]>;
  stashApply(repoPath: string, index: number): Promise<void>;
  stashPop(repoPath: string, index: number): Promise<void>;
  stashDrop(repoPath: string, index: number): Promise<void>;
  stashShow(repoPath: string, index: number): Promise<DiffFile[]>;
  cherryPick(repoPath: string, commits: string[]): Promise<CherryPickResult>;
  cherryPickAbort(repoPath: string): Promise<void>;
  cherryPickContinue(repoPath: string): Promise<void>;
  commit(repoPath: string, message: string): Promise<void>;
  amend(repoPath: string, message: string): Promise<void>;
  amendNoEdit(repoPath: string): Promise<void>;
  stage(repoPath: string, files: string[]): Promise<void>;
  unstage(repoPath: string, files: string[]): Promise<void>;
  discardChanges(repoPath: string, files: string[]): Promise<void>;
  getLastCommitMessage(repoPath: string): Promise<string>;
  renameBranch(repoPath: string, oldName: string, newName: string): Promise<void>;
  deleteBranch(repoPath: string, name: string, force: boolean): Promise<void>;
  resetHard(repoPath: string): Promise<void>;
  grepSearch(
    repoPath: string,
    opts: {
      query: string;
      revisions?: string[];
      paths?: string[];
      caseInsensitive?: boolean;
      useRegex?: boolean;
    }
  ): Promise<{ revision?: string; file: string; line: number; content: string }[]>;
  getRepoFiles(repoPath: string): Promise<string[]>;
  cloneRepo(cloneUrl: string, targetPath: string): Promise<void>;
  grepSearchStream(
    repoPath: string,
    opts: {
      query: string;
      revisions?: string[];
      paths?: string[];
      caseInsensitive?: boolean;
      useRegex?: boolean;
      sessionId: string;
    }
  ): Promise<{ started: boolean }>;
  onGrepResult(
    callback: (data: { sessionId: string; revision: string; results: any[]; error?: string }) => void
  ): () => void;
  onGrepStart(
    callback: (data: { sessionId: string; revision: string }) => void
  ): () => void;
  // App APIs
  selectDirectory(): Promise<string | null>;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: Partial<AppSettings>): Promise<void>;
  saveGithubPat(username: string, pat: string): Promise<void>;
  testGithubPat(pat: string): Promise<{ success: boolean; login: string; name: string; error?: string }>;
  getOdooModules(repoPath: string): Promise<string[]>;
  listDirectories(rootPath: string): Promise<string[]>;
  onTerminalLog(callback: (data: any) => void): () => void;
  // Window controls
  minimizeWindow(): void;
  maximizeWindow(): void;
  closeWindow(): void;
}

export interface OdooAPI {
  listDbs(dbUser?: string, dbHost?: string, dbPassword?: string): Promise<string[]>;
  createDb(dbName: string, templateName?: string, dbUser?: string, dbHost?: string, dbPassword?: string): Promise<void>;
  dropDb(dbName: string, dbUser?: string, dbHost?: string, dbPassword?: string): Promise<void>;
  duplicateDb(srcName: string, destName: string, dbUser?: string, dbHost?: string, dbPassword?: string): Promise<void>;
  startServer(opts: {
    repoPath: string;
    venvPath?: string;
    commandType: 'run' | 'upgrade' | 'test';
    dbName?: string;
    moduleName?: string;
    customArgs?: string;
    withDemo?: boolean;
    devAll?: boolean;
    stopAfterInit?: boolean;
    upgradePaths?: string;
    testTags?: string;
    port?: number;
    dbUser?: string;
    dbHost?: string;
    dbPassword?: string;
    initModules?: string;
    updateModules?: string;
    useCustomCommand?: boolean;
    customCommand?: string;
  }): Promise<void>;
  stopServer(): Promise<void>;
  getServerStatus(): Promise<{ status: 'starting' | 'running' | 'stopped'; cmd?: string; error?: string }>;
  getLogHistory(): Promise<string[]>;
  onLog(callback: (text: string) => void): () => void;
  onStateChange(callback: (state: { status: 'starting' | 'running' | 'stopped'; cmd?: string; error?: string; code?: number }) => void): () => void;
  getStoreValue(key: string): Promise<any>;
  setStoreValue(key: string, value: any): Promise<void>;
  openExternalTerminal(opts: any): Promise<{ success: boolean; error?: string }>;
  writeStdin(text: string): Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    git: GitAPI;
    odoo: OdooAPI;
  }
}
