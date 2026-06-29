import simpleGit, { SimpleGit, SimpleGitOptions } from 'simple-git';
import { BrowserWindow } from 'electron';

// Cache git instances per repo path to avoid recreating them
const gitInstances = new Map<string, SimpleGit>();

function broadcastTerminalLog(data: any) {
  try {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('git:terminal-log', data);
      }
    }
  } catch (err) {
    console.error('Error broadcasting terminal log:', err);
  }
}

function getGit(repoPath: string): SimpleGit {
  let git = gitInstances.get(repoPath);
  if (!git) {
    const options: Partial<SimpleGitOptions> = {
      baseDir: repoPath,
      binary: 'git',
      maxConcurrentProcesses: 6,
      trimmed: true,
    };
    git = simpleGit(options).outputHandler((command: any, stdout: any, stderr: any, args?: any) => {
      const commandId = Math.random().toString(36).substring(2, 9);
      const argsStr = Array.isArray(args) ? args.join(' ') : '';

      broadcastTerminalLog({
        type: 'start',
        commandId,
        command: `git ${argsStr}`.trim(),
        timestamp: Date.now()
      });

      let stdoutBuffer = '';
      let stderrBuffer = '';
      let updateTimeout: NodeJS.Timeout | null = null;

      const flushBuffers = () => {
        if (stdoutBuffer) {
          broadcastTerminalLog({
            type: 'stdout',
            commandId,
            data: stdoutBuffer
          });
          stdoutBuffer = '';
        }
        if (stderrBuffer) {
          broadcastTerminalLog({
            type: 'stderr',
            commandId,
            data: stderrBuffer
          });
          stderrBuffer = '';
        }
      };

      const queueUpdate = () => {
        if (!updateTimeout) {
          updateTimeout = setTimeout(() => {
            flushBuffers();
            updateTimeout = null;
          }, 80);
        }
      };

      stdout.on('data', (chunk: any) => {
        stdoutBuffer += chunk.toString();
        queueUpdate();
      });

      stderr.on('data', (chunk: any) => {
        stderrBuffer += chunk.toString();
        queueUpdate();
      });

      stdout.on('close', () => {
        if (updateTimeout) {
          clearTimeout(updateTimeout);
          updateTimeout = null;
        }
        flushBuffers();
        broadcastTerminalLog({
          type: 'end',
          commandId
        });
      });
    });
    gitInstances.set(repoPath, git);
  }
  return git;
}

export function removeGitInstance(repoPath: string) {
  gitInstances.delete(repoPath);
}

export async function getStatus(repoPath: string) {
  const git = getGit(repoPath);
  const status = await git.status();

  // Custom separation of staged vs unstaged
  const staged: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];
  const untracked: string[] = [];

  for (const file of status.files) {
    // If it's staged (index has a change character, not ' ' and not '?')
    if (file.index !== ' ' && file.index !== '?') {
      staged.push(file.path);
    }
    // If it has modifications in working tree
    if (file.working_dir === 'M') {
      modified.push(file.path);
    }
    // If it has deletions in working tree
    if (file.working_dir === 'D') {
      deleted.push(file.path);
    }
    // If it is untracked in working tree
    if (file.index === '?' && file.working_dir === '?') {
      untracked.push(file.path);
    }
  }

  return {
    current: status.current,
    tracking: status.tracking || null,
    ahead: status.ahead,
    behind: status.behind,
    modified,
    staged,
    deleted,
    untracked,
    conflicted: status.conflicted,
    isClean: status.isClean(),
  };
}

export async function getAheadBehindCount(repoPath: string, target: string) {
  const git = getGit(repoPath);
  try {
    const aheadStr = await git.raw(['rev-list', '--count', '--max-count=1000', `${target}..HEAD`]);
    const behindStr = await git.raw(['rev-list', '--count', '--max-count=1000', `HEAD..${target}`]);
    return {
      ahead: parseInt(aheadStr.trim(), 10) || 0,
      behind: parseInt(behindStr.trim(), 10) || 0,
    };
  } catch (err) {
    console.error('getAheadBehindCount error:', err);
    return { ahead: 0, behind: 0 };
  }
}

