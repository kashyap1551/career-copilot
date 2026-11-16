"use client";

import { useState } from "react";
import { skills } from "@/fixtures/skills";
import type { BuiltProfile, ConfirmState } from "@/lib/cv/profile";
import type { CvSkill } from "@/lib/engine/fromCv";
import { LANGUAGE_LEVELS, type LanguageLevel, type WorkMode } from "@/lib/engine/types";
import { closeMatchLine } from "./reportText";

// Step 4.3: the confirm screen. Keep or remove each skill the AI found, add
// skills by hand, add skills you are learning, and set the constraints you want
// judged. Display and wiring only: the rules are in lib/cv/profile.ts and
// app/fitReport.ts (hand-worked tests). Nothing is stored.

const LANGUAGES: [string, string][] = [
  ["en", "English"], ["de", "German"], ["fr", "French"], ["es", "Spanish"], ["it", "Italian"],
  ["pt", "Portuguese"], ["nl", "Dutch"], ["pl", "Polish"], ["hi", "Hindi"], ["kn", "Kannada"],
];
const MODES: [WorkMode, string][] = [["onsite", "On-site"], ["hybrid", "Hybrid"], ["remote", "Remote"]];

const field = "rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700";
const button = "rounded border border-zinc-400 px-3 py-1 text-sm font-medium dark:border-zinc-600";

function SkillRow({ s, checked, onToggle }: { s: CvSkill; checked: boolean; onToggle: () => void }) {
  return (
    <li className="border-l-2 border-zinc-300 pl-3 dark:border-zinc-700">
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={checked} onChange={onToggle} className="mt-1" />
        <span>
          <span className="font-medium">{s.name}</span>{" "}
          <span className="text-zinc-600 dark:text-zinc-400">
            (CV line {s.line}
            {s.listed ? "" : "; not in our skill list yet, so it can't be matched with an ad"})
          </span>
          {s.closeMatch && (
            <>
              <br />
              <span className="text-zinc-600 dark:text-zinc-400">
                {closeMatchLine(s.name, skills.find((k) => k.id === s.skillId)?.name ?? s.skillId)}
              </span>
            </>
          )}
          <br />
          <span className="text-zinc-600 dark:text-zinc-400">&ldquo;{s.quote}&rdquo;</span>
        </span>
      </label>
    </li>
  );
}

