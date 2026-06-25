import React, { useState, useEffect } from 'react';
import { useRepoStore } from '../../store/repos';
import { useGitStore } from '../../store/git';
import { useGit } from '../../hooks/useGit';
import { Badge } from '../shared/Badge';
import { CommitPreview } from './CommitPreview';

const TAGS = [
  'IMP', 'FIX', 'ADD', 'REM', 'REF', 'REV', 'MOV', 'REL',
  'MERGE', 'CLA', 'I18N', 'PERF', 'CLN', 'LINT',
];

export function CommitComposer() {
  const activeRepoPath = useRepoStore((s) => s.activeRepoPath);
  const repoState = useGitStore((s) => (activeRepoPath ? s.repoStates[activeRepoPath] : null));
  const { commitChanges, amendCommit, amendNoEdit, refreshStatus } = useGit(activeRepoPath);

  const [tag, setTag] = useState('IMP');
  const [modules, setModules] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [header, setHeader] = useState('');
  const [body, setBody] = useState('');
  const [isAmend, setIsAmend] = useState(false);

  const [allModules, setAllModules] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!activeRepoPath) {
      setAllModules([]);
      return;
    }
    window.git.getOdooModules(activeRepoPath).then(setAllModules);
  }, [activeRepoPath]);

  const modulesString = modules.join(', ');
  const prefix = `[${tag}] ${modulesString ? modulesString + ': ' : ''}`;
  const maxHeaderLength = Math.max(0, 70 - prefix.length);
  const headerLength = header.trim().length;
  const headerColor =
    headerLength > maxHeaderLength ? 'text-danger' :
    headerLength > Math.max(0, maxHeaderLength - 5) ? 'text-warning' : 'text-muted';

  const fullHeader = `${prefix}${header.trim()}`;

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
      setModules([...modules, trimmed]);
    }
    setInputValue('');
    setFocusedIndex(-1);
    setShowSuggestions(false);
  };

  const removeModule = (modName: string) => {
    setModules(modules.filter((m) => m !== modName));
  };

  const status = repoState?.status;
  const hasStagedChanges = (status?.staged?.length || 0) > 0;

  const fullMessage = `${fullHeader}${body.trim() ? '\n\n' + body.trim() : ''}`;

  const bodyLines = body.split('\n');
  const longLines = bodyLines
    .map((line, idx) => ({ line: idx + 1, length: line.length }))
    .filter((item) => item.length > 80);

  const handleCommit = async () => {
    if (!header.trim() || modules.length === 0) return;
    if (isAmend) {
      await amendCommit(fullMessage);
    } else {
      await commitChanges(fullMessage);
    }
    // Reset form
    setHeader('');
    setBody('');
    setModules([]);
    setIsAmend(false);
  };

  const handleAmendNoEdit = async () => {
    await amendNoEdit();
  };

  const loadLastCommit = async () => {
    if (!activeRepoPath) return;
    try {
      const msg = await window.git.getLastCommitMessage(activeRepoPath);
      // Parse [TAG] module: header
      const match = msg.match(/^\[(\w+)\]\s*([^:]+?):\s*(.+?)(?:\n\n([\s\S]*))?$/);
      if (match) {
        setTag(match[1]);
        const parsedModules = match[2]
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean);
        setModules(parsedModules);
        setHeader(match[3].trim());
        setBody(match[4]?.trim() || '');
      } else {
        // Non-standard format
        const lines = msg.split('\n');
        setHeader(lines[0].trim());
        setBody(lines.slice(2).join('\n').trim());
        setModules([]);
      }
      setIsAmend(true);
    } catch {}
  };

  const isValid = header.trim().length > 0 && modules.length > 0 && headerLength <= maxHeaderLength;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 space-y-3 overflow-y-auto flex-1">
        <h3 className="section-header">
          {isAmend ? 'AMEND COMMIT' : 'NEW COMMIT'}
        </h3>

        {/* Staged file count */}
        {!isAmend && (
          <div className={`text-[12px] ${hasStagedChanges ? 'text-success' : 'text-warning'}`}>
            {hasStagedChanges
              ? `${status?.staged?.length} file(s) staged`
              : 'No files staged — stage changes first'
            }
          </div>
        )}

        {/* Tag */}
        <div>
          <label className="text-[12px] text-muted mb-1 block">Tag</label>
          <div className="flex flex-wrap gap-1.5">
            {TAGS.map((t) => (
              <button
                key={t}
                className={`transition-all ${tag === t ? '' : 'opacity-35 hover:opacity-65'}`}
                onClick={() => setTag(t)}
              >
                <Badge tag={t} size="lg" />
              </button>
            ))}
          </div>
        </div>

        {/* Module */}
        <div className="relative">
          <label className="text-[12px] text-muted mb-1 block">Module</label>
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#0D1117] border border-border rounded focus-within:border-accent/70 transition-colors w-full cursor-text min-h-[36px]">
            {modules.map((m) => (
              <span
                key={m}
                className="inline-flex items-center gap-1 bg-accent/15 text-accent font-semibold px-2 py-0.5 rounded text-[11px] font-mono select-none"
              >
                {m}
                <button
                  type="button"
                  className="text-danger hover:scale-120 transition-all font-extrabold text-[15px] leading-none shrink-0 ml-1.5"
                  onClick={() => removeModule(m)}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              type="text"
              className="bg-transparent border-none outline-none flex-1 min-w-[120px] text-primary text-[12px] font-mono p-0 h-[22px]"
              placeholder={modules.length === 0 ? "account_reports, *" : ""}
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
                  setModules(modules.slice(0, -1));
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

        {/* Header */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[12px] text-muted">Header</label>
            <span className={`text-[11px] font-mono ${headerColor}`}>
              Header: {headerLength}/{maxHeaderLength}
            </span>
          </div>
          <input
            type="text"
            className={`input-field ${headerLength > maxHeaderLength ? 'border-danger' : ''}`}
            placeholder="short summary of the change"
            value={header}
            onChange={(e) => setHeader(e.target.value)}
          />
          <p className="text-[10px] text-muted mt-1 italic">
            Tip: "if applied, this commit will {header || '...'}"
          </p>
        </div>

        {/* Body */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[12px] text-muted">
              Body <span className="text-[10px]">(optional)</span>
            </label>
            {longLines.length > 0 && (
              <span className="text-[11px] font-mono text-danger font-semibold">
                ⚠ {longLines.length} line(s) &gt; 80 chars (Line {longLines.map(l => l.line).join(', ')})
              </span>
            )}
          </div>
          <textarea
            className={`input-field resize-y min-h-[80px] font-mono text-[12px] ${longLines.length > 0 ? 'border-danger/50 focus:border-danger' : ''}`}
            placeholder={`Explain WHY this change is needed. What is the purpose?\nAvoid describing WHAT changed (visible in diff).\nReference: task-123, Fixes #123, opw-456`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
          />
          {longLines.length > 0 ? (
            <p className="text-[10px] text-danger mt-1 font-semibold">
              ⚠ Odoo git guidelines recommend keeping lines under 80 characters in the commit body.
            </p>
          ) : !body.trim() && header.trim() ? (
            <p className="text-[10px] text-warning mt-1">
              ⚠ Body is empty. Consider explaining the why.
            </p>
          ) : null}
        </div>

        {/* Preview */}
        <CommitPreview tag={tag} module={modules.join(', ')} header={header} body={body} />
      </div>

      {/* Actions */}
      <div className="border-t border-border p-3 flex gap-2 shrink-0">
        <button
          className={`btn-accent flex-1 justify-center py-1.5 text-[12px] ${!isValid || (!isAmend && !hasStagedChanges) ? 'opacity-40 cursor-not-allowed' : ''}`}
          onClick={handleCommit}
          disabled={!isValid || (!isAmend && !hasStagedChanges)}
        >
          {isAmend ? 'Amend Commit' : 'Commit'}
        </button>

        <button
          className="btn-surface flex-1 justify-center text-[12px] py-1.5"
          onClick={loadLastCommit}
        >
          Amend Last...
        </button>
        <button
          className="btn-surface flex-1 justify-center text-[12px] py-1.5"
          onClick={handleAmendNoEdit}
        >
          Amend (no edit)
        </button>
      </div>
    </div>
  );
}
