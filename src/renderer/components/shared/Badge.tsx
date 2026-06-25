import React from 'react';

const TAG_COLORS: Record<string, string> = {
  IMP: '#8B4CF1',
  FIX: '#DA3633',
  ADD: '#238636',
  REM: '#F85149',
  REF: '#3B82F6',
  REV: '#D29922',
  MOV: '#6E7681',
  REL: '#8B4CF1',
  MERGE: '#6E7681',
  CLA: '#6E7681',
  I18N: '#3B82F6',
  PERF: '#D29922',
  CLN: '#6E7681',
  LINT: '#6E7681',
};

interface BadgeProps {
  tag: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Badge({ tag, size = 'sm' }: BadgeProps) {
  const color = TAG_COLORS[tag.toUpperCase()] || '#6E7681';
  const sizeClasses =
    size === 'sm' ? 'text-[10px] px-1.5 py-0.5' :
    size === 'md' ? 'text-[11px] px-2 py-0.5' :
    'text-[13px] px-3.5 py-1.5 rounded-md';

  return (
    <span
      className={`${sizeClasses} font-mono font-semibold rounded uppercase inline-block leading-none`}
      style={{
        color,
        backgroundColor: `${color}15`,
        border: `1px solid ${color}30`,
      }}
    >
      {tag}
    </span>
  );
}
