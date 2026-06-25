import React from 'react';
import type { DiffFile } from '../../../types.d';

interface FileTreeProps {
  files: DiffFile[];
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

export function FileTree({ files, selectedFile, onSelectFile }: FileTreeProps) {
  if (files.length === 0) {
    return (
      <div className="text-muted text-center py-8 text-[13px]">
        No changes detected
      </div>
    );
  }

  return (
    <div className="text-[12px]">
      <div className="section-header px-3 py-1.5">
        Changed Files ({files.length})
      </div>
      {files.map((file) => {
        const fileName = file.file.split('/').pop() || file.file;
        const dirPath = file.file.includes('/') ? file.file.substring(0, file.file.lastIndexOf('/')) : '';
        const isSelected = selectedFile === file.file;

        return (
          <div
            key={file.file}
            className={`flex items-center gap-1.5 px-3 py-1 cursor-pointer transition-colors ${
              isSelected ? 'bg-accent/10 text-accent' : 'text-primary hover:bg-border/30'
            }`}
            onClick={() => onSelectFile(file.file)}
            title={file.file}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" className="shrink-0 text-muted">
              <rect x="2" y="1" width="8" height="10" rx="1" stroke="currentColor" strokeWidth="1" fill="none" />
              <path d="M4 4H8M4 6H8M4 8H6" stroke="currentColor" strokeWidth="0.8" />
            </svg>

            <div className="flex-1 min-w-0">
              <span className="truncate block">{fileName}</span>
              {dirPath && (
                <span className="text-[10px] text-muted truncate block">{dirPath}</span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
              {file.insertions > 0 && (
                <span className="text-diff-add-text">+{file.insertions}</span>
              )}
              {file.deletions > 0 && (
                <span className="text-diff-remove-text">-{file.deletions}</span>
              )}
              {file.binary && (
                <span className="text-muted">bin</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