export default function ConfirmBox({
  proposals,
  confirm,
  onChange,
  built,
}: {
  proposals: CvSkill[];
  confirm: ConfirmState;
  onChange: (c: ConfirmState) => void;
  built: BuiltProfile;
}) {
  const [handName, setHandName] = useState("");
  const [progName, setProgName] = useState("");
  const [progDate, setProgDate] = useState("");
  const [langCode, setLangCode] = useState("en");
  const [langLevel, setLangLevel] = useState<LanguageLevel>("B2");
  const set = (patch: Partial<ConfirmState>) => onChange({ ...confirm, ...patch });

  const toggle = (id: string) =>
    set({ keptIds: confirm.keptIds.includes(id) ? confirm.keptIds.filter((k) => k !== id) : [...confirm.keptIds, id] });
  const named = proposals.filter((p) => p.label === "named");
  const inferred = proposals.filter((p) => p.label === "inferred");

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Confirm your profile</h2>

      <div className="flex flex-col gap-2">
        <h3 className="font-medium">Skills found in your CV</h3>
        {named.length === 0 && <p className="text-sm text-zinc-600 dark:text-zinc-400">No skill was named in your CV.</p>}
        <ul className="flex flex-col gap-2">
          {named.map((s) => (
            <SkillRow key={s.skillId} s={s} checked={confirm.keptIds.includes(s.skillId)} onToggle={() => toggle(s.skillId)} />
          ))}
        </ul>
        {inferred.length > 0 && (
          <>
            <h3 className="mt-2 font-medium">From your wording, keep only if true</h3>
            <ul className="flex flex-col gap-2">
              {inferred.map((s) => (
                <SkillRow key={s.skillId} s={s} checked={confirm.keptIds.includes(s.skillId)} onToggle={() => toggle(s.skillId)} />
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-medium">Add a skill by hand</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          A skill added by hand has no CV line, so it does not count. To make it count, add a line about it to
          your CV text above and press &ldquo;Send for reading&rdquo; again.
        </p>
        <div className="flex gap-2">
          <input aria-label="Skill name" value={handName} onChange={(e) => setHandName(e.target.value)} placeholder="Skill name" className={field} />
          <button className={button} disabled={handName.trim() === ""} onClick={() => { set({ added: [...confirm.added, handName.trim()] }); setHandName(""); }}>
            Add
          </button>
        </div>
        <ul className="text-sm">
          {confirm.added.map((n, i) => (
            <li key={i}>
              {n} <span className="text-zinc-600 dark:text-zinc-400">(no CV line, does not count)</span>{" "}
              <button className="underline" onClick={() => set({ added: confirm.added.filter((_, j) => j !== i) })}>remove</button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-medium">Skills you are learning</h3>
        <div className="flex flex-wrap gap-2">
          <input aria-label="Skill you are learning" value={progName} onChange={(e) => setProgName(e.target.value)} placeholder="Skill name" className={field} />
          <input aria-label="Expected date" type="date" value={progDate} onChange={(e) => setProgDate(e.target.value)} className={field} />
          <button className={button} disabled={progName.trim() === ""} onClick={() => { set({ inProgress: [...confirm.inProgress, { name: progName.trim(), date: progDate }] }); setProgName(""); setProgDate(""); }}>
            Add
          </button>
        </div>
        <ul className="text-sm">
          {confirm.inProgress.map((p, i) => (
            <li key={i}>
              {p.name}, expected {p.date || "(no date yet)"}{" "}
              <button className="underline" onClick={() => set({ inProgress: confirm.inProgress.filter((_, j) => j !== i) })}>remove</button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="font-medium">What the job should be judged against</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Set only what you want judged. Anything you leave empty stays &ldquo;not judged&rdquo; in the report.
        </p>

        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Languages</span>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Language" value={langCode} onChange={(e) => setLangCode(e.target.value)} className={field}>
              {LANGUAGES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </select>
            <select aria-label="Level" value={langLevel} onChange={(e) => setLangLevel(e.target.value as LanguageLevel)} className={field}>
              {LANGUAGE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <button className={button} onClick={() => set({ languages: [...confirm.languages, { code: langCode, level: langLevel }] })}>Add</button>
          </div>
          <ul>
            {confirm.languages.map((l, i) => (
              <li key={i}>
                {LANGUAGES.find(([c]) => c === l.code)?.[1] ?? l.code} {l.level}{" "}
                <button className="underline" onClick={() => set({ languages: confirm.languages.filter((_, j) => j !== i) })}>remove</button>
              </li>
            ))}
          </ul>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Cities you can work in (separate with commas)</span>
          <input value={confirm.cities} onChange={(e) => set({ cities: e.target.value })} placeholder="Berlin, Manchester" className={field} />
        </label>

        <fieldset className="flex flex-wrap items-center gap-3 text-sm">
          <legend className="font-medium">Work modes you accept</legend>
          {MODES.map(([m, n]) => (
            <label key={m} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={confirm.workModes.includes(m)}
                onChange={() => set({ workModes: confirm.workModes.includes(m) ? confirm.workModes.filter((x) => x !== m) : [...confirm.workModes, m] })}
              />
              {n}
            </label>
          ))}
        </fieldset>

        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Years of experience (total)</span>
            <input value={confirm.years} onChange={(e) => set({ years: e.target.value })} inputMode="numeric" placeholder="e.g. 3" className={`${field} w-32`} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Available from</span>
            <input type="date" value={confirm.availableFrom} onChange={(e) => set({ availableFrom: e.target.value })} className={field} />
          </label>
        </div>
      </div>

      {built.problems.length > 0 && (
        <ul role="alert" className="list-disc rounded border border-red-400 p-3 pl-8 text-sm text-red-600 dark:text-red-400">
          {built.problems.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
      )}
      {built.notes.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
          {built.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}
      {built.unmatchable.length > 0 && (
        <div className="text-sm">
          <p className="font-medium">Not in our skill list yet:</p>
          <ul className="list-disc pl-5">
            {built.unmatchable.map((u, i) => (
              <li key={i}>
                {u.name}: not in our skill list yet, so it can&apos;t be matched with your CV (
                {u.where === "cv" ? "from your CV" : u.where === "hand" ? "added by hand" : "in progress"})
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
