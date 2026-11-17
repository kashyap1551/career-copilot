"use client";

import { useMemo, useState } from "react";
import { skills } from "@/fixtures/skills";
import { buildProfile, initialConfirm, type ConfirmState } from "@/lib/cv/profile";
import { builtFromSaved } from "@/lib/saved/profile";
import type { SavedProfile } from "@/lib/saved/types";
import type { BuildResult, RemovalReason } from "@/lib/engine/fromAd";
import type { ExtractedAd } from "@/lib/schemas/job";
import { AD_GONE, openMessage, savedMessage } from "@/lib/saved/messages";
import { openJob } from "@/lib/saved/openJob";
import { loadJob } from "@/lib/saved/saved";
import type { CvBuildResult } from "@/lib/engine/fromCv";
import ConfirmBox from "./ConfirmBox";
import AccessBox from "./AccessBox";
import { postJson } from "./accessFetch";
import CvBox from "./CvBox";
import { roadmapAds, roadmapBox } from "./roadmap";
import RoadmapView from "./RoadmapView";
import { openedReadings, reportFor } from "./savedAdRows";
import ReportView from "./ReportView";
import { adStatusKey, openView, profileKey } from "@/lib/saved/ui";
import { AdStatus, SaveAdButton, SaveProfileButton, SavedAdsList, SavedDeleteAll, SavedOffer, SavedStatus } from "./SavedControls";
import { closeMatchLines, reportNote } from "./reportText";
import { readSkillList, skillsOnlyReport } from "./skillsOnly";
import { NO_ADS, useSaved } from "./useSaved";

// One page, in this order: your CV, confirm your profile, the job ad, the
// report (D6; nothing is stored). The AI reads the CV and the ad; plain code
// builds the profile from what the person confirms and judges the ad against it,
// only on the constraints the person set. A typed list of skills (step 3.4)
// stays as a collapsed option and is used only when no CV has been read.
// Step 6.1: a confirmed profile can be saved on this device, but only by a click (nothing is written otherwise), and a saved
// profile is offered on load and used only after a click (app/SavedControls.tsx).

const REASONS: Record<RemovalReason, string> = {
  "not-in-ad": "it wasn't in your ad",
  "no-skill": "it named no skill",
  "number-not-in-quote": "its number wasn't in the quoted words",
  "number-out-of-range": "its number was out of range",
  "no-full-date": "the quoted words have no full date",
  "date-mismatch": "its date didn't match the quoted words",
  "level-not-in-quote": "the level wording wasn't in the quoted words",
  "several-cities": "the ad names several cities",
  "tag-not-sentence": "it was only a tag, not a sentence",
};

// What /api/read answers: the checked reading plus, since 6.1, the AI's raw reading (kept so a saved ad can be checked again
// later without another AI call).
type ReadAnswer = BuildResult & { extraction?: ExtractedAd | null };

