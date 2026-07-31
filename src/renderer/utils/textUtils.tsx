import React from 'react';

/**
 * Split a long address string into lines of up to `maxLength` characters
 * without breaking words. Returns a JSX fragment with <br/> between lines.
 */
export const wrapAddress = (address: string, maxLength: number = 50): JSX.Element => {
  if (!address) return <>(-)</>;
  const words = address.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLength) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return (
    <>
      {lines.map((line, idx) => (
        <span key={idx}>
          {line}
          {idx < lines.length - 1 && <br />}
        </span>
      ))}
    </>
  );
};
