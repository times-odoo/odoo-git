import React, { useState, useRef, useEffect } from 'react';
import { VirtualList } from './VirtualList';

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  options: (string | DropdownOption)[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
  onOpenChange?: (open: boolean) => void;
  loading?: boolean;
  loadingLabel?: string;
}

export function Dropdown({
  options,
  value,
  onChange,
  className = '',
  placeholder = 'Select option...',
  searchable = false,
  disabled = false,
  size = 'md',
  onOpenChange,
  loading = false,
  loadingLabel = 'Loading...',
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Normalize options to objects
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus the search input when the dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, searchable]);

  // Reset search query when the dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  const filteredOptions = normalizedOptions.filter((opt) =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const itemHeight = size === 'sm' ? 26 : 34;
  const maxListHeight = size === 'sm' ? 150 : 192;
  const listHeight = Math.min(filteredOptions.length * itemHeight, maxListHeight);

  return (
    <div ref={dropdownRef} className={`relative inline-block w-full ${className}`}>
      {/* Dropdown Trigger */}
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => !(disabled || loading) && setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full bg-bg border border-border rounded text-left transition-all h-full ${
          size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1.5 text-[13px]'
        } ${
          disabled || loading
            ? 'opacity-50 cursor-not-allowed bg-[#0D1117]/30 text-muted'
            : 'cursor-pointer hover:border-accent/50 focus:border-accent focus:outline-none'
        }`}
      >
        <span className="truncate text-primary flex items-center gap-1.5">
          {loading && (
            <svg className="animate-spin text-accent shrink-0" width="10" height="10" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="20 12" />
            </svg>
          )}
          {loading ? loadingLabel : (selectedOption ? selectedOption.label : placeholder)}
        </span>
        {!loading && (
          <svg
            className={`w-3.5 h-3.5 text-muted transition-transform duration-200 shrink-0 ml-1.5 ${
              isOpen ? 'rotate-180 text-accent' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Dropdown Options List */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 max-h-60 z-[999] bg-[#161B22] border border-border rounded shadow-2xl divide-y divide-border/20 backdrop-blur-md flex flex-col overflow-hidden">
          {searchable && (
            <div className="p-2 bg-[#161B22] border-b border-border/20 shrink-0">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full bg-[#0D1117] border border-border rounded px-2.5 py-1.5 text-[12px] text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          <div className="flex-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-muted text-[12px]">No options</div>
            ) : (
              <VirtualList
                items={filteredOptions}
                itemHeight={itemHeight}
                height={listHeight}
                renderItem={(opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1 transition-colors flex items-center justify-between cursor-pointer box-border ${
                        size === 'sm' ? 'text-[11px] h-[26px]' : 'text-[13px] h-[34px]'
                      } ${
                        isSelected
                          ? 'bg-accent/15 text-accent font-semibold border-l-2 border-accent'
                          : 'text-primary hover:bg-border/30'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && (
                        <svg className="w-3.5 h-3.5 text-accent shrink-0 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
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
