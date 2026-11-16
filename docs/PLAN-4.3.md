STATUS: APPROVED (the step is in docs/PLAN-4.1.md section 1; decisions D5, D6, D7, D8 in docs/DECISIONS.md). Written 2026-11-16 before any 4.3 code. No AI call anywhere in 4.3's tests.

# Plan for 4.3: the confirm screen

One page `/`, in this order: CV, confirm, ad, report. Nothing is stored. The CV text box stays editable. The typed-skills box of 3.4 stays as a collapsed "Or type a list" (its code and tests stay).

## Pure code (hand-worked first)
`lib/cv/profile.ts`: `initialConfirm`, `buildProfile` (the Profile the engine uses). `app/fitReport.ts`: `profileReport` (judge only what the person set).

**Profile builder.** Lines are the numbered, redacted lines the AI read.
- Named proposals are pre-ticked, inferred ones are not (D7). A ticked skill in our list becomes `have` citing its line and that line's exact text. An unlisted skill (`new:` id) is never given to the engine (it cannot match an ad; SPRINT 3.4 note) and is reported as "not in our skill list yet".
- A skill added by hand becomes `have` with `evidence: null` (the engine never counts it) if it is in our list; unlisted ones are left out. Already ticked from the CV: ignored with a note.
- In progress: a skill with a valid date (year-month-day, a real day) becomes `inProgress`; without a valid date it is left out with a problem. Already ticked: ignored with a note.
- Constraints: cities split on commas (trimmed, no empty, no repeats ignoring case); languages one per code, first wins; years a whole number 0 to 50 (empty = not set; anything else = not set plus a problem); available from a real date (empty = not set; anything else = not set plus a problem). A kind counts as **set** when it holds at least one value.

**Report: judge only what the person set.** A kind is **judged** when the person set it AND the ad states it (language: the ad names a language; location: the ad names a city and is not remote; work mode: the ad says one; years: the ad gives a minimum; start date: the ad gives a date). Everything else is **not judged**, with its reason. Kinds, in this order: location, language, work mode, years, start date.
- The engine gets the job with the unset kinds blanked (languages `[]`, location null, work mode null unless location or work mode is set). If only a location is set, the person's work modes are passed as all three, so the city check still runs. The engine itself is unchanged.
- Label: `Level (skills only)` when nothing is judged, else `Level (judged: skills, years, ...)`.
- Explanation: the counts sentence (as in 3.4), then, if something is judged: `No conflict was found in what you set.` or `N conflict(s) was/were found in what you set (listed below).`; then `Not judged here: a, b.` for the kinds not judged. If nothing is judged: the old sentence "Location, language, work mode, years and start date are not judged here."

## Hand-worked cases (Northwind ad, docs/PLAN-3.1.md A1: musts SQL, Excel, Communication; nice Power BI or Tableau, Python; English C1, Manchester, hybrid, 3 years, no start date; CV lines 1 "Alex Example", 2 "Used SQL daily", 3 "Excel pivot tables and lookups"; SQL and Excel ticked)
| # | Set by the person | Expected |
|---|---|---|
| R1 | nothing | Good (skills only); musts 2 of 3; SQL "CV line 2", Excel "CV line 3"; Communication not on your profile; all five kinds not judged |
| R2 | years 2 | one closable conflict ("1 year short"); 1 missing + 1 closable = 2 gaps = Stretch (judged: skills, years) |
| R3 | cities Berlin, work mode hybrid | city conflict, can't be closed soon: Long shot (judged: skills, location, work mode) |
| R4 | cities manchester only | no conflict; Good (judged: skills, location); work mode stays not judged |
| R5 | work mode remote only | work-mode conflict, can't be closed: Long shot (judged: skills, work mode); no city conflict |
| R6 | languages English C1 / German B2 | none / "does not list English", Long shot |
| R7 | available from 2027-01-01 | the ad gives no start date: not judged, label stays skills only |
| R8 | Communication added by hand | still missing, 2 of 3; the screen says it has no CV line so it does not count |
| R9 | Communication in progress to 2026-12-20 | still missing; "in progress, expected 2026-12-20" |
| R11 | Communication ticked, years 3, city Manchester, hybrid, English C1 | Strong (judged: skills, location, language, work mode, years); only start date not judged |

## R13 (added 2026-11-16): an ad that names a city but no work mode
**What the engine does** (lib/engine/match.ts, `checkPlace`): when the ad's work mode is null it records "work mode not judged" and returns at once. It never compares a city, so there is no city conflict. And a remote job needs no city. So the page must not judge the city in those two cases, **and must not say "the ad does not say" when the ad does name a city** (the page used to, because it showed one "the ad does not say" line for every kind that was set but not stated).

New wording for a kind the person set that is not judged: a location with the ad naming one says what the ad says: `Location: the ad says Manchester but not whether the job is on-site, hybrid or remote; not judged.` (work mode unknown) or `Location: the ad says Manchester, but the job is remote, so no city is needed; not judged.` (remote job). Every other kind keeps `X: not judged (the ad does not say).`

Hand-worked cases, Northwind with the changes named (CV lines and ticks as R1; musts 2 of 3):
| # | Ad | Person sets | Expected |
|---|---|---|---|
| R13a | city Manchester, work mode null | cities Berlin | no conflict; judged none; "Good (skills only)"; the Location line above (work mode unknown); Work mode: "not judged (you did not set yours, and the ad does not say)" |
| R13b | city Manchester, remote | cities Berlin | no conflict; judged none; the Location line (remote job); Work mode: "the ad says remote; not judged because you did not set yours" |
| R13c | city Manchester, work mode null | cities Berlin and work mode hybrid | no conflict; judged none; the Location line (work mode unknown); Work mode: "not judged (the ad does not say)" |

**Grid invariant (R14).** Over every combination of the ad (work mode null, on-site, hybrid, remote; city or none; years or none; start date or none; languages or none) and of what the person sets (each of the five kinds on or off, with values chosen to cause conflicts): every conflict shown is of a judged kind; a kind is judged only if the person set it; and when the ad names a city, no Location line says "the ad does not say". This replaces the redundant filter "show only conflicts of judged kinds": the engine only sees what is judged, so the filter could never change a result, and the grid now checks that fact instead of hiding it.
