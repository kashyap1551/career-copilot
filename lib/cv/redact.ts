// Step 4.2 (D2c): remove email addresses, phone numbers and web links from a
// CV text before it is numbered and sent. Pure code: no AI, no network. Names
// and street addresses cannot be removed reliably and are NOT touched; the
// notice on the page says so. It never adds, removes or joins a line (the
// patterns use spaces and tabs, never line breaks).

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

// The last character of a link is never sentence punctuation.
const URL_BODY = String.raw`[^\s<>()\[\]]*[^\s<>()\[\].,;:!?'"]`;
const LINKS = [
  new RegExp(String.raw`\bhttps?:\/\/${URL_BODY}`, "gi"),
  new RegExp(String.raw`(?<![\w@.])www\.${URL_BODY}`, "gi"),
  // A profile address with a path: linkedin.com/in/..., github.com/...
  new RegExp(
    String.raw`(?<![\w@.-])(?:[a-z0-9-]+\.)*(?:linkedin|github|xing|gitlab)\.(?:com|de|net|org|io)\/${URL_BODY}`,
    "gi",
  ),
];

// A run of digits and the separators phone numbers use (never a line break).
// Whether it IS a phone number is decided by isPhone below.
const PHONE_CANDIDATE = /(?<![\w+])(?:\+|\()?\d[\d \t().\/-]{5,}\d/g;

const digitsOf = (s: string) => s.replace(/\D/g, "");

// A phone starts with "+" or "00" and a country code (8 to 15 digits in all),
// or with "0" and a 2 to 4 digit area code then more digits (9 to 13 in all),
// or is the US form (ddd) ddd-dddd. A date, a year range or a version never
// starts that way (docs/PLAN-4.2.md, tables R and N).
function isPhone(c: string): boolean {
  const d = digitsOf(c).length;
  if (c.startsWith("+")) return d >= 8 && d <= 15;
  if (c.startsWith("00")) return d >= 10 && d <= 16;
  if (/^\(\d{3}\)[ \t]?\d{3}[-. \t]\d{4}$/.test(c)) return true;
  if (/^\(?0\d{2,4}\)?[ \t./-]?\d/.test(c)) return d >= 9 && d <= 13;
  return false;
}

// A candidate may run on into the next words ("+49 30 1234567 2019-2023"), so
// the longest leading part that is a phone number is replaced and the rest stays.
function replacePhones(text: string): string {
  return text.replace(PHONE_CANDIDATE, (candidate) => {
    const parts = candidate.split(/([ \t]+)/); // words and the gaps between them
    // parts alternate word, gap, word...; a head must end on a word, never on a gap.
    for (let n = parts.length; n >= 1; n -= 2) {
      const head = parts.slice(0, n).join("");
      if (isPhone(head)) {
        return "[phone removed]" + parts.slice(n).join("");
      }
    }
    return candidate;
  });
}

export function removeContactDetails(text: string): string {
  let out = text.replace(EMAIL, "[email removed]");
  for (const re of LINKS) out = out.replace(re, "[link removed]");
  return replacePhones(out);
}

// True if the text still holds something removeContactDetails would remove.
export function containsContactDetails(text: string): boolean {
  return removeContactDetails(text) !== text;
}
