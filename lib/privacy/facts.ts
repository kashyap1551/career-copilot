// Step 9.3, stage 2.2 (docs/PLAN-9.3.md section 3 and amendments A2, A3, A13): the facts the privacy page may state about the services we use.
//
// A fact is either NOT CONFIRMED (the page shows the fixed "not confirmed yet" sentence: no kind, no source, no date) or CONFIRMED, and then it
// says whether it is a QUOTATION (the provider's own sentence, shown in quotation marks with its source named) or an OBSERVATION (a plain statement
// of what the owner or the reviewer saw, with where and when), and it always has a source and an ISO date.
//
// Nothing here is written from memory. A fact becomes confirmed only when the owner brings the words or the observation, and the commit that flips
// it also changes its pinned copy in tests/privacyFacts.test.ts. While any fact is not confirmed, the gate test F3 fails when it is run with
// PRIVACY_GATE=1 (before any other person's CV goes through the live page, and before the link is shared for AI use).

export type Fact =
  | { id: string; status: "not-confirmed"; words: string; source: ""; date: "" }
  | { id: string; status: "confirmed"; kind: "quoted" | "observed"; words: string; source: string; date: string };

export const FACTS: Fact[] = [
  { id: "U1", status: "not-confirmed", words: "Not confirmed yet: whether the AI service uses what we send to train its models.", source: "", date: "" },
  {
    id: "U2a",
    status: "confirmed",
    kind: "quoted",
    words:
      "Starting October 15, 2025, Groq may store inputs and outputs for up to 30 days, strictly for purposes of maintaining system reliability and compliance. Enable to opt out of storing input and output data.",
    source: "Groq console, Data Controls page, as shown in our account",
    date: "2026-11-25",
  },
  {
    id: "U2b",
    status: "confirmed",
    kind: "observed",
    words: "In the Groq console, Zero Data Retention for inference calls (the setting called Inference APIs ZDR) is switched on for our account.",
    source: "Groq console, Data Controls page",
    date: "2026-11-25",
  },
  { id: "U3", status: "not-confirmed", words: "Not confirmed yet: the country where the AI service processes your text.", source: "", date: "" },
  {
    id: "U4a",
    status: "confirmed",
    kind: "observed",
    words:
      "For each request the hosting service (Vercel) logs the time, the method, the path, the status, the host, your browser's user agent text, a request ID and the receiving location. Its firewall view also shows the visitor's IP address, country, network provider and browser type.",
    source: "Vercel dashboard: the Logs request detail and the Firewall Traffic view",
    date: "2026-11-25",
  },
  { id: "U4b", status: "not-confirmed", words: "Not confirmed yet: how long the hosting service keeps its logs.", source: "", date: "" },
  { id: "U5", status: "not-confirmed", words: "Not confirmed yet: the region our server runs in.", source: "", date: "" },
  {
    id: "U6",
    status: "not-confirmed",
    words: "No analytics code is in this app. Whether the hosting service adds its own is not confirmed yet.",
    source: "",
    date: "",
  },
  {
    id: "U9",
    status: "confirmed",
    kind: "observed",
    words:
      "To limit abuse, the hosting service counts requests to paths that start with /api/ for each IP address in 60-second windows, and refuses a request with 'Too Many Requests' (429) after 10.",
    source: "Vercel Firewall rule api-rate-limit, checked live",
    date: "2026-11-25",
  },
];
