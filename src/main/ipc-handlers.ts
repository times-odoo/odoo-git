import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as gitBridge from './git-bridge';
import { getSettings, saveSettings, applyGitCredentials, store } from './store';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, exec, ChildProcess } from 'child_process';

let currentSearchSessionId = '';
let odooProcess: ChildProcess | null = null;
let currentCmd: string | undefined = undefined;
let odooStatus: 'starting' | 'running' | 'stopped' = 'stopped';
function buildOdooCommand(opts: any): { execCmd: string; execArgs: string[]; fullCommandString: string } {
  const args: string[] = [];
  
  // DB Config
  if (opts.dbUser) {
    args.push(`--db_user=${opts.dbUser}`);
  }
  if (opts.dbHost) {
    args.push(`--db_host=${opts.dbHost}`);
  }
  if (opts.dbPassword) {
    args.push(`--db_password=${opts.dbPassword}`);
  }
  
  // Addons path
  const addons = opts.addonsPath || 'addons,../enterprise';
  args.push(`--addons-path=${addons}`);

  // Port
  if (opts.port !== undefined) {
    args.push(`--http-port=${opts.port}`);
  }

  // Dev
  if (opts.devAll) {
    args.push('--dev=all');
  }

  // Demo
  if (opts.withDemo === true) {
    args.push('--with-demo');
  } else if (opts.withDemo === false) {
    args.push('--without-demo');
  }

  // DB Name
  if (opts.dbName) {
    args.push('-d');
    args.push(opts.dbName);
  }

  if (opts.commandType === 'run') {
    if (opts.initModules) {
      args.push('-i');
      args.push(opts.initModules);
    }
    if (opts.updateModules) {
      args.push('-u');
      args.push(opts.updateModules);
    }
    if (opts.moduleName && !opts.updateModules) {
      args.push('-u');
      args.push(opts.moduleName);
    }
  } else if (opts.commandType === 'upgrade') {
    const upgradePath = opts.upgradePaths || '../upgrade-util/src,../upgrade/migrations';
    args.push(`--upgrade-path=${upgradePath}`);
    if (opts.updateModules) {
      args.push('-u');
      args.push(opts.updateModules);
    } else {
      args.push('-u all');
    }
  } else if (opts.commandType === 'test') {
    args.push('--test-enable');
    if (opts.initModules) {
      args.push('-i');
      args.push(opts.initModules);
    } else if (opts.moduleName) {
      args.push('-i');
      args.push(opts.moduleName);
    }
    if (opts.testTags) {
      args.push(`--test-tags=${opts.testTags}`);
    }
  }

  if (opts.stopAfterInit) {
    args.push('--stop-after-init');
  }

  if (opts.customArgs) {
    const parts = opts.customArgs.split(/\s+/).filter(Boolean);
    args.push(...parts);
  }

  let execCmd = './odoo-bin';
  let execArgs = args;

  if (opts.venvPath) {
    let pythonBinary = path.join(opts.venvPath, 'bin', 'python');
    if (!fs.existsSync(pythonBinary)) {
      pythonBinary = opts.venvPath;
    }
    execCmd = pythonBinary;
    execArgs = ['./odoo-bin', ...args];
  }

  const fullCommandString = `${execCmd} ${execArgs.join(' ')}`;
  return { execCmd, execArgs, fullCommandString };
}

