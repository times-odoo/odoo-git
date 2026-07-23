import React, { useRef, useEffect } from 'react';
import { Completion, computeSuggestionReplacement } from './OdooPanel';

interface SnippetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (code: string) => void;
  theme: string;
  autocompleteEnabled: boolean;
  showSuggestions: boolean;
  filteredSuggestions: Completion[];
  activeSuggestionIndex: number;
  onCursorChange: (beforeCursor: string) => void;
  onNavigateSuggestions: (dir: number) => void;
  onCloseSuggestions: () => void;
}

export function SnippetModal({
  isOpen, onClose, onExecute, theme,
  autocompleteEnabled, showSuggestions, filteredSuggestions,
  activeSuggestionIndex, onCursorChange, onNavigateSuggestions, onCloseSuggestions
}: SnippetModalProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isNotebook = theme === 'notebook';

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSuggestionSelect = (item: Completion) => {
    if (!textareaRef.current) return;
    const target = textareaRef.current;
    
    const cursorPosition = target.selectionStart;
    const value = target.value;
    
    const lastNewlineIdx = value.lastIndexOf('\n', cursorPosition - 1);
    const lineStartIdx = lastNewlineIdx === -1 ? 0 : lastNewlineIdx + 1;
    
    const beforeCursor = value.slice(lineStartIdx, cursorPosition);
    const afterCursor = value.slice(cursorPosition);
    
    const res = computeSuggestionReplacement(beforeCursor, afterCursor, item.text);
    
    target.value = value.slice(0, lineStartIdx) + res.newBeforeCursor + res.newAfterCursor;
    
    const newCursorPos = lineStartIdx + res.newBeforeCursor.length + res.cursorOffset;
    target.setSelectionRange(newCursorPos, newCursorPos);
    
    onCloseSuggestions();
    target.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onNavigateSuggestions(-1);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        onNavigateSuggestions(1);
        return;
      }
      if (e.key === 'Enter' && !e.ctrlKey) {
        e.preventDefault();
        handleSuggestionSelect(filteredSuggestions[activeSuggestionIndex]);
        return;
      }
      if (e.key === 'Tab' || e.key === 'ArrowRight') {
        e.preventDefault();
        handleSuggestionSelect(filteredSuggestions[activeSuggestionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseSuggestions();
        return;
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      
      const value = target.value;
      target.value = value.substring(0, start) + "    " + value.substring(end);
      target.selectionStart = target.selectionEnd = start + 4;
    }
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      onExecute(textareaRef.current?.value || '');
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const triggerCursorCheck = (target: HTMLTextAreaElement) => {
    if (!autocompleteEnabled) return;
    const cursorPosition = target.selectionStart;
    const value = target.value;
    const lastNewlineIdx = value.lastIndexOf('\n', cursorPosition - 1);
    const lineStartIdx = lastNewlineIdx === -1 ? 0 : lastNewlineIdx + 1;
    const beforeCursor = value.slice(lineStartIdx, cursorPosition);
    onCursorChange(beforeCursor);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    triggerCursorCheck(e.target);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`relative w-[600px] h-[400px] flex flex-col rounded-xl shadow-2xl border ${isNotebook ? 'bg-slate-50 border-slate-300' : 'bg-slate-900 border-slate-700/60'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${isNotebook ? 'border-slate-300 bg-slate-100/50' : 'border-slate-800 bg-slate-950/50'}`}>
          <div className="flex items-center gap-2">
            <svg className={`w-4 h-4 ${isNotebook ? 'text-teal-600' : 'text-teal-400'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
            </svg>
            <h3 className={`font-semibold text-sm ${isNotebook ? 'text-slate-700' : 'text-slate-200'}`}>Snippet Editor Mode</h3>
          </div>
          <button 
            onClick={onClose}
            className={`p-1 rounded transition-colors ${isNotebook ? 'hover:bg-slate-200 text-slate-500 hover:text-slate-800' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Editor Body */}
        <div className="flex-1 p-2 relative group flex flex-col">
          <textarea
            ref={textareaRef}
            onKeyDown={handleKeyDown}
            onChange={handleChange}
            onClick={(e) => triggerCursorCheck(e.currentTarget)}
            onKeyUp={(e) => {
              if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
                triggerCursorCheck(e.currentTarget);
              }
            }}
            placeholder="# Write multi-line python code here...\n# Press Ctrl+Enter to execute\n\nfor rec in self:\n    print(rec.name)"
            className={`w-full h-full p-3 font-mono text-[13px] resize-none outline-none rounded-lg ${isNotebook ? 'bg-white text-slate-800 placeholder:text-slate-400 border border-slate-300 focus:border-teal-500 focus:ring-1 focus:ring-teal-500' : 'bg-slate-950/50 text-slate-200 placeholder:text-slate-600 border border-transparent focus:border-slate-700 focus:bg-slate-950/80'}`}
            spellCheck={false}
          />
          
          {/* Autocomplete Dropdown Panel */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className={`absolute bottom-4 left-4 mb-1 w-64 border rounded-lg shadow-2xl overflow-hidden z-[60] ${isNotebook ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-700/60'}`}>
              <div className="max-h-48 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                {filteredSuggestions.map((item, index) => {
                  const isSelected = index === activeSuggestionIndex;
                  return (
                    <div
                      key={index}
                      onClick={() => handleSuggestionSelect(item)}
                      className={`flex items-center justify-between px-2.5 py-1.5 cursor-pointer text-left font-mono relative transition-colors ${isSelected ? (isNotebook ? 'bg-teal-100 text-teal-700 font-semibold' : 'bg-teal-500/20 text-teal-400 font-semibold') : (isNotebook ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-slate-800 text-slate-300')}`}
                    >
                      <span className="truncate">{item.display}</span>
                      <span className="text-[9px] opacity-60 lowercase italic shrink-0 ml-2">{item.type}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-4 py-3 border-t shrink-0 ${isNotebook ? 'border-slate-300 bg-slate-100/50' : 'border-slate-800 bg-slate-950/50'}`}>
          <span className={`text-[11px] font-medium flex items-center gap-1.5 ${isNotebook ? 'text-slate-500' : 'text-slate-500'}`}>
            <kbd className={`px-1.5 py-0.5 rounded border ${isNotebook ? 'bg-white border-slate-300 text-slate-600' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>Ctrl</kbd> + <kbd className={`px-1.5 py-0.5 rounded border ${isNotebook ? 'bg-white border-slate-300 text-slate-600' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>Enter</kbd> to execute
          </span>
          
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className={`px-4 py-1.5 text-[12px] font-semibold rounded transition-colors ${isNotebook ? 'text-slate-600 hover:bg-slate-200' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              Cancel
            </button>
            <button
              onClick={() => onExecute(textareaRef.current?.value || '')}
              className={`px-4 py-1.5 text-[12px] font-bold rounded shadow-sm transition-colors flex items-center gap-1.5 ${isNotebook ? 'bg-teal-600 hover:bg-teal-700 text-white' : 'bg-teal-500/20 text-teal-400 border border-teal-500/30 hover:bg-teal-500/30'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              Execute
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
