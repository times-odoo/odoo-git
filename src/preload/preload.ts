import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('git', {
  // Git operations
  status: (repoPath: string) => ipcRenderer.invoke('git:status', repoPath),
  log: (repoPath: string, opts?: { maxCount?: number; from?: string; to?: string }) =>
    ipcRenderer.invoke('git:log', repoPath, opts),
  diff: (repoPath: string, opts?: { base?: string; staged?: boolean; file?: string }) =>
    ipcRenderer.invoke('git:diff', repoPath, opts),
  diffRaw: (repoPath: string, args: string[]) =>
    ipcRenderer.invoke('git:diffRaw', repoPath, args),
  branches: (repoPath: string) => ipcRenderer.invoke('git:branches', repoPath),
  remotes: (repoPath: string) => ipcRenderer.invoke('git:remotes', repoPath),
  setRemoteUrl: (repoPath: string, remote: string, url: string, isPush?: boolean) =>
    ipcRenderer.invoke('git:setRemoteUrl', repoPath, remote, url, isPush),
  addRemote: (repoPath: string, name: string, url: string) =>
    ipcRenderer.invoke('git:addRemote', repoPath, name, url),
  renameRemote: (repoPath: string, oldName: string, newName: string) =>
    ipcRenderer.invoke('git:renameRemote', repoPath, oldName, newName),
  deleteRemote: (repoPath: string, name: string) =>
    ipcRenderer.invoke('git:deleteRemote', repoPath, name),
  deleteRemoteBranch: (repoPath: string, remote: string, branch: string) =>
    ipcRenderer.invoke('git:deleteRemoteBranch', repoPath, remote, branch),
  checkout: (repoPath: string, branch: string) => ipcRenderer.invoke('git:checkout', repoPath, branch),
  checkoutNew: (repoPath: string, branch: string, startPoint: string) =>
    ipcRenderer.invoke('git:checkoutNew', repoPath, branch, startPoint),
  fetch: (repoPath: string, remote: string) => ipcRenderer.invoke('git:fetch', repoPath, remote),
  fetchAll: (repoPath: string) => ipcRenderer.invoke('git:fetchAll', repoPath),
  renameBranch: (repoPath: string, oldName: string, newName: string) =>
    ipcRenderer.invoke('git:renameBranch', repoPath, oldName, newName),
  deleteBranch: (repoPath: string, name: string, force: boolean) =>
    ipcRenderer.invoke('git:deleteBranch', repoPath, name, force),
  resetHard: (repoPath: string) => ipcRenderer.invoke('git:resetHard', repoPath),
  push: (repoPath: string, remote: string, branch: string, opts?: { force?: boolean; forceWithLease?: boolean }) =>
    ipcRenderer.invoke('git:push', repoPath, remote, branch, opts),
  pull: (repoPath: string, remote: string, branch: string, opts?: { rebase?: boolean }) =>
    ipcRenderer.invoke('git:pull', repoPath, remote, branch, opts),
  rebase: (repoPath: string, onto: string) => ipcRenderer.invoke('git:rebase', repoPath, onto),
  rebaseAbort: (repoPath: string) => ipcRenderer.invoke('git:rebaseAbort', repoPath),
  rebaseContinue: (repoPath: string) => ipcRenderer.invoke('git:rebaseContinue', repoPath),
  stash: (repoPath: string, message?: string, includeUntracked?: boolean) =>
    ipcRenderer.invoke('git:stash', repoPath, message, includeUntracked),
  stashList: (repoPath: string) => ipcRenderer.invoke('git:stashList', repoPath),
  stashApply: (repoPath: string, index: number) => ipcRenderer.invoke('git:stashApply', repoPath, index),
  stashPop: (repoPath: string, index: number) => ipcRenderer.invoke('git:stashPop', repoPath, index),
  stashDrop: (repoPath: string, index: number) => ipcRenderer.invoke('git:stashDrop', repoPath, index),
  stashShow: (repoPath: string, index: number) => ipcRenderer.invoke('git:stashShow', repoPath, index),
  cherryPick: (repoPath: string, commits: string[]) => ipcRenderer.invoke('git:cherryPick', repoPath, commits),
  cherryPickAbort: (repoPath: string) => ipcRenderer.invoke('git:cherryPickAbort', repoPath),
  cherryPickContinue: (repoPath: string) => ipcRenderer.invoke('git:cherryPickContinue', repoPath),
  commit: (repoPath: string, message: string) => ipcRenderer.invoke('git:commit', repoPath, message),
  amend: (repoPath: string, message: string) => ipcRenderer.invoke('git:amend', repoPath, message),
  amendNoEdit: (repoPath: string) => ipcRenderer.invoke('git:amendNoEdit', repoPath),
  stage: (repoPath: string, files: string[]) => ipcRenderer.invoke('git:stage', repoPath, files),
  unstage: (repoPath: string, files: string[]) => ipcRenderer.invoke('git:unstage', repoPath, files),
  discardChanges: (repoPath: string, files: string[]) => ipcRenderer.invoke('git:discardChanges', repoPath, files),
  getLastCommitMessage: (repoPath: string) => ipcRenderer.invoke('git:getLastCommitMessage', repoPath),
  grepSearch: (
    repoPath: string,
    opts: {
      query: string;
      revisions?: string[];
      paths?: string[];
      caseInsensitive?: boolean;
      useRegex?: boolean;
    }
  ) => ipcRenderer.invoke('git:grepSearch', repoPath, opts),
  getRepoFiles: (repoPath: string) => ipcRenderer.invoke('git:getRepoFiles', repoPath),
  cloneRepo: (cloneUrl: string, targetPath: string) => ipcRenderer.invoke('git:clone', cloneUrl, targetPath),
  grepSearchStream: (
    repoPath: string,
    opts: {
      query: string;
      revisions?: string[];
      paths?: string[];
      caseInsensitive?: boolean;
      useRegex?: boolean;
      sessionId: string;
    }
  ) => ipcRenderer.invoke('git:grepSearchStream', repoPath, opts),
  onGrepResult: (callback: (data: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('git:grep-result', subscription);
    return () => {
      ipcRenderer.removeListener('git:grep-result', subscription);
    };
  },
  onGrepStart: (callback: (data: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('git:grep-start', subscription);
    return () => {
      ipcRenderer.removeListener('git:grep-start', subscription);
    };
  },

  // App operations
  selectDirectory: () => ipcRenderer.invoke('app:selectDirectory'),
  getSettings: () => ipcRenderer.invoke('app:getSettings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('app:saveSettings', settings),
  saveGithubPat: (username: string, pat: string) => ipcRenderer.invoke('app:saveGithubPat', username, pat),
  testGithubPat: (pat: string) => ipcRenderer.invoke('app:testGithubPat', pat),
  getOdooModules: (repoPath: string) => ipcRenderer.invoke('app:getOdooModules', repoPath),
  onTerminalLog: (callback: (data: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('git:terminal-log', subscription);
    return () => {
      ipcRenderer.removeListener('git:terminal-log', subscription);
    };
  },

  // Window controls (fire-and-forget)
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
});

contextBridge.exposeInMainWorld('odoo', {
  listDbs: (dbUser?: string, dbHost?: string, dbPassword?: string) => ipcRenderer.invoke('odoo:listDbs', dbUser, dbHost, dbPassword),
  createDb: (dbName: string, templateName?: string, dbUser?: string, dbHost?: string, dbPassword?: string) =>
    ipcRenderer.invoke('odoo:createDb', dbName, templateName, dbUser, dbHost, dbPassword),
  dropDb: (dbName: string, dbUser?: string, dbHost?: string, dbPassword?: string) =>
    ipcRenderer.invoke('odoo:dropDb', dbName, dbUser, dbHost, dbPassword),
  duplicateDb: (srcName: string, destName: string, dbUser?: string, dbHost?: string, dbPassword?: string) =>
    ipcRenderer.invoke('odoo:createDb', destName, srcName, dbUser, dbHost, dbPassword),
  startServer: (opts: any) => ipcRenderer.invoke('odoo:startServer', opts),
  stopServer: () => ipcRenderer.invoke('odoo:stopServer'),
  getServerStatus: () => ipcRenderer.invoke('odoo:getServerStatus'),
  onLog: (callback: (text: string) => void) => {
    const sub = (_event: any, text: string) => callback(text);
    ipcRenderer.on('odoo:log', sub);
    return () => ipcRenderer.removeListener('odoo:log', sub);
  },
  onStateChange: (callback: (state: any) => void) => {
    const sub = (_event: any, state: any) => callback(state);
    ipcRenderer.on('odoo:state', sub);
    return () => ipcRenderer.removeListener('odoo:state', sub);
  },
  getStoreValue: (key: string) => ipcRenderer.invoke('odoo:getStoreValue', key),
  setStoreValue: (key: string, value: any) => ipcRenderer.invoke('odoo:setStoreValue', key, value),
  openExternalTerminal: (opts: any) => ipcRenderer.invoke('odoo:openExternalTerminal', opts),
});
