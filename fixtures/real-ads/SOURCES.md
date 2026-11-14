# Sources of the real job ads

The ad texts themselves (`ad-01.txt` to `ad-10.txt`) and their answer keys (`fixtures/answer-keys/`) are **not committed**: git history is permanent and this repository may go public. This file is committed and holds no ad text.

Rules for the set: public postings only; each from a company other than the owner's employer (and none from Picnic); recruiter names, emails and phone numbers removed from the copied text. `ad-09` and `ad-10` are the holdout ads: the eval prints only totals for them until tuning is done.

| File | Company | Country | URL | Date copied | Holdout |
|---|---|---|---|---|---|
| ad-01.txt | | | | | |
| ad-02.txt | | | | | |
| ad-03.txt | | | | | |
| ad-04.txt | | | | | |
| ad-05.txt | | | | | |
| ad-06.txt | | | | | |
| ad-07.txt | | | | | |
| ad-08.txt | | | | | |
| ad-09.txt | | | | | yes |
| ad-10.txt | | | | | yes |

Known case (synthetic, committed): `fixtures/known-cases/barista-injection.txt`, a made-up ad written by Claude, source "synthetic sample" (see docs/DECISIONS.md).