export async function getLog(repoPath: string, opts?: { maxCount?: number; from?: string; to?: string }) {
  const git = getGit(repoPath);
  const logOpts: string[] = ['--format=%H|||%h|||%s|||%an|||%ar|||%D'];

  if (opts?.maxCount) {
    logOpts.push(`-${opts.maxCount}`);
  } else {
    logOpts.push('-50');
  }

  if (opts?.from && opts?.to) {
    logOpts.push(`${opts.from}..${opts.to}`);
  } else if (opts?.from) {
    logOpts.push(opts.from);
  }

  const result = await git.raw(['log', ...logOpts]);
  if (!result.trim()) return [];

  return result.trim().split('\n').map((line: string) => {
    const [hash, hashShort, message, author, date, refs] = line.split('|||');
    return { hash, hashShort, message, author, date, refs: refs || '' };
  });
}

export async function getDiff(repoPath: string, opts?: { base?: string; staged?: boolean; file?: string }) {
  const git = getGit(repoPath);
  const args: string[] = ['diff'];

  if (opts?.staged) {
    args.push('--cached');
  }

  if (opts?.base) {
    try {
      const mergeBase = (await git.raw(['merge-base', opts.base, 'HEAD'])).trim();
      if (mergeBase) {
        args.push(mergeBase);
      } else {
        args.push(`${opts.base}...`);
      }
    } catch {
      args.push(`${opts.base}...`);
    }
  }

  args.push('--numstat');

  if (opts?.file) {
    args.push('--', opts.file);
  }

  const numstatResult = await git.raw(args);
  const files: any[] = [];

  if (numstatResult.trim()) {
    for (const line of numstatResult.trim().split('\n')) {
      const parts = line.split('\t');
      if (parts.length >= 3) {
        const insertions = parts[0] === '-' ? 0 : parseInt(parts[0], 10);
        const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10);
        const file = parts[2];
        files.push({
          file,
          binary: parts[0] === '-',
          insertions,
          deletions,
          chunks: [],
        });
      }
    }
  }

  return files;
}

export async function getDiffRaw(repoPath: string, args: string[]) {
  const git = getGit(repoPath);
  const processedArgs = [...args];
  for (let i = 0; i < processedArgs.length; i++) {
    const arg = processedArgs[i];
    if (arg && arg.endsWith('...')) {
      const base = arg.slice(0, -3);
      try {
        const mergeBase = (await git.raw(['merge-base', base, 'HEAD'])).trim();
        if (mergeBase) {
          processedArgs[i] = mergeBase;
        }
      } catch {}
    }
  }
  return await git.raw(['diff', ...processedArgs]);
}

export async function getBranches(repoPath: string) {
  const git = getGit(repoPath);

  // Get local branches with last commit info
  const localResult = await git.raw([
    'branch', '-v', '--no-color', '--format=%(refname:short)|||%(objectname:short)|||%(HEAD)|||%(worktreepath)'
  ]);

  const local = localResult.trim().split('\n').filter(Boolean).map((line: string) => {
    const [name, commit, head, workTree] = line.split('|||');
    return {
      name: name.trim(),
      current: head.trim() === '*',
      linkedWorkTree: !!workTree?.trim(),
      commit: commit.trim(),
      label: name.trim(),
    };
  });

  // Get remote branches
  const remoteResult = await git.raw([
    'branch', '-r', '--no-color', '--format=%(refname:short)|||%(objectname:short)'
  ]);

  const remoteMap = new Map<string, { name: string; commit: string; label: string; current: boolean; linkedWorkTree: boolean }[]>();

  if (remoteResult.trim()) {
    for (const line of remoteResult.trim().split('\n').filter(Boolean)) {
      const [fullName, commit] = line.split('|||');
      if (fullName.includes('/HEAD')) continue;
      const slashIndex = fullName.indexOf('/');
      const remoteName = fullName.substring(0, slashIndex);
      const branchName = fullName.substring(slashIndex + 1);

      if (!remoteMap.has(remoteName)) {
        remoteMap.set(remoteName, []);
      }
      remoteMap.get(remoteName)!.push({
        name: fullName.trim(),
        current: false,
        linkedWorkTree: false,
        commit: commit.trim(),
        label: branchName.trim(),
      });
    }
  }

  const remotes = Array.from(remoteMap.entries()).map(([remote, branches]) => ({
    remote,
    branches,
  }));

  return { local, remotes };
}

