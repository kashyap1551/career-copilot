import Link from "next/link";
import { DEMO_BANNER, DEMO_EXIT } from "@/lib/demo/messages";

// Step 9.1 (docs/PLAN-9.1.md section 2.5): the banner and the one way out, around every page under /demo, so no demo screen
// can be shown without them. They stay at the top while the page scrolls.

export default function DemoLayout({ children }: LayoutProps<"/demo">) {
  return (
    <>
      <div
        role="status"
        className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-amber-500 bg-amber-100 px-6 py-3 text-sm text-zinc-900 dark:bg-amber-950 dark:text-zinc-100"
      >
        <p className="flex-1 font-medium">{DEMO_BANNER}</p>
        <Link href="/" prefetch={false} className="rounded border border-zinc-500 px-3 py-1 font-medium">
          {DEMO_EXIT}
        </Link>
      </div>
      {children}
    </>
  );
}
