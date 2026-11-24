import Link from "next/link";
import { DEMO_ENTRY, DEMO_ENTRY_HINT } from "@/lib/demo/messages";

// Step 9.1 (docs/PLAN-9.1.md section 2.4): the way into the demo. One link to the separate page /demo, with prefetch off so the
// first screen does not fetch the demo page in the background. It is shown whatever the state of the page (with or without an
// access code, with or without a CV): app/page.tsx renders it outside every condition.

export default function DemoEntry() {
  return (
    <div className="flex flex-col gap-1">
      <div>
        <Link
          href="/demo"
          prefetch={false}
          className="inline-block rounded border border-zinc-400 px-4 py-2 text-sm font-medium dark:border-zinc-600"
        >
          {DEMO_ENTRY}
        </Link>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{DEMO_ENTRY_HINT}</p>
    </div>
  );
}
