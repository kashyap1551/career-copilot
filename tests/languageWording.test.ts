import { describe, expect, it } from "vitest";
import { languageCodeFor, levelFromWording } from "@/lib/engine/languageWording";
import type { LanguageLevel } from "@/lib/engine/types";

// Table sections B and C of docs/PLAN-3.1.md, worked out by hand.

const B: [string, string | null, LanguageLevel | null][] = [
  ["B1", "C1", "C1"],
  ["B2", "C1 or better", "C1"],
  ["B3", "fluent (C1)", "C1"],
  ["B4", "B2", "B2"],
  ["B5", "Fluent", "C1"],
  ["B6", "business fluent", "C1"],
  ["B7", "fließend", "C1"],
  ["B8", "verhandlungssicher", "C1"],
  ["B9", "native speaker", "C2"],
  ["B10", "Mother tongue", "C2"],
  ["B11", "Muttersprache", "C2"],
  ["B12", "Good", "B2"],
  ["B13", "gut", "B2"],
  ["B14", "Advanced", null],
  ["B15", "Conversational", "B1"],
  ["B16", "intermediate", null],
  ["B17", "Basic", "A2"],
  ["B18", "Grundkenntnisse", "A2"],
  ["B19", "excellent", null],
  ["B20", "working knowledge", null],
  ["B21a", "", null],
  ["B21b", null, null],
  ["B22", "very good", "B2"],
  ["B23", "upper intermediate", null],
  ["B24", "muttersprachlich", "C2"],
  ["B25", "gute", "B2"],
  ["B26", "Basiskenntnisse", "A2"],
  ["B27", "fliessend", "C1"],
];

describe("levelFromWording", () => {
  it.each(B)("%s: %j gives %s", (_id, wording, level) => {
    expect(levelFromWording(wording)).toBe(level);
  });

  it("a stated level wins over a word", () => {
    expect(levelFromWording("good, C1 level")).toBe("C1");
  });

  it("a level inside another word is not a stated level", () => {
    // "ab2c" is not the level B2 and no key is found
    expect(levelFromWording("ab2c")).toBeNull();
  });

  it("keys match whole words only", () => {
    expect(levelFromWording("goodness")).toBeNull();
  });
});

const C: [string, string, string | null][] = [
  ["C1", "English", "en"], ["C1", "Englisch", "en"],
  ["C2", "German", "de"], ["C2", "Deutsch", "de"],
  ["C3", "French", "fr"], ["C3", "Französisch", "fr"],
  ["C4", "Spanish", "es"], ["C4", "Spanisch", "es"],
  ["C5", "Italian", "it"], ["C5", "Italienisch", "it"],
  ["C6", "Portuguese", "pt"], ["C6", "Portugiesisch", "pt"],
  ["C7", "Dutch", "nl"], ["C7", "Niederländisch", "nl"],
  ["C8", "Polish", "pl"], ["C8", "Polnisch", "pl"],
  ["C9", "Turkish", "tr"], ["C9", "Türkisch", "tr"],
  ["C10", "Russian", "ru"], ["C10", "Russisch", "ru"],
  ["C11", "Arabic", "ar"], ["C11", "Arabisch", "ar"],
  ["C12", "Chinese", "zh"], ["C12", "Chinesisch", "zh"], ["C12", "Mandarin", "zh"],
  ["C13", "Japanese", "ja"], ["C13", "Japanisch", "ja"],
  ["C13b", "Korean", "ko"], ["C13b", "Koreanisch", "ko"],
  ["C14", "Romanian", "ro"], ["C14", "Rumänisch", "ro"],
  ["C15", "Hungarian", "hu"], ["C15", "Ungarisch", "hu"],
  ["C16", "Ukrainian", "uk"], ["C16", "Ukrainisch", "uk"],
  ["C17", "Swedish", "sv"], ["C17", "Schwedisch", "sv"],
  ["C18", "Danish", "da"], ["C18", "Dänisch", "da"],
  ["C19", "Norwegian", "no"], ["C19", "Norwegisch", "no"],
  ["C20", "Finnish", "fi"], ["C20", "Finnisch", "fi"],
  ["C21", "Czech", "cs"], ["C21", "Tschechisch", "cs"],
  ["C22", "Greek", "el"], ["C22", "Griechisch", "el"],
  ["C23", "Hindi", "hi"],
  ["C24", "Kannada", "kn"],
  ["C25", " english ", "en"],
  ["C25b", "GERMAN", "de"],
  ["C26", "Klingon", null],
  ["C26b", "", null],
];

describe("languageCodeFor", () => {
  it.each(C)("%s: %j gives %s", (_id, name, code) => {
    expect(languageCodeFor(name)).toBe(code);
  });
});
