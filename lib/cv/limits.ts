// Size limits for a CV, in one place (docs/PLAN-4.2.md). Pure constants.

export const MAX_CV_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
// 12,000 characters is about 3,000 tokens. 20,000 would be about 5,000, which
// with the prompt and the answer passes Groq's 8,000 tokens a minute in ONE call.
export const MAX_CV_CHARS = 12_000;
export const MAX_CV_PAGES = 20;
export const MAX_CV_LINES = 400; // a two-column PDF makes many short lines
export const MAX_LINE_CHARS = 1_000;
