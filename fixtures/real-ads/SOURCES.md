# Sources of the real job ads

The ad texts themselves (`ad-01.txt` to `ad-10.txt`) and their answer keys (`fixtures/answer-keys/`) are **not committed**: git history is permanent and this repository may go public. This file is committed and holds no ad text.

Rules for the set: public postings only; each from a company other than the owner's employer (and none from Picnic); recruiter names, emails and phone numbers removed from the copied text. `ad-09` and `ad-10` are the holdout ads: the eval prints only totals for them until tuning is done.

| File | Company | Country | URL | Date copied | Holdout |
|---|---|---|---|---|---|
| ad-01.txt | Flexport | United States | https://job-boards.greenhouse.io/flexport/jobs/8348058 | 2026-11-14 | |
| ad-02.txt | Flexport | Germany | https://job-boards.greenhouse.io/flexport/jobs/8378967 | 2026-11-14 | |
| ad-03.txt | DSV | Germany | https://www.dsv.com/en/careers/job-search/joboffer/v2/product-manager-tradelane-inbound-europe-hamburg-131970-de_DE | 2026-11-14 | |
| ad-04.txt | Flexport | Singapore | https://job-boards.greenhouse.io/flexport/jobs/7981879 | 2026-11-14 | |
| ad-05.txt | Razorpay | India | https://job-boards.greenhouse.io/razorpaysoftwareprivatelimited/jobs/4736585005 | 2026-11-14 | |
| ad-06.txt | Flexport | China | https://job-boards.greenhouse.io/flexport/jobs/8040985 | 2026-11-14 | |
| ad-07.txt | DSV | Germany | https://www.dsv.com/en/careers/job-search/joboffer/v2/quality-assurance-specialist-ims-m-w-d-meerbusch-132746-de_DE | 2026-11-14 | |
| ad-08.txt | Charles | Germany | https://job-boards.eu.greenhouse.io/charles/jobs/4982651101 | 2026-11-14 | |
| ad-09.txt | Tradin Organic | United States (remote) | https://tradinorganic.recruitee.com/o/category-specialist-us-remote | 2026-11-14 | yes |
| ad-10.txt | 4flow | United States | https://careers.4flow.com/jobs/account-executive-software/16dd5454-b195-46c1-8242-5adb3e54337d | 2026-11-14 | yes |

Known case (synthetic, committed): `fixtures/known-cases/barista-injection.txt`, a made-up ad written by Claude, source "synthetic sample" (see docs/DECISIONS.md).