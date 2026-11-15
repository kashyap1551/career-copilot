// The kill switch: AI_ENABLED=false in the environment (set it in Vercel and
// redeploy) pauses every route that calls the AI. Unset, or any other value,
// (apart from the word false in any case, with or without spaces) means on.
// Read when called, never at load.
export function aiPaused(): boolean {
  return process.env.AI_ENABLED?.trim().toLowerCase() === "false";
}

export const PAUSED_MESSAGE = "The AI reading is paused right now. Please try again later.";
export const PAUSED_STATUS = 503;