export default function Home() {
  const [text, setText] = useState("");
  const [skillText, setSkillText] = useState("");
  const [result, setResult] = useState<ReadAnswer | null>(null);
  // 6.1: set only when the ad on screen was just read by the AI (it can then be saved); null for an ad opened from the saved
  // list. `rereadOffered` is true when an opened ad was read with older instructions or cannot be checked here.
  const [fresh, setFresh] = useState<{ adText: string; extraction: ExtractedAd | null } | null>(null);
  const [rereadOffered, setRereadOffered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // The last successful reading of the CV, and what the person has confirmed.
  const [cvRead, setCvRead] = useState<{ lines: string[]; result: CvBuildResult } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  // 6.1: the saved profile the person chose to use ("Use this profile"); read-only.
  const saved = useSaved();
  const [usingSaved, setUsingSaved] = useState<SavedProfile | null>(null);

  async function readAd() {
    setLoading(true);
    setError(null);
    setResult(null);
    setFresh(null);
    setRereadOffered(false);
    try {
      // One helper sends it (app/accessFetch.ts): it adds the access code header; a 401 shows the Access code box instead.
      const sent = await postJson("/api/read", { text }, { source: "ad" });
      if (sent.kind === "access") return;
      const res = sent.res;
      // If the server's answer is not JSON (for example a timeout page),
      // fall back to a plain message instead of crashing.
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? `The server returned an error (${res.status}).`);
      } else {
        setResult(data as ReadAnswer);
        setFresh({ adText: text.trim(), extraction: (data as ReadAnswer).extraction ?? null });
      }
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // Click handler: open a saved ad. It READS the record (loadJob) and decides how to show it (openJob, plain code, no AI).
  // It calls NO save function: a re-check is never written back. An AI call happens only on the separate click on
  // "Read it again with the AI".
  async function onOpenAd(id: string) {
    const ctx = saved.state.phase === "ready" ? saved.state.ctx : null;
    if (!ctx) return;
    const loaded = await loadJob(ctx, id);
    if (!loaded.ok) {
      saved.setAdStatus(loaded.reason === "newer-version" ? openMessage("newer-version") : savedMessage(loaded.reason));
      return;
    }
    if (loaded.job === null) {
      saved.setAdStatus(AD_GONE);
      return;
    }
    const opened = openJob(loaded.job, { stamps: ctx.stamps, skills });
    const view = openView(opened.kind);
    saved.setAdStatus(view.message, adStatusKey(loaded.job.adText));
    if (!view.showReading || opened.kind === "newer-version") return;
    setError(null);
    setText(loaded.job.adText);
    setResult(opened.reading); // shown like a fresh reading; the fit level is computed against the profile in use
    setFresh(null); // an opened ad is not saved again from the screen
    setRereadOffered(view.offerReread);
  }

  function onCvRead(lines: string[], r: CvBuildResult) {
    setCvRead({ lines, result: r });
    setUsingSaved(null); // a CV read now replaces a saved profile in use
    setConfirm(initialConfirm(r.skills)); // a new reading starts a new confirmation
  }

  // All recomputed in the browser when anything changes: no new AI call.
  const built = useMemo(
    () => (cvRead && confirm ? buildProfile(cvRead.lines, cvRead.result.skills, confirm, skills) : null),
    [cvRead, confirm],
  );
  const savedBuilt = useMemo(() => (usingSaved ? builtFromSaved(usingSaved) : null), [usingSaved]);
  // The profile the report uses: the saved one if the person clicked "Use this profile" (a CV read afterwards clears it),
  // otherwise the one just confirmed from a CV.
  const profile = savedBuilt ?? built;
  const list = useMemo(() => readSkillList(skillText, skills), [skillText]);
  const report = useMemo(() => {
    if (!result) return null;
    if (profile) {
      return {
        kind: "cv" as const,
        view: reportFor(result, profile, skills, cvRead?.result.unlisted ?? []),
      };
    }
    return {
      kind: "list" as const,
      view: { ...skillsOnlyReport(result.job, list.cvLines, list.lines, skills, result.unlisted), conflicts: [] as string[] },
    };
  }, [result, profile, cvRead, list]);

  // Step 7.1: the "What to learn" box. It reads only what the page already holds (the saved ads from the single read at load, and
  // the profile in use): no storage read, no AI call. It recomputes when the ads or the profile change.
  const adList = saved.state.phase === "ready" ? saved.state.ads.list : NO_ADS.list;
  const adStamps = saved.state.phase === "ready" && saved.state.ctx ? saved.state.ctx.stamps : null;
  const roadmap = useMemo(
    () => roadmapBox(profile, roadmapAds(adStamps ? openedReadings(adList, { stamps: adStamps, skills }) : []), skills),
    [adList, adStamps, profile],
  );

  // Names the reader matched by close spelling (stage 2): one short line each; exact matches show nothing.
  const closeLines = result ? closeMatchLines(result.job.requirements, (id) => skills.find((k) => k.id === id)?.name ?? id) : [];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Career Co-pilot</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Add your CV, confirm your profile, paste a job ad, and see where you stand.
      </p>

      <SavedOffer
        saved={saved}
        usingSaved={usingSaved}
        onUse={setUsingSaved}
        onReadCvAgain={() => setUsingSaved(null)}
        onForget={() => setUsingSaved(null)}
      />

      <CvBox onRead={onCvRead} />

      {cvRead && confirm && built && !usingSaved && (
        <ConfirmBox
          proposals={cvRead.result.skills}
          confirm={confirm}
          onChange={setConfirm}
          built={built}
        />
      )}

      {cvRead && confirm && built && !usingSaved && <SaveProfileButton saved={saved} built={built} />}

      <SavedDeleteAll saved={saved} onForget={() => setUsingSaved(null)} />
      <SavedStatus saved={saved} currentKey={profile ? profileKey(profile) : null} />

      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Or type a list of skills instead</summary>
        <div className="mt-2 flex flex-col gap-2">
          <label htmlFor="skills" className="font-medium">
            Your skills, one per line (from your list, not a CV)
          </label>
          <textarea
            id="skills"
            value={skillText}
            onChange={(e) => setSkillText(e.target.value)}
            placeholder={"SQL\nExcel\nPython"}
            rows={6}
            className="w-full rounded border border-zinc-300 bg-transparent p-3 font-mono text-sm dark:border-zinc-700"
          />
          {profile && (
            <p className="text-zinc-600 dark:text-zinc-400">
              You have a confirmed CV profile, so this list is ignored. Reload the page to use only a list.
            </p>
          )}
        </div>
      </details>

      <h2 className="text-lg font-semibold">The job ad</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste the job ad here…"
        rows={16}
        className="w-full rounded border border-zinc-300 bg-transparent p-3 font-mono text-sm dark:border-zinc-700"
      />

      <div>
        <button
          onClick={readAd}
          disabled={loading || text.trim() === ""}
          className="rounded bg-foreground px-5 py-2 font-medium text-background disabled:opacity-40"
        >
          {loading ? "Reading…" : "Read this ad"}
        </button>
      </div>

      <AccessBox source="ad" />

      {error && (
        <p role="alert" className="rounded border border-red-400 p-3 text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <AdStatus saved={saved} adKey={adStatusKey(text)} />
      <SavedAdsList saved={saved} onOpen={onOpenAd} profile={profile} skills={skills} />
      <RoadmapView box={roadmap} />

      {result && report && (
        <>
          {fresh && (
            <SaveAdButton
              saved={saved}
              adText={fresh.adText}
              extraction={fresh.extraction}
              reading={{ job: result.job, removed: result.removed, moved: result.moved, unlisted: result.unlisted, notCounted: result.notCounted }}
            />
          )}
          {rereadOffered && (
            <div>
              {/* Nothing is sent until this click: it runs the normal read flow (one AI call) on the text shown above. */}
              <button
                onClick={() => {
                  setRereadOffered(false);
                  readAd();
                }}
                disabled={loading}
                className="rounded border border-zinc-400 px-3 py-1 text-sm font-medium dark:border-zinc-600 disabled:opacity-40"
              >
                Read it again with the AI
              </button>
            </div>
          )}
          <ReportView
            title={`${result.job.title}${result.job.company ? `, ${result.job.company}` : ""}`}
            report={report.view}
            note={reportNote(report.kind)}
            notCounted={result.notCounted ?? []}
            extra={
              report.kind === "list" && list.lines.some((l) => !l.listed) ? (
                <div className="text-sm">
                  <p className="font-medium">On your list, not in our skill list yet:</p>
                  <ul className="list-disc pl-5">
                    {list.lines
                      .filter((l) => !l.listed)
                      .map((l) => (
                        <li key={l.line}>
                          {l.text}: not in our skill list yet, so it can&apos;t be matched with your CV (your list, line {l.line})
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null
            }
          />

          <section className="flex flex-col gap-3">
            <h2 className="mt-4 font-semibold">What the AI read</h2>

            {result.removed.length > 0 && (
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                <p>
                  {result.removed.length} {result.removed.length === 1 ? "item" : "items"} removed
                  because a check failed:
                </p>
                <ul className="list-disc pl-5">
                  {result.removed.map((r, i) => (
                    <li key={i}>
                      {r.what}: {REASONS[r.why]} (&ldquo;{r.text}&rdquo;)
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.moved.length > 0 && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {result.moved.length} {result.moved.length === 1 ? "line" : "lines"} moved to
                &ldquo;check this yourself&rdquo; because it couldn&apos;t be checked.
              </p>
            )}

            {result.unlisted.length > 0 && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Not in our skill list yet: {result.unlisted.map((s) => s.name).join(", ")}.
              </p>
            )}

            {closeLines.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                {closeLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}

            <details>
              <summary className="cursor-pointer text-sm">The checked reading as JSON</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words rounded bg-zinc-100 p-3 text-sm dark:bg-zinc-900">
                {JSON.stringify(result.job, null, 2)}
              </pre>
            </details>
          </section>
        </>
      )}
    </main>
  );
}
