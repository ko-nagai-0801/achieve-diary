/* lib/tags/active-token.ts */
export type ActiveTagToken = {
  hashIndex: number;
  token: string;
};

export function getActiveTagToken(text: string, cursor: number): ActiveTagToken | null {
  const before = text.slice(0, cursor);
  const hashIndex = before.lastIndexOf("#");
  if (hashIndex === -1) return null;

  if (hashIndex > 0) {
    const prev = before[hashIndex - 1] ?? "";
    if (!/\s/.test(prev)) return null;
  }

  const afterHash = before.slice(hashIndex + 1);
  if (/\s/.test(afterHash)) return null;

  return { hashIndex, token: afterHash };
}