export async function getRemotes(repoPath: string) {
  const git = getGit(repoPath);
  const result = await git.raw(['remote', '-v']);
  const remoteMap = new Map<string, { name: string; fetchUrl: string; pushUrl: string }>();

  for (const line of result.trim().split('\n').filter(Boolean)) {
    const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
    if (match) {
      const [, name, url, type] = match;
      if (!remoteMap.has(name)) {
        remoteMap.set(name, { name, fetchUrl: '', pushUrl: '' });
      }
      const remote = remoteMap.get(name)!;
      if (type === 'fetch') remote.fetchUrl = url;
      else remote.pushUrl = url;
    }
  }

  return Array.from(remoteMap.values());
}

export async function setRemoteUrl(repoPath: string, remote: string, url: string, isPush?: boolean) {
  const git = getGit(repoPath);
  const args = ['remote', 'set-url'];
  if (isPush) {
    args.push('--push');
  }
  args.push(remote, url);
  await git.raw(args);
}

export async function addRemote(repoPath: string, name: string, url: string) {
  const git = getGit(repoPath);
  await git.raw(['remote', 'add', name, url]);
}

export async function renameRemote(repoPath: string, oldName: string, newName: string) {
  const git = getGit(repoPath);
  await git.raw(['remote', 'rename', '--progress', oldName, newName]);
}

export async function deleteRemote(repoPath: string, name: string) {
  const git = getGit(repoPath);
  await git.raw(['remote', 'remove', name]);
}

export async function deleteRemoteBranch(repoPath: string, remote: string, branch: string) {
  const git = getGit(repoPath);
  await git.raw(['push', '--progress', remote, '--delete', branch]);
}

export async function checkout(repoPath: string, branch: string) {
  const git = getGit(repoPath);
  await git.checkout(branch);
}

export async function checkoutNew(repoPath: string, branch: string, startPoint: string) {
  const git = getGit(repoPath);
  await git.checkoutBranch(branch, startPoint);
}

export async function fetchRemote(repoPath: string, remote: string) {
  const git = getGit(repoPath);
  await git.fetch(remote);
}

export async function fetchAll(repoPath: string) {
  const remotesList = await getRemotes(repoPath);
  const errors: string[] = [];
  const git = getGit(repoPath);
  for (const r of remotesList) {
    try {
      await git.fetch(r.name);
    } catch (e: any) {
      errors.push(`${r.name}: ${e.message || e}`);
    }
  }
  return { success: errors.length === 0, errors };
}

export async function renameBranch(repoPath: string, oldName: string, newName: string) {
  const git = getGit(repoPath);
  await git.raw(['branch', '-m', oldName, newName]);
}

export async function deleteBranch(repoPath: string, name: string, force: boolean) {
  const git = getGit(repoPath);
  await git.raw(['branch', force ? '-D' : '-d', name]);
}

export async function resetHard(repoPath: string) {
  const git = getGit(repoPath);
  await git.raw(['reset', '--hard', 'HEAD']);
  await git.raw(['clean', '-fd']);
}

