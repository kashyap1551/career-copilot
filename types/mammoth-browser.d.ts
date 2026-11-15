// The browser build of mammoth ships without types; this is the part we use.
declare module "mammoth/mammoth.browser.min.js" {
  export function extractRawText(input: {
    arrayBuffer: ArrayBuffer;
  }): Promise<{ value: string; messages: unknown[] }>;
}
