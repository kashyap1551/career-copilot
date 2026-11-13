import { createGroq } from "@ai-sdk/groq";

// The only file that knows which AI provider we use.

export class MissingSettingError extends Error {
  constructor(name: string) {
    super(`${name} is not set`);
    this.name = "MissingSettingError";
  }
}

// Settings are read when this is called, not when the file loads, so a
// missing variable can never break `npm run build`. Errors name the variable
// but never print its value.
export function getModel() {
  const apiKey = process.env.GROQ_API_KEY;
  const modelName = process.env.GROQ_MODEL;
  if (!apiKey) throw new MissingSettingError("GROQ_API_KEY");
  if (!modelName) throw new MissingSettingError("GROQ_MODEL");
  return createGroq({ apiKey })(modelName);
}
