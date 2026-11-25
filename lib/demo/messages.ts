// The words of the demo (docs/PLAN-9.1.md section 2.5 and amendment A3). One exported constant per text, as in
// lib/saved/messages.ts, so the exact strings are tested (tests/demoView.test.ts V2) and the components only show them.
// A label never claims that no request is made for the page as a whole (loading a page is a request): a claim is about
// what the visitor does in the demo.

export const DEMO_BANNER =
  "Demo: invented data. The person, the CV and the ten job ads are made up. Nothing you do here is saved or sent anywhere.";
export const DEMO_PREPARED =
  "The AI readings in this demo were prepared in advance and are part of this page. No AI is used here, and nothing you do in the demo is sent anywhere. The live version reads your own CV and ads with AI.";
export const DEMO_ENTRY = "Try a demo with invented data";
export const DEMO_ENTRY_HINT = "No upload and no access code. About one minute.";
export const DEMO_EXIT = "Leave the demo";
export const DEMO_TRY = "Untick a skill below and watch the fit levels change.";
export const DEMO_LOADING = "Preparing the demo ...";
// Not one of the seven labels of section 2.5: what the page says if the demo cannot start (for example a page that is not secure).
export const DEMO_FAILED = "The demo could not start in this browser. Leave the demo and try again.";