export async function push(repoPath: string, remote: string, branch: string, opts?: { force?: boolean; forceWithLease?: boolean }) {
  const git = getGit(repoPath);
  const args = ['push', remote, branch];

  if (opts?.forceWithLease) {
    args.splice(1, 0, '--force-with-lease');
  } else if (opts?.force) {
    args.splice(1, 0, '--force');
  }

  try {
    await git.raw(args);
    return { success: true, message: `Pushed to ${remote}/${branch}` };
  } catch (e: any) {
    return { success: false, message: e.message || 'Push failed' };
  }
}

export async function pull(repoPath: string, remote: string, branch: string, opts?: { rebase?: boolean }) {
  const git = getGit(repoPath);
  const args = ['pull'];
  if (opts?.rebase) args.push('--rebase');
  args.push(remote, branch);
  await git.raw(args);
}

export async function rebase(repoPath: string, onto: string) {
  const git = getGit(repoPath);
  try {
    await git.rebase([onto]);
    return { success: true, conflicts: [] };
  } catch (e: any) {
    const status = await git.status();
    return { success: false, conflicts: status.conflicted };
  }
}

export async function rebaseAbort(repoPath: string) {
  const git = getGit(repoPath);
  await git.rebase(['--abort']);
}

export async function rebaseContinue(repoPath: string) {
  const git = getGit(repoPath);
  await git.rebase(['--continue']);
}

export async function stash(repoPath: string, message?: string, includeUntracked?: boolean) {
  const git = getGit(repoPath);
  const args = ['stash', 'push'];
  if (message) {
    args.push('-m', message);
  }
  if (includeUntracked) {
    args.push('-u');
  }
  await git.raw(args);
}

export async function stashList(repoPath: string) {
  const git = getGit(repoPath);
  const result = await git.raw(['stash', 'list', '--format=%gd|||%H|||%s|||%ar']);
  if (!result.trim()) return [];

  return result.trim().split('\n').map((line: string) => {
    const [ref, hash, message, date] = line.split('|||');
    const indexMatch = ref.match(/stash@\{(\d+)\}/);
    const branchMatch = message.match(/On (\S+):/);
    return {
      index: indexMatch ? parseInt(indexMatch[1], 10) : 0,
      hash,
      message: message.replace(/^[^:]+:\s*/, ''),
      date,
      branch: branchMatch ? branchMatch[1] : '',
    };
  });
}

export async function stashApply(repoPath: string, index: number) {
  const git = getGit(repoPath);
  await git.raw(['stash', 'apply', `stash@{${index}}`]);
}

export async function stashPop(repoPath: string, index: number) {
  const git = getGit(repoPath);
  await git.raw(['stash', 'pop', `stash@{${index}}`]);
}

export async function stashDrop(repoPath: string, index: number) {
  const git = getGit(repoPath);
  await git.raw(['stash', 'drop', `stash@{${index}}`]);
}

export async function stashShow(repoPath: string, index: number) {
  const git = getGit(repoPath);
  const result = await git.raw(['stash', 'show', '-p', '--numstat', `stash@{${index}}`]);
  // Return numstat only for the file list
  const numstat = await git.raw(['stash', 'show', '--numstat', `stash@{${index}}`]);
  const files: any[] = [];
  for (const line of numstat.trim().split('\n').filter(Boolean)) {
    const parts = line.split('\t');
    if (parts.length >= 3) {
      files.push({
        file: parts[2],
        binary: parts[0] === '-',
        insertions: parts[0] === '-' ? 0 : parseInt(parts[0], 10),
        deletions: parts[1] === '-' ? 0 : parseInt(parts[1], 10),
        chunks: [],
      });
    }
  }
  return files;
}

export async function cherryPick(repoPath: string, commits: string[]) {
  const git = getGit(repoPath);
  try {
    for (const commit of commits) {
      await git.raw(['cherry-pick', commit]);
    }
    return { success: true, conflicts: [], message: `Cherry-picked ${commits.length} commit(s)` };
  } catch (e: any) {
    const status = await git.status();
    return { success: false, conflicts: status.conflicted, message: e.message || 'Cherry-pick failed' };
  }
}

