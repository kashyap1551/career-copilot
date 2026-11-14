import { describe, expect, it } from "vitest";
import { datesInText } from "@/lib/engine/dates";

// The date formats of table section G in docs/PLAN-3.1.md, worked out by hand.
// Every expected value is the calendar day the text says.

const same: [string, string][] = [
  ["ISO", "Start: 2027-03-01"],
  ["DD.MM.YYYY", "start on 01.03.2027"],
  ["D.M.YYYY", "start on 1.3.2027"],
  ["D Month YYYY", "Start: 1 March 2027"],
  ["Dst Month YYYY", "Start: 1st March 2027"],
  ["D. Monat YYYY (German)", "Start: 1. März 2027"],
  ["D Monat ohne Umlaut", "Start: 1 Maerz 2027"],
  ["Month D, YYYY", "Start: March 1, 2027"],
  ["Month Dst, YYYY", "Start: March 1st, 2027"],
  ["German with a word before", "ab 01.03.2027"],
  ["upper case", "START: 1 MARCH 2027"],
];

describe("datesInText: the same day in every format", () => {
  it.each(same)("%s: %s", (_name, text) => {
    expect(datesInText(text)).toEqual(["2027-03-01"]);
  });
});

describe("datesInText: other days and months", () => {
  it("English and German month names", () => {
    expect(datesInText("15. Dezember 2026")).toEqual(["2026-12-15"]);
    expect(datesInText("December 15, 2026")).toEqual(["2026-12-15"]);
    expect(datesInText("1 January 2027")).toEqual(["2027-01-01"]);
    expect(datesInText("3 Oktober 2027")).toEqual(["2027-10-03"]);
    expect(datesInText("31 May 2027")).toEqual(["2027-05-31"]);
    expect(datesInText("30. Mai 2027")).toEqual(["2027-05-30"]);
  });

  it("two dates come back in the order they appear, once each", () => {
    expect(datesInText("from 1 March 2027 to 30 June 2027")).toEqual(["2027-03-01", "2027-06-30"]);
    expect(datesInText("30 June 2027 or 1 March 2027")).toEqual(["2027-06-30", "2027-03-01"]);
    expect(datesInText("1 March 2027, again 01.03.2027")).toEqual(["2027-03-01"]);
  });

  it("DD.MM.YYYY is read day first", () => {
    expect(datesInText("ab 03.01.2027")).toEqual(["2027-01-03"]);
  });

  it("a leap day only in a leap year", () => {
    expect(datesInText("29 February 2028")).toEqual(["2028-02-29"]);
    expect(datesInText("29 February 2027")).toEqual([]);
  });
});

describe("datesInText: not a full date, so nothing", () => {
  const none: [string, string][] = [
    ["month and year only", "start in March 2027"],
    ["month only", "start in March"],
    ["year only", "start in 2027"],
    ["quarter", "Q1 2027"],
    ["two-digit year", "01.03.27"],
    ["not a real day", "30 February 2027"],
    ["not a real day, ISO", "2027-02-30"],
    ["month 13, ISO", "2027-13-01"],
    ["month 13, dotted", "01.13.2027"],
    ["words only", "start within two months"],
    ["empty", ""],
  ];
  it.each(none)("%s: %s", (_name, text) => {
    expect(datesInText(text)).toEqual([]);
  });
});
