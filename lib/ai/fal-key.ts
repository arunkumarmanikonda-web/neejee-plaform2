// Accept either the raw key or an Authorization field pasted from fal's example.
export function falKey(): string {
  let value = (process.env.FAL_KEY || '').trim();
  if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0]) {
    value = value.slice(1, -1).trim();
  }
  return value.replace(/^(?:Authorization:\s*)?Key\s+/i, '').replace(/(?:\\r)?\\n$/, '').trim();
}
