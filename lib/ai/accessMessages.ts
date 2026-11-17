// The words and statuses of the access code (docs/PLAN-ACCESS-CODE.md, sections 2 and 3). No node: import, so the page can
// import them without pulling in node:crypto (lib/ai/accessCode.ts is server only).

// The server's two answers.
export const ACCESS_DENIED_MESSAGE = "The access code is missing or wrong.";
export const ACCESS_DENIED_STATUS = 401;
export const NOT_CONFIGURED_MESSAGE = "This site is not set up to read yet. Please try again later.";
export const NOT_CONFIGURED_STATUS = 503;

// The header the page sends the code in (never the address).
export const ACCESS_HEADER = "x-access-code";

// The page's own wording (section 3). The page, not the server, tells "no code sent" from "a code was sent".
export const NEED_CODE_MESSAGE = "Enter the access code you were given, then press the button again.";
export const WRONG_CODE_MESSAGE = "That access code was not accepted. Check it and try again.";
export const EMPTY_CODE_MESSAGE = "Type the access code first.";
export const CODE_KEPT_MESSAGE = "Access code kept in this tab until you close it.";
export const CODE_FORGOTTEN_MESSAGE = "The access code was forgotten.";
export const ACCESS_LABEL = "Access code";
export const USE_CODE_LABEL = "Use this code";
export const FORGET_CODE_LABEL = "Forget the code";

// Limits of the code (section 2): the server needs at least 16 characters; the page caps what is typed.
export const MIN_CODE_CHARS = 16;
export const MAX_CODE_CHARS = 128;