export async function cherryPickAbort(repoPath: string) {
  const git = getGit(repoPath);
  await git.raw(['cherry-pick', '--abort']);
}

export async function cherryPickContinue(repoPath: string) {
  const git = getGit(repoPath);
  await git.raw(['cherry-pick', '--continue']);
}

export async function commitChanges(repoPath: string, message: string) {
  const git = getGit(repoPath);
  await git.commit(message);
}

export async function amend(repoPath: string, message: string) {
  const git = getGit(repoPath);
  await git.raw(['commit', '--amend', '-m', message]);
}

export async function amendNoEdit(repoPath: string) {
  const git = getGit(repoPath);
  await git.raw(['commit', '--amend', '--no-edit']);
}

export async function stage(repoPath: string, files: string[]) {
  const git = getGit(repoPath);
  await git.add(files);
}

export async function unstage(repoPath: string, files: string[]) {
  const git = getGit(repoPath);
  await git.raw(['reset', 'HEAD', '--', ...files]);
}

export async function discardChanges(repoPath: string, files: string[]) {
  const git = getGit(repoPath);
  await git.checkout(['--', ...files]);
}

export async function getLastCommitMessage(repoPath: string) {
  const git = getGit(repoPath);
  return await git.raw(['log', '-1', '--format=%B']);
}

export async function grepSearch(
  repoPath: string,
  opts: {
    query: string;
    revisions?: string[];
    paths?: string[];
    caseInsensitive?: boolean;
    useRegex?: boolean;
  }
) {
  const git = getGit(repoPath);
  const args = ['grep', '-n', '-I'];

  if (opts.caseInsensitive) {
    args.push('-i');
  }

  if (opts.useRegex !== false) {
    args.push('-E');
  }

  args.push('-e', opts.query);

  if (opts.revisions && opts.revisions.length > 0) {
    args.push(...opts.revisions);
  } else {
    args.push('--untracked');
  }

  args.push('--');

  if (opts.paths && opts.paths.length > 0) {
    args.push(...opts.paths);
  } else {
    args.push('.');
  }

  try {
    const result = await git.raw(args);
    if (!result.trim()) return [];

    return result.trim().split('\n').map((line: string) => {
      if (opts.revisions && opts.revisions.length > 0) {
        let matchedRev: string | undefined;
        let rest = line;
        for (const rev of opts.revisions) {
          if (line.startsWith(`${rev}:`)) {
            matchedRev = rev;
            rest = line.substring(rev.length + 1);
            break;
          }
        }
        const colonIndex1 = rest.indexOf(':');
        if (colonIndex1 !== -1) {
          const file = rest.substring(0, colonIndex1);
          const afterFile = rest.substring(colonIndex1 + 1);
          const colonIndex2 = afterFile.indexOf(':');
          if (colonIndex2 !== -1) {
            const lineNumStr = afterFile.substring(0, colonIndex2);
            const content = afterFile.substring(colonIndex2 + 1);
            const lineNum = parseInt(lineNumStr, 10);
            if (!isNaN(lineNum)) {
              return {
                revision: matchedRev,
                file,
                line: lineNum,
                content,
              };
            }
          }
        }
      }

      const colonIndex1 = line.indexOf(':');
      if (colonIndex1 !== -1) {
        const file = line.substring(0, colonIndex1);
        const afterFile = line.substring(colonIndex1 + 1);
        const colonIndex2 = afterFile.indexOf(':');
        if (colonIndex2 !== -1) {
          const lineNumStr = afterFile.substring(0, colonIndex2);
          const content = afterFile.substring(colonIndex2 + 1);
          const lineNum = parseInt(lineNumStr, 10);
          if (!isNaN(lineNum)) {
            return {
              file,
              line: lineNum,
              content,
            };
          }
        }
      }

      return {
        file: 'unknown',
        line: 0,
        content: line,
      };
    });
  } catch (e: any) {
    if (e.message?.includes('exit code 1') || e.stderr?.includes('exit code 1') || e.message?.includes('status 1')) {
      return [];
    }
    throw e;
  }
}

