import React, { useState, useRef, useEffect, useMemo } from 'react';
import { VirtualList } from './VirtualList';

interface DbDropdownProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  dbs: string[];
  templates: string[];
  loadingDbs?: boolean;
  onToggleTemplate: (db: string) => void;
  onDuplicate: (db: string) => void;
  onDrop: (db: string) => void;
  onRefresh: () => void;
  onCreateNew: () => void;
  className?: string;
  disabled?: boolean;
}

export function DbDropdown({
  value,
  onChange,
  placeholder = 'Select Database...',
  dbs,
  templates,
  loadingDbs = false,
  onToggleTemplate,
  onDuplicate,
  onDrop,
  onRefresh,
  onCreateNew,
  className = '',
  disabled = false,
}: DbDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredDbs = useMemo(() => {
    return dbs.filter((db) => db.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [dbs, searchQuery]);

  const itemHeight = 38;
  const maxListHeight = 220;
  const listHeight = Math.min(filteredDbs.length * itemHeight, maxListHeight);

  return (
    <div ref={dropdownRef} className={`relative inline-block w-full ${className}`}>
      {/* Dropdown Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full text-left transition-all border border-border h-[36px] px-3 rounded text-[12px] ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-[#0D1117]/30 text-muted'
            : 'cursor-pointer hover:border-accent/50 focus:border-accent focus:outline-none bg-[#0D1117]/60 text-primary'
        }`}
      >
        <span className="truncate text-primary">
          {value || placeholder}
        </span>
        <svg
          className={`w-4 h-4 text-muted transition-transform duration-200 shrink-0 ml-2 ${
            isOpen ? 'rotate-180 text-accent' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Options List */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 max-h-80 z-[999] bg-[#161B22] border border-border rounded shadow-2xl divide-y divide-border/20 backdrop-blur-md flex flex-col overflow-hidden">
          {/* Header area with Search, Refresh, and New DB */}
          <div className="p-2 bg-[#161B22] border-b border-border/20 shrink-0 flex items-stretch gap-1.5 h-[44px]" onClick={(e) => e.stopPropagation()}>
            <div className="relative flex-1 flex items-stretch">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search databases..."
                className="w-full h-full bg-[#0D1117] border border-border rounded px-2.5 text-[11px] text-primary placeholder:text-muted focus:outline-none focus:border-accent"
              />
              {searchQuery && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-primary text-[14px]"
                  onClick={() => setSearchQuery('')}
                >
                  ×
                </button>
              )}
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={onRefresh}
              className={`w-[32px] shrink-0 flex items-center justify-center hover:bg-border/40 text-muted hover:text-primary border border-border rounded transition-colors ${
                loadingDbs ? 'opacity-50 pointer-events-none' : ''
              }`}
              title="Refresh database list"
            >
              <svg
                className={`w-3.5 h-3.5 ${loadingDbs ? 'animate-spin text-accent' : ''}`}
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

            {/* New DB Button */}
            <button
              type="button"
              onClick={onCreateNew}
              className="px-2.5 shrink-0 flex items-center justify-center gap-1 bg-accent hover:bg-accent/80 text-[10px] text-white font-semibold rounded transition-colors border border-accent"
              title="Create New Database"
            >
              + New DB
            </button>
          </div>

          <div className="flex-1 max-h-[220px] overflow-hidden">
            {loadingDbs ? (
              <div className="flex items-center justify-center py-8 text-muted text-[11px] gap-2">
                <svg className="animate-spin text-accent" width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="20 12" />
                </svg>
                Loading...
              </div>
            ) : filteredDbs.length === 0 ? (
              <div className="px-3 py-4 text-muted text-[11px] italic text-center">No databases found</div>
            ) : (
              <VirtualList
                items={filteredDbs}
                itemHeight={itemHeight}
                height={listHeight}
                renderItem={(db) => {
                  const isSelected = db === value;
                  const isTemplate = templates.includes(db);
                  return (
                    <div
                      key={db}
                      onClick={() => {
                        onChange(db);
                        setIsOpen(false);
                      }}
                      className={`group w-full text-left px-3 py-2 text-[12px] transition-colors flex items-center justify-between cursor-pointer h-[38px] box-border border-b border-border/10 ${
                        isSelected
                          ? 'bg-accent/15 text-accent font-semibold border-l-2 border-accent'
                          : 'text-primary hover:bg-border/30'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 pr-2">
                        <span className="truncate">{db}</span>
                        {isTemplate && (
                          <span className="text-[8px] font-bold px-1 rounded bg-warning/20 text-warning uppercase shrink-0">
                            Tmpl
                          </span>
                        )}
                      </div>

                      {/* Action buttons inside dropdown item */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {/* Star/Template Button */}
                        <button
                          type="button"
                          className={`p-1 rounded hover:bg-border/60 ${isTemplate ? 'text-warning' : 'text-muted hover:text-warning'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(false);
                            onToggleTemplate(db);
                          }}
                          title={isTemplate ? 'Unmark template' : 'Mark as template'}
                        >
                          <svg className="w-3.5 h-3.5" fill={isTemplate ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </button>

                        {/* Duplicate Button */}
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-border/60 text-muted hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(false);
                            onDuplicate(db);
                          }}
                          title="Duplicate database"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                          </svg>
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-border/60 text-muted hover:text-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(false);
                            onDrop(db);
                          }}
                          title="Drop database"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
