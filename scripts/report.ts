import { jobs } from "../fixtures/jobs";
import { profiles } from "../fixtures/profiles";
import { skills } from "../fixtures/skills";
import { renderProfileReport } from "../lib/engine/report-text";

// npm run report -- sam     one person's report
// npm run report -- all     everyone
// npm run report            list the ids
// All the wording and layout live in lib/engine; this only prints.

const arg = process.argv[2];
const ids = profiles.map((p) => p.id).join(", ");

if (!arg) {
  console.log(`Usage: npm run report -- <profile id | all>\nProfiles: ${ids}`);
} else if (arg === "all") {
  const parts = profiles.map((p) => renderProfileReport(p, jobs, skills));
  process.stdout.write(parts.join("\n" + "=".repeat(72) + "\n\n"));
} else {
  const profile = profiles.find((p) => p.id === arg);
  if (!profile) {
    console.error(`No profile "${arg}". Profiles: ${ids}`);
    process.exitCode = 1;
  } else {
    process.stdout.write(renderProfileReport(profile, jobs, skills));
  }
}