export function registerIpcHandlers() {
  // Git operations
  ipcMain.handle('git:status', async (_e, repoPath: string) => {
    return await gitBridge.getStatus(repoPath);
  });

  ipcMain.handle('git:log', async (_e, repoPath: string, opts?: { maxCount?: number; from?: string; to?: string }) => {
    return await gitBridge.getLog(repoPath, opts);
  });

  ipcMain.handle('git:diff', async (_e, repoPath: string, opts?: { base?: string; staged?: boolean; file?: string }) => {
    return await gitBridge.getDiff(repoPath, opts);
  });

  ipcMain.handle('git:diffRaw', async (_e, repoPath: string, args: string[]) => {
    return await gitBridge.getDiffRaw(repoPath, args);
  });

  ipcMain.handle('git:branches', async (_e, repoPath: string) => {
    return await gitBridge.getBranches(repoPath);
  });

  ipcMain.handle('git:remotes', async (_e, repoPath: string) => {
    return await gitBridge.getRemotes(repoPath);
  });

  ipcMain.handle('git:setRemoteUrl', async (_e, repoPath: string, remote: string, url: string, isPush?: boolean) => {
    await gitBridge.setRemoteUrl(repoPath, remote, url, isPush);
  });

  ipcMain.handle('git:addRemote', async (_e, repoPath: string, name: string, url: string) => {
    await gitBridge.addRemote(repoPath, name, url);
  });

  ipcMain.handle('git:renameRemote', async (_e, repoPath: string, oldName: string, newName: string) => {
    await gitBridge.renameRemote(repoPath, oldName, newName);
  });

  ipcMain.handle('git:deleteRemote', async (_e, repoPath: string, name: string) => {
    await gitBridge.deleteRemote(repoPath, name);
  });

  ipcMain.handle('git:deleteRemoteBranch', async (_e, repoPath: string, remote: string, branch: string) => {
    await gitBridge.deleteRemoteBranch(repoPath, remote, branch);
  });

  ipcMain.handle('git:checkout', async (_e, repoPath: string, branch: string) => {
    await gitBridge.checkout(repoPath, branch);
  });

  ipcMain.handle('git:checkoutNew', async (_e, repoPath: string, branch: string, startPoint: string) => {
    await gitBridge.checkoutNew(repoPath, branch, startPoint);
  });

  ipcMain.handle('git:fetch', async (_e, repoPath: string, remote: string) => {
    await gitBridge.fetchRemote(repoPath, remote);
  });

  ipcMain.handle('git:fetchAll', async (_e, repoPath: string) => {
    return await gitBridge.fetchAll(repoPath);
  });

  ipcMain.handle('git:renameBranch', async (_e, repoPath: string, oldName: string, newName: string) => {
    await gitBridge.renameBranch(repoPath, oldName, newName);
  });

  ipcMain.handle('git:deleteBranch', async (_e, repoPath: string, name: string, force: boolean) => {
    await gitBridge.deleteBranch(repoPath, name, force);
  });

  ipcMain.handle('git:resetHard', async (_e, repoPath: string) => {
    await gitBridge.resetHard(repoPath);
  });

  ipcMain.handle('git:push', async (_e, repoPath: string, remote: string, branch: string, opts?: { force?: boolean; forceWithLease?: boolean }) => {
    return await gitBridge.push(repoPath, remote, branch, opts);
  });

  ipcMain.handle('git:pull', async (_e, repoPath: string, remote: string, branch: string, opts?: { rebase?: boolean }) => {
    await gitBridge.pull(repoPath, remote, branch, opts);
  });

  ipcMain.handle('git:rebase', async (_e, repoPath: string, onto: string) => {
    return await gitBridge.rebase(repoPath, onto);
  });

  ipcMain.handle('git:rebaseAbort', async (_e, repoPath: string) => {
    await gitBridge.rebaseAbort(repoPath);
  });

  ipcMain.handle('git:rebaseContinue', async (_e, repoPath: string) => {
    await gitBridge.rebaseContinue(repoPath);
  });

  ipcMain.handle('git:stash', async (_e, repoPath: string, message?: string, includeUntracked?: boolean) => {
    await gitBridge.stash(repoPath, message, includeUntracked);
  });

  ipcMain.handle('git:stashList', async (_e, repoPath: string) => {
    return await gitBridge.stashList(repoPath);
  });

  ipcMain.handle('git:stashApply', async (_e, repoPath: string, index: number) => {
    await gitBridge.stashApply(repoPath, index);
  });

  ipcMain.handle('git:stashPop', async (_e, repoPath: string, index: number) => {
    await gitBridge.stashPop(repoPath, index);
  });

  ipcMain.handle('git:stashDrop', async (_e, repoPath: string, index: number) => {
    await gitBridge.stashDrop(repoPath, index);
  });

  ipcMain.handle('git:stashShow', async (_e, repoPath: string, index: number) => {
    return await gitBridge.stashShow(repoPath, index);
  });

  ipcMain.handle('git:cherryPick', async (_e, repoPath: string, commits: string[]) => {
    return await gitBridge.cherryPick(repoPath, commits);
  });

  ipcMain.handle('git:cherryPickAbort', async (_e, repoPath: string) => {
    await gitBridge.cherryPickAbort(repoPath);
  });

  ipcMain.handle('git:cherryPickContinue', async (_e, repoPath: string) => {
    await gitBridge.cherryPickContinue(repoPath);
  });

  ipcMain.handle('git:commit', async (_e, repoPath: string, message: string) => {
    await gitBridge.commitChanges(repoPath, message);
  });

  ipcMain.handle('git:amend', async (_e, repoPath: string, message: string) => {
    await gitBridge.amend(repoPath, message);
  });

  ipcMain.handle('git:amendNoEdit', async (_e, repoPath: string) => {
    await gitBridge.amendNoEdit(repoPath);
  });

  ipcMain.handle('git:stage', async (_e, repoPath: string, files: string[]) => {
    await gitBridge.stage(repoPath, files);
  });

  ipcMain.handle('git:unstage', async (_e, repoPath: string, files: string[]) => {
    await gitBridge.unstage(repoPath, files);
  });

  ipcMain.handle('git:discardChanges', async (_e, repoPath: string, files: string[]) => {
    await gitBridge.discardChanges(repoPath, files);
  });

  ipcMain.handle('git:getLastCommitMessage', async (_e, repoPath: string) => {
    return await gitBridge.getLastCommitMessage(repoPath);
  });

  ipcMain.handle('git:grepSearch', async (_e, repoPath: string, opts: any) => {
    return await gitBridge.grepSearch(repoPath, opts);
  });

  ipcMain.handle('git:grepSearchStream', async (event, repoPath: string, opts: any) => {
    currentSearchSessionId = opts.sessionId;
    const targets = opts.revisions && opts.revisions.length > 0 ? opts.revisions : [undefined];

    (async () => {
      for (const target of targets) {
        if (currentSearchSessionId !== opts.sessionId) {
          break;
        }

        const revName = target || 'Working Tree';
        event.sender.send('git:grep-start', {
          sessionId: opts.sessionId,
          revision: revName,
        });

        try {
          const results = await gitBridge.grepSearchSingle(repoPath, target, {
            query: opts.query,
            paths: opts.paths,
            caseInsensitive: opts.caseInsensitive,
            useRegex: opts.useRegex,
          });

          if (currentSearchSessionId === opts.sessionId) {
            event.sender.send('git:grep-result', {
              sessionId: opts.sessionId,
              revision: revName,
              results,
            });
          }
        } catch (e: any) {
          if (currentSearchSessionId === opts.sessionId) {
            event.sender.send('git:grep-result', {
              sessionId: opts.sessionId,
              revision: revName,
              results: [],
              error: e.message || 'Search failed',
            });
          }
        }

        // Wait 150ms between versions to ensure the UI renders them incrementally
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    })();

    return { started: true };
  });

  ipcMain.handle('git:getRepoFiles', async (_e, repoPath: string) => {
    return await gitBridge.getRepoFiles(repoPath);
  });

  ipcMain.handle('git:clone', async (_e, cloneUrl: string, targetPath: string) => {
    return await gitBridge.cloneRepo(cloneUrl, targetPath);
  });

  // Grammar check via LanguageTool public API
  ipcMain.handle('app:checkGrammar', async (_e, text: string) => {
    try {
      const params = new URLSearchParams();
      params.append('text', text);
      params.append('language', 'en-US');
      params.append('level', 'picky');
      const response = await fetch('https://api.languagetoolplus.com/v2/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      if (!response.ok) {
        return { success: false, matches: [], error: `API returned ${response.status}` };
      }
      const data = await response.json();
      return { success: true, matches: data.matches || [] };
    } catch (err: any) {
      return { success: false, matches: [], error: err.message || 'Network error' };
    }
  });

  // App operations
  ipcMain.handle('app:selectDirectory', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select Git Repository',
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('app:getSettings', async () => {
    return getSettings();
  });

  ipcMain.handle('app:saveSettings', async (_e, settings: any) => {
    saveSettings(settings);
  });

  ipcMain.handle('app:saveGithubPat', async (_e, username: string, pat: string) => {
    saveSettings({ githubUsername: username, githubPat: pat });
    applyGitCredentials(username, pat);
  });

  ipcMain.handle('app:testGithubPat', async (_e, pat: string) => {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'OdooGit-App',
        },
      });
      if (response.ok) {
        const data = await response.json();
        return { success: true, login: data.login, name: data.name || data.login };
      }
      return { success: false, login: '', name: '', error: `GitHub returned ${response.status}` };
    } catch (err: any) {
      return { success: false, login: '', name: '', error: err.message || 'Network error' };
    }
  });

  ipcMain.handle('app:getOdooModules', async (_e, repoPath: string) => {
    try {
      const modules = new Set<string>();
      const communityAddonsPath = path.join(repoPath, 'addons');
      const odooAddonsPath = path.join(repoPath, 'odoo', 'addons');
      let hasAddonsDir = false;

      const isValidModuleDir = (name: string) => 
        !name.startsWith('.') && 
        !name.startsWith('__') && 
        name !== 'node_modules';

      if (fs.existsSync(communityAddonsPath)) {
        const stat = fs.statSync(communityAddonsPath);
        if (stat.isDirectory()) {
          hasAddonsDir = true;
          const subdirs = fs.readdirSync(communityAddonsPath);
          for (const subdir of subdirs) {
            if (isValidModuleDir(subdir)) {
              try {
                if (fs.statSync(path.join(communityAddonsPath, subdir)).isDirectory()) {
                  modules.add(subdir);
                }
              } catch {}
            }
          }
        }
      }

      if (fs.existsSync(odooAddonsPath)) {
        const stat = fs.statSync(odooAddonsPath);
        if (stat.isDirectory()) {
          hasAddonsDir = true;
          const subdirs = fs.readdirSync(odooAddonsPath);
          for (const subdir of subdirs) {
            if (isValidModuleDir(subdir)) {
              try {
                if (fs.statSync(path.join(odooAddonsPath, subdir)).isDirectory()) {
                  modules.add(subdir);
                }
              } catch {}
            }
          }
        }
      }

      if (!hasAddonsDir) {
        const subdirs = fs.readdirSync(repoPath);
        for (const subdir of subdirs) {
          if (isValidModuleDir(subdir)) {
            try {
              if (fs.statSync(path.join(repoPath, subdir)).isDirectory()) {
                modules.add(subdir);
              }
            } catch {}
          }
        }
      }

      return Array.from(modules).sort();
    } catch (err) {
      console.error('getOdooModules error:', err);
      return [];
    }
  });

  // Window controls
  ipcMain.on('window:minimize', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.minimize();
  });

  ipcMain.on('window:maximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });

  ipcMain.on('window:close', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close();
  });

  // Odoo DB operations
  ipcMain.handle('odoo:listDbs', async (_e, dbUser?: string, dbHost?: string, dbPassword?: string) => {
    let cmd = '';
    const encodedPass = dbPassword ? encodeURIComponent(dbPassword) : '';
    if (dbPassword) {
      const hostPart = dbHost ? `${dbHost}` : '127.0.0.1';
      cmd = `psql -w "postgresql://${dbUser || 'odoo'}:${encodedPass}@${hostPart}/postgres" -t -A -c "SELECT datname FROM pg_database WHERE datallowconn = true ORDER BY datname"`;
    } else {
      const userArg = dbUser ? `-U ${dbUser}` : '';
      const hostArg = dbHost ? `-h ${dbHost}` : '';
      cmd = `psql -w ${userArg} ${hostArg} -d postgres -t -A -c "SELECT datname FROM pg_database WHERE datallowconn = true ORDER BY datname"`;
    }
    
    console.log('[odoo:listDbs] Call details:', { dbUser, dbHost, hasPassword: !!dbPassword, passwordLength: dbPassword ? dbPassword.length : 0 });
    console.log('[odoo:listDbs] Executing command:', cmd);
    
    return new Promise<string[]>((resolve, reject) => {
      exec(cmd, { env: { ...process.env, PGPASSWORD: dbPassword || '' } }, (err, stdout, stderr) => {
        if (err) {
          console.error('[odoo:listDbs] Primary command failed:', { cmd, stderr: stderr || '', error: err.message });
          // Fallback to passwordless local Unix socket psql
          const fallbackCmd = `psql -w -d postgres -t -A -c "SELECT datname FROM pg_database WHERE datallowconn = true ORDER BY datname"`;
          console.log('[odoo:listDbs] Trying fallback command:', fallbackCmd);
          exec(fallbackCmd, { env: process.env }, (err2, stdout2, stderr2) => {
            if (err2) {
              console.error('[odoo:listDbs] Fallback command failed:', { cmd: fallbackCmd, stderr: stderr2 || '', error: err2.message });
              const isAuthFail = (stderr || '').includes('password') || err.message.includes('password') || (stderr || '').includes('no password') ||
                                 (stderr2 || '').includes('password') || err2.message.includes('password') || (stderr2 || '').includes('no password');
              if (isAuthFail) {
                reject(new Error('password_required'));
              } else {
                reject(new Error(stderr2 || 'Failed to list databases.'));
              }
            } else {
              const pgDbs = stdout2.trim().split('\n').filter(Boolean);
              const pendingDbs = (store.get('pendingDbs') as string[]) || [];
              const newPending = pendingDbs.filter(db => !pgDbs.includes(db));
              if (newPending.length !== pendingDbs.length) {
                store.set('pendingDbs', newPending);
              }
              const merged = Array.from(new Set([...pgDbs, ...newPending])).sort((a, b) => a.localeCompare(b));
              resolve(merged);
            }
          });
        } else {
          const pgDbs = stdout.trim().split('\n').filter(Boolean);
          const pendingDbs = (store.get('pendingDbs') as string[]) || [];
          const newPending = pendingDbs.filter(db => !pgDbs.includes(db));
          if (newPending.length !== pendingDbs.length) {
            store.set('pendingDbs', newPending);
          }
          const merged = Array.from(new Set([...pgDbs, ...newPending])).sort((a, b) => a.localeCompare(b));
          resolve(merged);
        }
      });
    });
  });

  ipcMain.handle('odoo:createDb', async (_e, dbName: string, templateName?: string, dbUser?: string, dbHost?: string, dbPassword?: string) => {
    if (!templateName) {
      console.log(`[odoo:createDb] Non-templated database request: adding ${dbName} to pending list.`);
      const pendingDbs = (store.get('pendingDbs') as string[]) || [];
      if (!pendingDbs.includes(dbName)) {
        pendingDbs.push(dbName);
        store.set('pendingDbs', pendingDbs);
      }
      return Promise.resolve();
    }

    let cmd = '';
    const templateArg = templateName ? `-T ${templateName}` : '';
    if (dbPassword) {
      const encodedPass = encodeURIComponent(dbPassword);
      const hostPart = dbHost ? `${dbHost}` : '127.0.0.1';
      cmd = `createdb -w -d "postgresql://${dbUser || 'odoo'}:${encodedPass}@${hostPart}/postgres" ${templateArg} ${dbName}`;
    } else {
      const userArg = dbUser ? `-U ${dbUser}` : '';
      const hostArg = dbHost ? `-h ${dbHost}` : '';
      cmd = `createdb -w ${userArg} ${hostArg} ${templateArg} ${dbName}`;
    }
    console.log('[odoo:createDb] Executing command:', cmd);
    return new Promise<void>((resolve, reject) => {
      exec(cmd, { env: { ...process.env, PGPASSWORD: dbPassword || '' } }, (err, stdout, stderr) => {
        if (err) {
          console.error('[odoo:createDb] Command failed:', { cmd, stderr: stderr || '', error: err.message });
          // Fallback to passwordless local Unix socket createdb
          const fallbackCmd = `createdb -w ${templateArg} ${dbName}`;
          console.log('[odoo:createDb] Trying fallback command:', fallbackCmd);
          exec(fallbackCmd, { env: process.env }, (err2, stdout2, stderr2) => {
            if (err2) {
              console.error('[odoo:createDb] Fallback failed:', { cmd: fallbackCmd, stderr: stderr2 || '', error: err2.message });
              const isAuthFail = (stderr || '').includes('password') || err.message.includes('password') || (stderr || '').includes('no password') ||
                                 (stderr2 || '').includes('password') || err2.message.includes('password') || (stderr2 || '').includes('no password');
              if (isAuthFail) {
                reject(new Error('password_required'));
              } else {
                reject(new Error(stderr2 || `Failed to create database ${dbName}`));
              }
            } else resolve();
          });
        } else resolve();
      });
    });
  });

  ipcMain.handle('odoo:dropDb', async (_e, dbName: string, dbUser?: string, dbHost?: string, dbPassword?: string) => {
    // Also remove from pendingDbs in store if present
    const pendingDbs = (store.get('pendingDbs') as string[]) || [];
    if (pendingDbs.includes(dbName)) {
      store.set('pendingDbs', pendingDbs.filter(db => db !== dbName));
    }

    let cmd = '';
    if (dbPassword) {
      const encodedPass = encodeURIComponent(dbPassword);
      const hostPart = dbHost ? `${dbHost}` : '127.0.0.1';
      cmd = `dropdb -w -d "postgresql://${dbUser || 'odoo'}:${encodedPass}@${hostPart}/postgres" ${dbName}`;
    } else {
      const userArg = dbUser ? `-U ${dbUser}` : '';
      const hostArg = dbHost ? `-h ${dbHost}` : '';
      cmd = `dropdb -w ${userArg} ${hostArg} ${dbName}`;
    }
    console.log('[odoo:dropDb] Executing command:', cmd);
    return new Promise<void>((resolve, reject) => {
      exec(cmd, { env: { ...process.env, PGPASSWORD: dbPassword || '' } }, (err, stdout, stderr) => {
        if (err) {
          const errMsg = stderr || err.message || '';
          if (errMsg.includes('does not exist')) {
            resolve();
            return;
          }
          console.error('[odoo:dropDb] Command failed:', { cmd, stderr: stderr || '', error: err.message });
          // Fallback to passwordless local Unix socket dropdb
          const fallbackCmd = `dropdb -w ${dbName}`;
          console.log('[odoo:dropDb] Trying fallback command:', fallbackCmd);
          exec(fallbackCmd, { env: process.env }, (err2, stdout2, stderr2) => {
            if (err2) {
              const errMsg2 = stderr2 || err2.message || '';
              if (errMsg2.includes('does not exist')) {
                resolve();
                return;
              }
              console.error('[odoo:dropDb] Fallback failed:', { cmd: fallbackCmd, stderr: stderr2 || '', error: err2.message });
              const isAuthFail = (stderr || '').includes('password') || err.message.includes('password') || (stderr || '').includes('no password') ||
                                 (stderr2 || '').includes('password') || err2.message.includes('password') || (stderr2 || '').includes('no password');
              if (isAuthFail) {
                reject(new Error('password_required'));
              } else {
                reject(new Error(stderr2 || `Failed to drop database ${dbName}`));
              }
            } else resolve();
          });
        } else resolve();
      });
    });
  });

  // Odoo Server operations
  ipcMain.handle('odoo:startServer', async (event, opts: {
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
    addonsPath?: string;
    dbUser?: string;
    dbHost?: string;
    dbPassword?: string;
    initModules?: string;
    updateModules?: string;
  }) => {
    if (odooProcess) {
      event.sender.send('odoo:log', '[App] Stopping already running Odoo server...\n');
      odooProcess.kill('SIGINT');
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const { execCmd, execArgs, fullCommandString } = buildOdooCommand(opts);
    currentCmd = fullCommandString;
    odooStatus = 'starting';

    event.sender.send('odoo:log', `[App] Starting Odoo Server in ${opts.repoPath}...\n`);
    event.sender.send('odoo:log', `[App] Command: ${fullCommandString}\n\n`);
    event.sender.send('odoo:state', { status: 'starting', cmd: fullCommandString });

    // Spawn process
    odooProcess = spawn(execCmd, execArgs, {
      cwd: opts.repoPath,
      shell: true,
      detached: true,
      env: { ...process.env, PYTHONUNBUFFERED: '1', PGPASSWORD: opts.dbPassword || '' }
    });

    odooStatus = 'running';
    event.sender.send('odoo:state', { status: 'running', cmd: fullCommandString });

    odooProcess.stdout?.on('data', (data) => {
      const out = data.toString();
      if (out.includes('Password for user')) {
        odooProcess?.stdin?.write((opts.dbPassword || '') + '\n');
      }
      event.sender.send('odoo:log', out);
    });

    odooProcess.stderr?.on('data', (data) => {
      const out = data.toString();
      if (out.includes('Password for user')) {
        odooProcess?.stdin?.write((opts.dbPassword || '') + '\n');
      }
      event.sender.send('odoo:log', out);
    });

    odooProcess.on('close', (code) => {
      event.sender.send('odoo:log', `\n[App] Odoo process exited with code ${code}\n`);
      event.sender.send('odoo:state', { status: 'stopped', code });
      odooProcess = null;
      odooStatus = 'stopped';
      currentCmd = undefined;
    });

    odooProcess.on('error', (err) => {
      event.sender.send('odoo:log', `\n[App] Odoo process error: ${err.message}\n`);
      event.sender.send('odoo:state', { status: 'stopped', error: err.message });
      odooProcess = null;
      odooStatus = 'stopped';
      currentCmd = undefined;
    });

    return { success: true };
  });

  ipcMain.handle('odoo:stopServer', async (event) => {
    if (odooProcess) {
      event.sender.send('odoo:log', '\n[App] Stopping Odoo Server...\n');
      try {
        odooProcess.stdin?.write('\x03');
      } catch {}
      try {
        if (odooProcess.pid) {
          process.kill(-odooProcess.pid, 'SIGINT');
        }
      } catch {
        try {
          odooProcess.kill('SIGINT');
        } catch {}
      }

      const procToKill = odooProcess;
      setTimeout(() => {
        try {
          if (procToKill.pid) {
            process.kill(-procToKill.pid, 'SIGKILL');
          }
        } catch {
          try {
            procToKill.kill('SIGKILL');
          } catch {}
        }
      }, 3000);
      return true;
    }
    return false;
  });

  ipcMain.handle('odoo:getServerStatus', () => {
    return { status: odooStatus, cmd: currentCmd };
  });

  ipcMain.handle('odoo:openExternalTerminal', async (_e, opts: any) => {
    try {
      const { fullCommandString } = buildOdooCommand(opts);
      const envVars = opts.dbPassword ? `PGPASSWORD=${JSON.stringify(opts.dbPassword)} ` : '';
      const fullCmd = `${envVars}${fullCommandString}`;
      const termArgs = ['--working-directory', opts.repoPath, '--', 'bash', '-c', `${fullCmd}; exec bash`];
      spawn('gnome-terminal', termArgs, { detached: true, stdio: 'ignore' }).unref();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('odoo:getStoreValue', (_e, key: string) => {
    return store.get(key as any);
  });

  ipcMain.handle('odoo:setStoreValue', (_e, key: string, value: any) => {
    store.set(key as any, value);
  });
}

export function cleanUpOdooServer() {
  if (odooProcess) {
    console.log('[App] Cleaning up Odoo Server on exit...');
    try {
      if (odooProcess.pid) {
        process.kill(-odooProcess.pid, 'SIGKILL');
      }
    } catch (e) {
      try {
        odooProcess.kill('SIGKILL');
      } catch {}
    }
    odooProcess = null;
  }
}
