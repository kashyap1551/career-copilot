import { WHAT_TO_LEARN } from "@/lib/saved/messages";
import type { RoadmapBox } from "./roadmap";

// Step 7.1: the "What to learn" box, drawn. It only maps the lines of `roadmapBox` (app/roadmap.ts) to elements: no sentence is
// written here, there is no button, no form, no effect and no storage or network call. It reads nothing but its prop.

const quiet = "text-sm text-zinc-600 dark:text-zinc-400";

export default function RoadmapView({ box }: { box: RoadmapBox }) {
  const hasNote = box.noProfile !== null;
  const hasPartA = box.partA.length !== 0;
  const hasPartB = box.partB.length !== 0;
  if (!hasNote && !hasPartA && !hasPartB) return null; // nothing saved: no box

  return (
    <section aria-label={WHAT_TO_LEARN} className="flex flex-col gap-2 rounded border border-zinc-300 p-3 text-sm dark:border-zinc-700">
      <p className="font-medium">{WHAT_TO_LEARN}</p>
      {hasNote && <p className={quiet}>{box.noProfile}</p>}
      {hasPartA && (
        <ul className="flex flex-col gap-1">
          {box.partA.map((line, i) => (
            <li key={`${i}-${line}`}>{line}</li>
          ))}
        </ul>
      )}
      {hasPartB && (
        <ul className="flex flex-col gap-1">
          {box.partB.map((line, i) => (
            <li key={`${i}-${line}`}>{line}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