export async function getRepoFiles(repoPath: string): Promise<string[]> {
  const git = getGit(repoPath);
  try {
    const res = await git.raw(['ls-files']);
    return res.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

export async function grepSearchSingle(
  repoPath: string,
  target: string | undefined,
  opts: {
    query: string;
    paths?: string[];
    caseInsensitive?: boolean;
    useRegex?: boolean;
  }
): Promise<any[]> {
  const git = getGit(repoPath);
  const args = ['grep', '-n', '-I'];

  if (opts.caseInsensitive) {
    args.push('-i');
  }

  if (opts.useRegex !== false) {
    args.push('-E');
  }

  args.push('-e', opts.query);

  if (target) {
    args.push(target);
  } else {
    args.push('--untracked');
  }

  args.push('--');

  if (opts.paths && opts.paths.length > 0) {
    args.push(...opts.paths);
  } else {
    args.push('.');
  }

  try {
    const result = await git.raw(args);
    if (!result.trim()) return [];

    return result.trim().split('\n').map((line: string) => {
      if (target) {
        if (line.startsWith(`${target}:`)) {
          const rest = line.substring(target.length + 1);
          const colonIndex1 = rest.indexOf(':');
          if (colonIndex1 !== -1) {
            const file = rest.substring(0, colonIndex1);
            const afterFile = rest.substring(colonIndex1 + 1);
            const colonIndex2 = afterFile.indexOf(':');
            if (colonIndex2 !== -1) {
              const lineNumStr = afterFile.substring(0, colonIndex2);
              const content = afterFile.substring(colonIndex2 + 1);
              const lineNum = parseInt(lineNumStr, 10);
              if (!isNaN(lineNum)) {
                return {
                  revision: target,
                  file,
                  line: lineNum,
                  content,
                };
              }
            }
          }
        }
      }

      const colonIndex1 = line.indexOf(':');
      if (colonIndex1 !== -1) {
        const file = line.substring(0, colonIndex1);
        const afterFile = line.substring(colonIndex1 + 1);
        const colonIndex2 = afterFile.indexOf(':');
        if (colonIndex2 !== -1) {
          const lineNumStr = afterFile.substring(0, colonIndex2);
          const content = afterFile.substring(colonIndex2 + 1);
          const lineNum = parseInt(lineNumStr, 10);
          if (!isNaN(lineNum)) {
            return {
              revision: target,
              file,
              line: lineNum,
              content,
            };
          }
        }
      }

      return {
        revision: target,
        file: 'unknown',
        line: 0,
        content: line,
      };
    });
  } catch (e: any) {
    if (e.message?.includes('exit code 1') || e.stderr?.includes('exit code 1') || e.message?.includes('status 1')) {
      return [];
    }
    throw e;
  }
}

export async function cloneRepo(cloneUrl: string, targetPath: string): Promise<void> {
  const options: Partial<SimpleGitOptions> = {
    binary: 'git',
    trimmed: true,
  };
  const git = simpleGit(options).outputHandler((command: any, stdout: any, stderr: any, args?: any) => {
    const commandId = Math.random().toString(36).substring(2, 9);
    const argsStr = Array.isArray(args) ? args.join(' ') : '';

    broadcastTerminalLog({
      type: 'start',
      commandId,
      command: `git ${argsStr}`.trim(),
      timestamp: Date.now()
    });

    stdout.on('data', (chunk: Buffer) => {
      broadcastTerminalLog({
        type: 'stdout',
        commandId,
        data: chunk.toString(),
      });
    });

    stderr.on('data', (chunk: Buffer) => {
      broadcastTerminalLog({
        type: 'stderr',
        commandId,
        data: chunk.toString(),
      });
    });

    stdout.on('close', () => {
      broadcastTerminalLog({
        type: 'close',
        commandId,
        code: 0,
      });
    });
  });

  await git.clone(cloneUrl, targetPath);
}
