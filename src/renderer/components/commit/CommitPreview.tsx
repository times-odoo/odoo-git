import React from 'react';

interface CommitPreviewProps {
  tag: string;
  module: string;
  header: string;
  body: string;
}

export function CommitPreview({ tag, module, header, body }: CommitPreviewProps) {
  const firstLine = `[${tag}] ${module}: ${header}`;

  const renderBody = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const isLast = idx === lines.length - 1;
      if (line.length <= 80) {
        return (
          <React.Fragment key={idx}>
            {line}
            {!isLast && '\n'}
          </React.Fragment>
        );
      } else {
        const part1 = line.substring(0, 80);
        const part2 = line.substring(80);
        return (
          <React.Fragment key={idx}>
            {part1}
            <span className="text-danger bg-danger/10 font-semibold" title="Exceeds 80 character limit">
              {part2}
            </span>
            {!isLast && '\n'}
          </React.Fragment>
        );
      }
    });
  };

  return (
    <div className="bg-bg border border-border rounded p-3">
      <label className="text-[10px] text-muted uppercase tracking-wider block mb-2">Commit Message Preview</label>
      <pre className="font-mono text-[12px] text-primary whitespace-pre-wrap leading-relaxed">
        <span className="text-accent">[{tag}]</span>{' '}
        <span className="text-warning">{module}</span>
        <span className="text-muted">: </span>
        <span>{header}</span>
        {body.trim() && (
          <>
            {'\n\n'}
            <span className="text-muted">{renderBody(body)}</span>
          </>
        )}
      </pre>
    </div>
  );
}
