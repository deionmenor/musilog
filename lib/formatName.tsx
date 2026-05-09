import * as React from 'react';

const PARENS_RE = /\s*[(\[](.*?)[)\]]/g;

export function formatName(name: string): React.ReactNode {
  const comments: string[] = [];
  const main = name.replace(PARENS_RE, (_, inner: string) => {
    comments.push(inner.trim());
    return '';
  }).trim();

  if (comments.length === 0) return name;

  return (
    <>
      {main}<span style={{ opacity: 0.4 }}>{' // '}{comments.join(' // ')}</span>
    </>
  );
}
