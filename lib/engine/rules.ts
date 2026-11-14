// The numbers behind "a conflict that can be closed soon" (see the
// 2026-11-14 lines in docs/DECISIONS.md). Change them here, and in the tests.

// A language that is this many levels short can be closed. More, or a
// language the person doesn't list at all, can't.
export const LANGUAGE_CLOSABLE_LEVELS = 1;

// Total years of experience this many years short can be closed.
export const YEARS_CLOSABLE_SHORTFALL = 1;

// Available this many days after the ad's start date can be closed.
export const START_DATE_CLOSABLE_DAYS = 30;
