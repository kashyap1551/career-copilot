import { describe, expect, it } from "vitest";
import { containsContactDetails, removeContactDetails } from "@/lib/cv/redact";
import { formatNumbered, numberLines } from "@/lib/cv/numberLines";

// Hand-worked tables R1 to R5 and N1 to N3 of docs/PLAN-4.2.md (D2c): what the
// removal must take out, and what it must NOT touch. Expected values were
// written from the table, not from the code.

const E = "[email removed]";
const P = "[phone removed]";
const L = "[link removed]";

describe("removeContactDetails: must remove", () => {
  it("R1: an email address", () => {
    expect(removeContactDetails("jane.doe@example.com")).toBe(E);
    expect(removeContactDetails("Mail: first+tag@sub.example.co.uk, thanks")).toBe(`Mail: ${E}, thanks`);
  });

  it("R2: a phone number with a country code", () => {
    for (const n of ["+49 30 1234567", "+1 (555) 123-4567", "0049 30 1234567", "+353 1 555 0188", "+44 20 5550 0147"]) {
      expect(removeContactDetails(n)).toBe(P);
    }
  });

  it("R3: a phone number with an area code", () => {
    for (const n of ["0171 1234567", "(030) 123 45 67", "(555) 123-4567", "0151 555 0166", "0171 5550123"]) {
      expect(removeContactDetails(n)).toBe(P);
    }
  });

  it("R4: a link", () => {
    for (const n of [
      "https://www.example.com/jane",
      "http://example.org/a/b?c=d",
      "www.example.com",
      "linkedin.com/in/jane-doe",
      "github.com/jane-doe",
      "www.linkedin.com/in/jane-doe",
    ]) {
      expect(removeContactDetails(n)).toBe(L);
    }
  });

  it("R5: all three in one line, and the words around them stay", () => {
    expect(removeContactDetails("Contact: a@b.de | +49 30 1234567 | www.x.de")).toBe(`Contact: ${E} | ${P} | ${L}`);
    expect(removeContactDetails("Tel: +49 30 1234567, 2019-2023")).toBe(`Tel: ${P}, 2019-2023`);
    expect(removeContactDetails("See https://example.com/cv.")).toBe(`See ${L}.`);
  });

  it("R6: a phone number followed by a year on the same line leaves the year", () => {
    expect(removeContactDetails("+49 30 1234567 2019-2023")).toBe(`${P} 2019-2023`);
  });
});

describe("removeContactDetails: must NOT remove", () => {
  const unchanged = (...items: string[]) => {
    for (const s of items) expect(removeContactDetails(s)).toBe(s);
  };

  it("N1: dates", () => {
    unchanged("2019-2023", "2019 - 2023", "2021-03-01", "01.03.2021", "12/2021", "Q3 2024", "03/2021-05/2022", "01.03.2021 - 31.03.2021");
  });

  it("N2: numbers", () => {
    unchanged("ISO 27001", "10,000 users", "1,250,000 EUR", "3.5 years", "+3% growth", "ZIP 12345");
  });

  it("N3: versions and names", () => {
    unchanged("Python 3.11", "SQL Server 2019", "Node.js, ASP.NET, Vue.js", "(2019) 2020-2021", "(B1)", "e.g. Excel, i.e. tables");
  });

  it("N4: a bare domain without www or a profile host is not a link", () => {
    unchanged("jane-doe.com", "Built it with next.js and tailwind.css");
  });
});

describe("removeContactDetails: structure", () => {
  it("S1: never adds, removes or joins lines", () => {
    const text = "Tel +49 30 1234567\n2021-2024 Analyst\n\nmail a@b.de";
    const out = removeContactDetails(text);
    expect(out).toBe(`Tel ${P}\n2021-2024 Analyst\n\nmail ${E}`);
    expect(out.split("\n").length).toBe(text.split("\n").length);
  });

  it("S2: removing twice gives the same text, and the result holds no contact details", () => {
    const once = removeContactDetails("a@b.de +49 30 1234567 www.x.de 0171 1234567");
    expect(removeContactDetails(once)).toBe(once);
    expect(containsContactDetails(once)).toBe(false);
  });

  it("S3: containsContactDetails says yes for the details and no for the unchanged cases", () => {
    expect(containsContactDetails("write to a@b.de")).toBe(true);
    expect(containsContactDetails("+49 30 1234567")).toBe(true);
    expect(containsContactDetails("2019-2023, ISO 27001")).toBe(false);
  });
});

describe("numberLines", () => {
  it("L1: trims, drops blank lines, numbers from 1, handles CRLF", () => {
    expect(numberLines("  a  \r\n\r\n b\n   \nc")).toEqual(["a", "b", "c"]);
    expect(formatNumbered(["a", "b", "c"])).toBe("1: a\n2: b\n3: c");
  });

  it("L2: nothing in, nothing out", () => {
    expect(numberLines("")).toEqual([]);
    expect(numberLines(" \n\t\n")).toEqual([]);
  });
});
