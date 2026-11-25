import type { Metadata } from "next";
import Link from "next/link";
import { FACTS } from "@/lib/privacy/facts";
import {
  CLAIM_C1,
  CLAIM_C10,
  CLAIM_C15,
  CLAIM_C2,
  CLAIM_C3A,
  CLAIM_C3B,
  CLAIM_C4,
  CLAIM_C5,
  CLAIM_C6,
  CLAIM_C7,
  CLAIM_C8,
  CLAIM_C9,
  HEADING_CONTROLS,
  HEADING_COOKIES,
  HEADING_DEMO,
  HEADING_LEAVES,
  HEADING_LOGGED,
  HEADING_NOT_CONFIRMED,
  HEADING_PROCESSORS,
  HEADING_STORED,
  LABEL_BACK_TO_APP,
  LABEL_CHECKED_ON,
  LABEL_SOURCE,
  LABEL_TO_DEMO,
  PRIVACY_DESCRIPTION,
  PRIVACY_TITLE,
} from "@/lib/privacy/messages";

// Step 9.3, stage 2.3 (docs/PLAN-9.3.md section 6, amendments A10 and A13): the privacy page. A static server component: no client code, no request,
// no clock, no storage. EVERY visible word comes from lib/privacy/messages.ts or from the words, source and date of lib/privacy/facts.ts; this file
// types no sentence (tests/privacyPage.test.ts M1, M4, M8). Each fact is shown once: a confirmed fact under its topic, a not-confirmed fact only
// under the last heading, as its fixed sentence. A quoted fact is shown in quotation marks (the <q> element) with its source and date; an observed
// fact as a plain statement with its source and date. The rate limit (claim C14) is fact U9. No Impressum and no contact line: the owner decides
// (PLAN-9.3 section 7). The wording is DRAFT until the owner approves it (WORDING_APPROVED_ON).

export const metadata: Metadata = {
  title: PRIVACY_TITLE,
  description: PRIVACY_DESCRIPTION,
};

// The build fails if this page ever needs request-time rendering (docs of Next: ensureStatic, with cacheComponents on).
export const ensureStatic = "navigation";

const CONFIRMED = FACTS.filter((f) => f.status === "confirmed");
const OPEN = FACTS.filter((f) => f.status === "not-confirmed");

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{PRIVACY_TITLE}</h1>

      <section className="flex flex-col gap-2">
        <h2 className="mt-4 text-lg font-semibold">{HEADING_LEAVES}</h2>
        <p>{CLAIM_C1}</p>
        <p>{CLAIM_C2}</p>
        <p>{CLAIM_C3A}</p>
        <p>{CLAIM_C15}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="mt-4 text-lg font-semibold">{HEADING_STORED}</h2>
        <p>{CLAIM_C3B}</p>
        <p>{CLAIM_C4}</p>
        <p>{CLAIM_C5}</p>
        <p>{CLAIM_C10}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="mt-4 text-lg font-semibold">{HEADING_LOGGED}</h2>
        <p>{CLAIM_C6}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="mt-4 text-lg font-semibold">{HEADING_PROCESSORS}</h2>
        {CONFIRMED.map((f) => (
          <div key={f.id} className="flex flex-col gap-1">
            <p>{f.kind === "quoted" ? <q>{f.words}</q> : f.words}</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {LABEL_SOURCE}: {f.source}. {LABEL_CHECKED_ON}: {f.date}.
            </p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="mt-4 text-lg font-semibold">{HEADING_COOKIES}</h2>
        <p>{CLAIM_C7}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="mt-4 text-lg font-semibold">{HEADING_CONTROLS}</h2>
        <p>{CLAIM_C9}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="mt-4 text-lg font-semibold">{HEADING_DEMO}</h2>
        <p>{CLAIM_C8}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="mt-4 text-lg font-semibold">{HEADING_NOT_CONFIRMED}</h2>
        <ul className="list-disc pl-5">
          {OPEN.map((f) => (
            <li key={f.id}>{f.words}</li>
          ))}
        </ul>
      </section>

      <nav className="mt-4 flex flex-wrap gap-4 text-sm">
        <Link href="/" prefetch={false} className="underline">
          {LABEL_BACK_TO_APP}
        </Link>
        <Link href="/demo" prefetch={false} className="underline">
          {LABEL_TO_DEMO}
        </Link>
      </nav>
    </main>
  );
}
