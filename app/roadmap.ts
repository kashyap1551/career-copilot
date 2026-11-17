import { KIND_WORDS } from "@/lib/cv/profile";
import type { HeldBack } from "@/lib/engine/gaps";
import { HELD_BACK_AD, HELD_BACK_COUNTED, HELD_BACK_IS, HELD_BACK_OF, HELD_BACK_REASON, HELD_BACK_TAIL } from "@/lib/saved/messages";

// Step 7.1 (docs/PLAN-7.1.md): the "What to learn" box, assembled by pure code. No AI, no store, no network. The words are
// constants in lib/saved/messages.ts (the 6.2 pattern); this file only chooses and joins them.

// The line under the gap list when some counted ads are held back by something other than skills (Amendments 1 and 2).
// The noun follows M (the ads counted), the verb and the pronoun follow N (the ads held back). With no gap row there are
// no skills "above", so the closing words are left out. Null when no ad is held back.
export function heldBackLine(heldBack: HeldBack, hasRows: boolean): string | null {
  if (heldBack.ads === 0) return null;
  const noun = heldBack.of === 1 ? HELD_BACK_AD.one : HELD_BACK_AD.many;
  const one = heldBack.ads === 1;
  const verb = one ? HELD_BACK_IS.one : HELD_BACK_IS.many;
  const words = heldBack.kinds.map((k) => KIND_WORDS[k]).join(", ");
  const head = [heldBack.ads, HELD_BACK_OF, heldBack.of, HELD_BACK_COUNTED, noun, verb, HELD_BACK_REASON].join(" ");
  const tail = hasRows ? `, ${one ? HELD_BACK_TAIL.one : HELD_BACK_TAIL.many}` : "";
  return `${head} (${words})${tail}.`;
}
