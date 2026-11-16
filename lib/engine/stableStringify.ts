// JSON with the keys in sorted order, so the same content is the same text. Pure (no node: import), so the browser and
// Node build the same canonical text. The eval fingerprint, the request hash and the vocabulary hash all use it.
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
