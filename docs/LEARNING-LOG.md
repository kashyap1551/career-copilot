# Learning log

One line per step: what you learned, in your own words. This becomes the case study.

| Date | Step | What I learned |
| --- | --- | --- |
| 2026-11-13 | 1.1 | Groq's free key took two minutes to make, and it goes only into Vercel and .env.local, never into a chat. |
| 2026-11-13 | 1.2 | The starter app came with its own git history and a wrong package name, so I checked what it left behind before the first commit. |
| 2026-11-13 | 1.3 | A settings file blocks Claude Code from reading my .env files, so the secrets rule is backed by a setting, not only by words. |
| 2026-11-13 | 1.4 | Vercel redeploys on every push to GitHub, and the live site needs its own copy of the keys, because .env.local stays on my laptop. |
| 2026-11-13 | 1.5 | The AI can obey text hidden in an ad, but not every time. A word-for-word check stops invented facts, though it wouldn't have caught the "Google" case, because the word was in the ad. The prompt, the schema and the check each guard against something different. |
| 2026-11-14 | 2.1 | Before an ad can become data, every kind of line needs a rule written down once: "and" splits a line, "or" keeps it as alternatives, years go into one number, and anything that can't be judged stays as an exact quote. With those rules the same ad always turns into the same data, and I can check it by hand. |
