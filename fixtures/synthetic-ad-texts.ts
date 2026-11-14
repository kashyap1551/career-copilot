// The three synthetic sample ads as plain text, the way a person would paste
// them. They are not real postings (see docs/DECISIONS.md, the exception to
// rule 5); real public ads replace them before the reading test in step 3.2.
// The title line and the company and city line at the top come from each
// ad's own header fields, so the title and company are in the text.

export const northwindAdText = `Operations Analyst
Northwind Logistics, Manchester, UK

About the role: Northwind Logistics moves freight for retailers across the UK. You will turn warehouse and delivery data into decisions for our operations managers. Hybrid: three days a week in our Manchester office.

What you bring:
- At least 3 years of experience in an analyst role.
- Strong SQL for querying large data sets.
- Advanced Excel, including pivot tables and lookups.
- Fluent English, written and spoken.
- Able to explain findings clearly to non-technical managers.

Nice to have:
- Power BI or Tableau dashboard experience.
- Python for data cleaning.

You must have the right to work in the UK. We would like you to start within two months.
`;

export const brightwaterAdText = `Financial Planning Analyst
Brightwater Finserv, Bengaluru, India

About the role: Brightwater Finserv is a mid-size lending company. Our finance team builds the budgets and forecasts that leadership uses every quarter. This role is in our Bengaluru office, five days a week.

Requirements:
- 2 to 4 years of experience in financial planning and analysis.
- Advanced Excel financial modelling.
- Power BI for monthly reporting.
- Good English for working with our global team.
- Bachelor's degree in finance, commerce or a related field.

Preferred:
- Basic SQL.
- Knowledge of Hindi or Kannada.

Immediate joiners are preferred.
`;

export const fjordlightAdText = `Frontend Developer
Fjordlight Software, fully remote (Europe time zones)

About the role: Fjordlight builds scheduling software for clinics. You will build and maintain our React web app in a small remote team. Our working language is English.

You have:
- 4 or more years of experience building web applications.
- Strong TypeScript and React.
- Daily use of Git and pull-request reviews.
- Fluent English (C1 or better).

Bonus points:
- Testing with Vitest or Jest.
- Experience with accessibility standards.

We are not able to sponsor visas, so you must already be able to work in Europe.
`;

// A fourth synthetic ad, written to stress the checks: German and English
// mixed, an umlaut, a curly apostrophe, a header with two cities, a start
// date written "ab 1. April 2027", and German level wording.
export const lindenbergAdText = `Product Analyst (m/w/d)
Lindenberg Mobility GmbH · München oder Hamburg

About the role: We build a car-sharing app used in 12 German cities. As a Product Analyst you work with our product managers to turn usage data into decisions. We work hybrid: two days a week in the office.

Das bringst du mit:
- Mindestens drei Jahre Erfahrung in einer Analytics- oder Data-Rolle.
- Sehr gute SQL-Kenntnisse; Python or R is a plus.
- Experience with A/B testing and product metrics (retention, funnels).
- Fließend Deutsch und gutes Englisch.
- Erfahrung mit Mixpanel oder Amplitude.
- Strong communication skills: you explain results to non-technical colleagues.

Nice to have:
- Tableau or Looker dashboards.
- Basic knowledge of dbt.

Please note: you need a valid work permit for Germany. A Bachelor’s degree in a quantitative field (statistics, economics) is expected. Start: ab 1. April 2027, or earlier by arrangement.
`;
