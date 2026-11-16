STATUS: v0, APPROVED by the owner on 2026-11-16 "as drawn plus these fixes" (listed below). **From now on the source of truth is `lib/vocab/data.ts`, not this file.** This document was generated once from the corrected draft and is kept as the review record; edit the data file, and regenerate or hand-edit this table when it changes. Part of docs/PLAN-5.1.md.

# Starter vocabulary v0: review record

**What this is.** The skills the app recognises by name, in English and German, with the other ways people write them (aliases). Built from the skill names of ad-01 to ad-08, the five CV keys, the capture run of those, and general knowledge. The keys and capture of ad-09 and ad-10 were not opened, and the fresh set does not exist yet.

**Fixes applied after your review (2026-11-16).**
- Aliases in doubt are out of the aliases column and in the flag as "undecided alias: ..." (18 of them; they do NOT match until you decide). The aliases column now shows only what will really match.
- "HTML and CSS" is two skills, `html` and `css`; nothing merges them.
- `audience-growth` lost the alias "account growth" (in a sales ad it means growing customer accounts); that name stays unlisted.
- "Revenue conversations" is only on the not-a-skill list (vague). `e-commerce` is domain knowledge only; "online shop development" is not an alias.
- Soft skills as drawn; attention to detail, business acumen, commercial mindset and structured thinking stay on the not-a-skill list; role-experience phrases stay on it too (shown under "Check this yourself", not counted).
- Two aliases added while writing the hand-worked tests: "SQL Server" (for Microsoft SQL Server) and "Java Script" (for JavaScript).

**How matching works (5.1).** A name is matched exactly, after folding case, accents and ß and turning hyphens into spaces. If that finds nothing, level and filler words (advanced, basic, Kenntnisse, Erfahrung, knowledge of ...) are dropped and the name is tried again, then a trailing version number is dropped ("Python 3.11" is Python). Single letters and very common words (R, C, Go) match only an exact alias. No close-spelling step yet (that is 5.2). Entries are flat: MySQL is not SQL, Tableau is not Power BI.

**Columns.** `source`: existing, test ad, CV, or general. A `?` after a German name or alias means unsure (they match like any other until you correct them). `flag`: what the entry could be confused with, or a doubt.

**Counts.** Batch 1: 71 entries (45 flagged). Batch 2: 66 (45 flagged). Batch 3: 70 (46 flagged). New entries in all: 207. The 17 existing ids (table 3) keep their ids and names. Not-a-skill list (table 2): 50 phrases.

## German names to check
Entries whose German name or alias has a `?` (28 skill entries and 22 not-a-skill phrases):

- llms: Große Sprachmodelle
- data-analysis: Datenauswertung
- dashboards: Dashboard-Erstellung
- reporting: Berichte erstellen
- experimentation: Experimentierung
- root-cause-analysis: Ursachenforschung
- metrics-definition: Kennzahlenentwicklung
- freight-forwarding: Speditionswesen
- air-carrier-operations: Betrieb von Fluggesellschaften
- carrier-negotiation: Frachtführerverhandlungen
- rfq-handling: Bearbeitung von Angebotsanfragen
- freight-management-systems: Frachtmanagementsysteme
- supply-chain-systems: Supply-Chain-Execution-Systeme
- audits: Revision
- deviation-management: Abweichungsmanagement
- project-management: Projektleitung
- delivery-planning: Auslieferungsplanung
- customer-service: Kundenbetreuung
- executive-communication: Kommunikation mit der Geschäftsführung
- presentation-skills: Präsentationstechnik
- recruiting: Personalbeschaffung
- growth-product-management: Growth-Produktmanagement
- persona-development: Persona-Entwicklung
- prd-writing: Produktanforderungsdokumente
- pl-management: GuV-Verantwortung
- account-management: Kundenbetreuung im Vertrieb
- audience-growth: Reichweitenaufbau
- market-sizing: Marktgrößenbestimmung

Not-a-skill phrases: empathy for business pain points: Einfühlungsvermögen für Geschäftsprobleme; structured action-biased ownership: strukturierte, handlungsorientierte Eigenverantwortung; comfort with ambiguity: Umgang mit Unsicherheit; generalist mindset: Generalisten-Mindset; building something of your own: etwas Eigenes aufbauen; customer-first and business-first thinking: Kunden- und Geschäftsorientierung; user and business focus: Nutzer- und Geschäftsfokus; user focus: Nutzerfokus; adapting to new technology: Offenheit für neue Technologien; hands-on, fast-paced working: praxisnahes, schnelles Arbeiten; enabling technologies: Zukunftstechnologien; finding insights: Erkenntnisse gewinnen; complex datasets: komplexe Datensätze; legal and operational requirements: rechtliche und betriebliche Anforderungen; translating growth levers into P&L impact: Wachstumshebel in GuV-Wirkung übersetzen; revenue conversations: Gespräche über Umsatz; Multi-market APAC experience: Erfahrung in mehreren APAC-Märkten; BI engineer experience: Erfahrung als BI-Ingenieur; data analyst experience: Erfahrung als Datenanalyst; product analyst experience: Erfahrung als Product Analyst; internal operator platforms: interne Betreiberplattformen; auditor qualifications: Auditorenqualifikation

## Table 1, batch 1: tools, data and engineering (71)
| id | English | German | aliases | source | flag |
| --- | --- | --- | --- | --- | --- |
| looker | Looker | Looker |  | test ad | Looker Studio is a different product; alias left out until you decide; undecided alias: Looker Studio |
| dbt | dbt | dbt | data build tool | test ad |  |
| salesforce | Salesforce | Salesforce | Salesforce CRM, SFDC | test ad | not Pardot, not 'CRM systems' |
| pardot | Salesforce Account Engagement (Pardot) | Salesforce Account Engagement (Pardot) | Pardot, Account Engagement | test ad | not Salesforce |
| hubspot | HubSpot | HubSpot | HubSpot CRM, HubSpot Marketing Hub | test ad |  |
| marketo | Marketo | Marketo | Marketo Engage, Adobe Marketo | test ad |  |
| pipedrive | Pipedrive | Pipedrive |  | test ad |  |
| crm-systems | CRM systems | CRM-Systeme | CRM, CRM system, CRM software, customer relationship management | test ad | generic; a named CRM (Salesforce, HubSpot) is its own entry |
| google-sheets | Google Sheets | Google Tabellen | G Sheets, Google Spreadsheets | test ad | not Excel, not 'Spreadsheets' |
| ms-office | Microsoft Office | Microsoft Office | MS Office, Office 365, Microsoft 365, MS-Office-Kenntnisse | test ad | Excel is its own entry |
| r-language | R | R | R programming, R language, R-Programmierung | test ad | single letter: exact alias only, never by spelling; not Rust |
| llms | Large language models | Große Sprachmodelle? | LLMs, LLM, language models | test ad |  |
| prompt-engineering | Prompt engineering | Prompt Engineering | prompt design, prompting | test ad |  |
| ai-agents | AI agents | KI-Agenten | agentic AI, AI agent development | test ad |  |
| data-modelling | Data modelling | Datenmodellierung | data modeling, ELT data modeling, dimensional modelling | test ad |  |
| data-analysis | Data analysis | Datenanalyse | analysing data, data analytics, Datenauswertung? | test ad | 'analytics' alone is broad; not Product analytics; undecided alias: analytics |
| data-visualisation | Data visualisation | Datenvisualisierung | data visualization, data visualizations, data viz | test ad | not Dashboards |
| dashboards | Dashboards | Dashboards | dashboard creation, dashboard building, Dashboard-Erstellung? | test ad; CV | not Data visualisation |
| reporting | Reporting | Berichtswesen | report creation, weekly reporting, report writing, Berichte erstellen? | CV | not Financial reporting or Cost reporting |
| business-intelligence | Business intelligence | Business Intelligence | BI, BI tools, BI engineering | general | not Power BI, not Looker |
| pivot-tables | Pivot tables | Pivot-Tabellen | pivot table, PivotTables | CV | part of Excel work but kept separate |
| spreadsheets | Spreadsheets | Tabellenkalkulation | spreadsheet, spreadsheet management | CV | NOT Excel: a spreadsheet does not say which tool; undecided alias: Tabellen |
| database-querying | Database querying | Datenbankabfragen | data querying, querying databases | CV | not SQL (SQL has its own entry; 'SQL queries' is an SQL alias) |
| applied-statistics | Applied statistics | Angewandte Statistik | statistics, statistical analysis, Statistik | test ad |  |
| experimentation | Experimentation | Experimentierung? | experimentation frameworks, experiments, controlled experiments | test ad | A/B testing is its own entry |
| cohort-analysis | Cohort analysis | Kohortenanalyse | cohort analyses | test ad |  |
| funnel-analysis | Funnel analysis | Funnel-Analyse | conversion funnel analysis, funnel analytics | test ad |  |
| product-analytics | Product analytics | Produktanalyse | product analysis, product data analysis | test ad | not Data analysis |
| unit-economics | Unit economics | Unit Economics | unit economics modelling | test ad |  |
| roi-tracking | ROI tracking | ROI-Tracking | ROI measurement, ROI analysis, return on investment tracking | test ad |  |
| campaign-analysis | Campaign performance analysis | Kampagnenanalyse | campaign analytics, campaign reporting, marketing analytics | test ad |  |
| root-cause-analysis | Root cause analysis | Ursachenanalyse | RCA, root-cause analysis, Ursachenforschung? | test ad |  |
| metrics-definition | Metrics definition | Kennzahlenentwicklung? | metrics frameworks, metrics development, KPI definition, KPI frameworks | test ad | not KPI tracking |
| unit-testing | Unit testing | Unit-Tests | unit tests, writing unit tests | CV | not Jest or Vitest (tools) |
| code-review | Code review | Code-Review | code reviews, reviewing code, pull request reviews | CV | not Git |
| frontend-development | Frontend development | Frontend-Entwicklung | front-end development, frontend, front end development, web frontend | CV | not React or TypeScript |
| web-development | Web development | Webentwicklung | web dev, website development | general |  |
| javascript | JavaScript | JavaScript | JS, ECMAScript, JavaScript development, Java Script | general | NOT Java; 'Java Script' spelled apart must still reach this, never Java |
| java | Java | Java | Java development, Java SE, Java-Entwicklung | general | NOT JavaScript |
| nodejs | Node.js | Node.js | NodeJS, node-js | general | not JavaScript; undecided alias: Node |
| html | HTML | HTML | HTML5 | general | not CSS |
| css | CSS | CSS | CSS3 | general | not HTML |
| nosql | NoSQL | NoSQL | NoSQL databases, non-relational databases | general | NOT SQL |
| mysql | MySQL | MySQL | My SQL, MySQL database | general | NOT SQL (related, kept separate: flat vocabulary) |
| postgresql | PostgreSQL | PostgreSQL | Postgres | general | not SQL; undecided alias: PG |
| sql-server | Microsoft SQL Server | Microsoft SQL Server | MS SQL Server, MSSQL, T-SQL, SQL Server | general | NOT SQL |
| mongodb | MongoDB | MongoDB | Mongo | general | not NoSQL |
| c-sharp | C# | C# | C sharp, CSharp, C-Sharp | general | NOT C or C++ |
| c-plus-plus | C++ | C++ | C plus plus, CPP | general | NOT C or C# |
| c-language | C | C | C programming, C language, C-Programmierung | general | single letter: exact alias only; NOT C++ or C# |
| go-language | Go | Go | Golang, Go programming | general | the word 'go' is common: only 'Golang' and 'Go programming' are aliases |
| rust | Rust | Rust | Rust programming | general | not R |
| swift | Swift | Swift | Swift programming, Swift development | general | not the word 'shift'; not SWIFT payments |
| kotlin | Kotlin | Kotlin |  | general |  |
| php | PHP | PHP |  | general |  |
| docker | Docker | Docker | Docker containers, containerisation, containerization | general | not Kubernetes |
| kubernetes | Kubernetes | Kubernetes | K8s | general | not Docker |
| aws | Amazon Web Services | Amazon Web Services | AWS, Amazon AWS | general |  |
| azure | Microsoft Azure | Microsoft Azure | Azure | general |  |
| gcp | Google Cloud Platform | Google Cloud Platform | GCP, Google Cloud | general |  |
| linux | Linux | Linux | GNU/Linux, Linux administration | general |  |
| rest-apis | REST APIs | REST-APIs | REST API, RESTful APIs, API development, API integration | general |  |
| ci-cd | CI/CD | CI/CD | continuous integration, continuous delivery, CI CD pipelines | general |  |
| machine-learning | Machine learning | Maschinelles Lernen | ML, machine-learning | general | not LLMs |
| pandas | pandas | pandas | Python pandas | general | not Python |
| vba | VBA | VBA | Excel VBA, Visual Basic for Applications, Excel macros | general | not Excel |
| power-query | Power Query | Power Query | Power Query M | general | NOT Power BI |
| google-analytics | Google Analytics | Google Analytics | GA4, Universal Analytics | general |  |
| angular | Angular | Angular |  | general | NOT AngularJS (a different framework): no alias for it |
| vuejs | Vue.js | Vue.js | Vue, VueJS | general |  |
| github | GitHub | GitHub |  | general | NOT Git (GitHub is a service; Git is the tool); undecided alias: GitHub Actions |

## Table 1, batch 2: operations, quality, business and soft skills that are real skills (66)
| id | English | German | aliases | source | flag |
| --- | --- | --- | --- | --- | --- |
| logistics | Logistics | Logistik | logistics operations | test ad |  |
| supply-chain-management | Supply chain management | Lieferkettenmanagement | supply chain, Supply-Chain-Management | test ad | undecided alias: SCM |
| freight-forwarding | Freight forwarding | Spedition | freight forwarder experience, Speditionswesen? | test ad | not Logistics |
| air-freight | Air freight | Luftfracht | air cargo, airfreight, air freight knowledge | test ad | not Ocean freight |
| ocean-freight | Ocean freight | Seefracht | sea freight, ocean shipping | test ad | not Air freight |
| air-carrier-operations | Air carrier operations | Betrieb von Fluggesellschaften? | airline operations, air carrier operation | test ad |  |
| trade-lane-management | Trade lane management | Trade-Lane-Management | trade lane planning, trade management | test ad |  |
| carrier-negotiation | Carrier negotiation | Frachtführerverhandlungen? | carrier rate negotiation, freight rate negotiation | test ad | not Negotiation (general) |
| rfq-handling | RFQ handling | Bearbeitung von Angebotsanfragen? | RFQs, RFQ, request for quotation, request for quote | test ad |  |
| procurement | Procurement | Einkauf | purchasing, Beschaffung | test ad | undecided alias: sourcing |
| pricing | Pricing | Preisgestaltung | pricing strategy, price setting, Pricing-Strategie | test ad | not Revenue conversations |
| freight-management-systems | Freight management systems | Frachtmanagementsysteme? | TMS, transport management systems, freight technology | test ad | not Logistics |
| supply-chain-systems | Supply chain execution systems | Supply-Chain-Execution-Systeme? | WMS, warehouse management systems, supply chain systems | test ad | not Freight management systems |
| market-analysis | Market analysis | Marktanalyse | market research, market assessment, Marktforschung | test ad |  |
| compliance | Compliance | Compliance | regulatory compliance, legal compliance | test ad |  |
| audits | Audits | Audits | auditing, internal audits, audit, Revision? | test ad |  |
| quality-management | Quality management | Qualitätsmanagement | QM, QMS, quality management systems | test ad | not Quality assurance |
| quality-assurance | Quality assurance | Qualitätssicherung |  | test ad | 'QA' also means software testing: left to review; undecided alias: QA |
| qhse | QHSE | QHSE | quality health safety environment, HSEQ | test ad |  |
| iso-9001 | ISO 9001 | ISO 9001 | ISO9001 | test ad | NOT the other ISO standards: each number is its own entry |
| iso-14001 | ISO 14001 | ISO 14001 | ISO14001 | test ad | NOT the other ISO standards |
| iso-45001 | ISO 45001 | ISO 45001 | ISO45001 | test ad | NOT the other ISO standards; OHSAS 18001 left out |
| iso-50001 | ISO 50001 | ISO 50001 | ISO50001 | test ad | NOT the other ISO standards |
| iso-27001 | ISO 27001 | ISO 27001 | ISO27001, information security management | general | NOT the other ISO standards |
| integrated-management-systems | Integrated management systems | Integrierte Managementsysteme | management system standards, management systems | test ad | not the single ISO entries; undecided alias: IMS |
| risk-assessment | Risk assessment | Risikobewertung | risk analysis, risk and deviation assessment, Risikoanalyse | test ad | not Risk management |
| risk-management | Risk management | Risikomanagement |  | general | not Risk assessment |
| deviation-management | Deviation assessment | Abweichungsmanagement? | deviation handling, nonconformity handling | test ad |  |
| process-management | Process management | Prozessmanagement | business process management, BPM | test ad | not Process improvement |
| process-improvement | Process improvement | Prozessoptimierung | continuous improvement, improvement measures, Verbesserungsmaßnahmen | test ad | not Process management; undecided alias: lean |
| standardisation | Standardisation | Standardisierung | standardization, standardising processes | test ad |  |
| project-management | Project management | Projektmanagement | managing projects, project coordination, Projektleitung? | test ad | NOT Product management |
| consulting | Consulting | Beratung | consultancy, advisory, consulting skills | test ad |  |
| documentation | Documentation | Dokumentation | writing documentation, management system documentation | CV; test ad | not Technical writing |
| technical-writing | Technical writing | Technisches Schreiben | writing guides, technical documentation | CV | not Documentation |
| training | Training | Schulung | training colleagues, onboarding new starters, Einarbeitung | CV | giving training only; 'learning' or 'being trained' is not this skill; undecided alias: coaching |
| scheduling | Scheduling | Einsatzplanung | rota planning, shift planning, staff scheduling, Dienstplanung | CV | not 'shift' as a word alone |
| delivery-planning | Delivery planning | Auslieferungsplanung? | dispatch planning, route planning, Tourenplanung | CV | not Logistics |
| inventory-management | Inventory management | Bestandsverwaltung | stock keeping, stock control, stock management, Lagerverwaltung | CV | undecided alias: inventory |
| invoice-checking | Invoice checking | Rechnungsprüfung | invoice reconciliation, invoice matching, order matching | CV |  |
| cost-reporting | Cost reporting | Kostenreporting | cost tracking, cost summaries | CV | not Financial reporting or Reporting |
| financial-reporting | Financial reporting | Finanzberichterstattung | finance reporting, Finanzreporting | CV | not Cost reporting |
| budgeting | Budgeting | Budgetplanung | budget management, budget planning | general | not Financial planning and analysis |
| accounting | Accounting | Buchhaltung | bookkeeping, Rechnungswesen | general |  |
| customer-service | Customer service | Kundenservice | customer support, customer care, Kundenbetreuung? | CV | not Phone support |
| phone-support | Phone support | Telefonischer Support | telephone support, call handling, answering phones | CV | not Customer service |
| customer-needs-analysis | Customer needs analysis | Bedarfsanalyse | understanding customer needs, needs assessment | test ad |  |
| relationship-management | Relationship management | Beziehungsmanagement | relationship building, account relationship management | test ad | not Stakeholder management |
| stakeholder-management | Stakeholder management | Stakeholder-Management | managing stakeholders, influencing stakeholders, stakeholder communication | test ad | not Executive communication |
| executive-communication | Executive communication | Kommunikation mit der Geschäftsführung? | communicating with executives, C-level communication, executive stakeholder communication | test ad | NOT Communication (the general skill) |
| cross-functional-collaboration | Cross-functional collaboration | Bereichsübergreifende Zusammenarbeit | cross-functional coordination, working across departments, cross-team collaboration | test ad |  |
| negotiation | Negotiation | Verhandlungsführung | negotiating, negotiation skills, Verhandlungsgeschick | general | not Carrier negotiation |
| facilitation | Facilitation | Moderation | meeting facilitation, moderating meetings, meeting moderation, workshop facilitation | CV |  |
| presentation-skills | Presentation skills | Präsentationstechnik? | presenting, Präsentieren | general |  |
| time-management | Time management | Zeitmanagement | managing time, managing multiple priorities, multitasking | test ad | BORDERLINE: skill or trait? kept as a skill |
| prioritisation | Prioritisation | Priorisierung | prioritization, prioritising tasks, managing priorities | test ad | not Backlog prioritisation |
| problem-solving | Problem solving | Problemlösung | problem-solving, solving problems | test ad | BORDERLINE: skill or trait? kept as a skill |
| analytical-thinking | Analytical thinking | Analytisches Denken | analytical skills, analytical mindset, Analytische Fähigkeiten | test ad | BORDERLINE: skill or trait? kept as a skill; undecided alias: analytical |
| systems-thinking | Systems thinking | Systemisches Denken | systemic thinking | test ad | BORDERLINE: skill or trait? |
| teamwork | Teamwork | Teamarbeit | working in a team, team collaboration, Teamfähigkeit | test ad | BORDERLINE; 'team player' is on the not-a-skill list |
| localisation | Localisation | Lokalisierung | localization, localising content, content localisation | test ad |  |
| event-management | Event management | Eventmanagement | organising events, event organisation, Veranstaltungsorganisation | test ad | undecided alias: events |
| public-relations | Public relations | Öffentlichkeitsarbeit | PR, media relations, press relations, Pressearbeit | test ad |  |
| customer-success | Customer success | Customer Success | customer success management | general | undecided alias: CSM |
| recruiting | Recruiting | Recruiting | talent acquisition, Personalbeschaffung? | general |  |
| data-entry | Data entry | Dateneingabe | data input | general |  |

## Table 1, batch 3: product management (general), marketing, sales and content (70)
| id | English | German | aliases | source | flag |
| --- | --- | --- | --- | --- | --- |
| product-management | Product management | Produktmanagement | product management experience, Product Management | test ad | NOT Project management |
| growth-product-management | Growth product management | Growth-Produktmanagement? | growth PM | test ad | not Product management in general |
| product-roadmapping | Product roadmapping | Produkt-Roadmapping | roadmapping, product roadmap, roadmap planning, roadmap communication | general |  |
| backlog-prioritisation | Backlog prioritisation | Backlog-Priorisierung | backlog management, backlog prioritization, backlog grooming, backlog refinement | general | not Prioritisation (general) |
| user-research | User research | Nutzerforschung | UX research, user insights, customer research, Nutzerforschung | general | not User interviews or Market analysis |
| user-interviews | User interviews | Nutzerinterviews | customer interviews, discovery interviews | general | part of User research; kept separate |
| usability-testing | Usability testing | Usability-Tests | user testing, usability studies | general | not Unit testing |
| ab-testing | A/B testing | A/B-Tests | AB testing, split testing | general | inside Experimentation; kept separate |
| product-discovery | Product discovery | Product Discovery | continuous discovery | general |  |
| product-strategy | Product strategy | Produktstrategie | product vision, strategic product planning | general |  |
| okrs | OKRs | OKRs | objectives and key results, OKR | general |  |
| kpi-tracking | KPI tracking | KPI-Tracking | KPIs, KPI monitoring, KPI reporting | general | not Metrics definition |
| jira | Jira | Jira | Atlassian Jira, JIRA | general | not Confluence |
| confluence | Confluence | Confluence | Atlassian Confluence | general | not Jira |
| scrum | Scrum | Scrum | Scrum Master, Scrum framework | general | not Agile in general |
| agile | Agile | Agile | agile methods, agile methodologies, agile development, Agile working | general | not Scrum or Kanban |
| kanban | Kanban | Kanban | Kanban boards | general |  |
| user-stories | User stories | User Stories | writing user stories, acceptance criteria | general |  |
| requirements-gathering | Requirements gathering | Anforderungsanalyse | requirements analysis, requirements elicitation, requirements engineering | general |  |
| go-to-market | Go-to-market | Go-to-Market | go to market strategy, product launches | general | undecided alias: GTM |
| competitive-analysis | Competitive analysis | Wettbewerbsanalyse | competitor analysis, competitive research | general | not Market analysis |
| persona-development | Persona development | Persona-Entwicklung? | personas, creating personas | general |  |
| wireframing | Wireframing | Wireframing | wireframes, low-fidelity mockups | general |  |
| prototyping | Prototyping | Prototyping | prototypes, building prototypes | general | not Wireframing |
| figma | Figma | Figma |  | general | tool, not Prototyping |
| ux-design | UX design | UX-Design | UX, user experience design, Workflow UX | test ad | not User research |
| amplitude | Amplitude | Amplitude | Amplitude Analytics | general | not Product analytics (the method) |
| mixpanel | Mixpanel | Mixpanel |  | general |  |
| data-driven-decision-making | Data-driven decision making | Datengetriebene Entscheidungsfindung | data-driven decisions, data-informed decision making, Datenbasierte Entscheidungen | general |  |
| product-led-growth | Product-led growth | Product-Led Growth | PLG, PLG initiatives, product led growth | test ad | not Growth product management |
| release-management | Release management | Release-Management | release planning, managing releases | general |  |
| sprint-planning | Sprint planning | Sprint-Planung | sprint planning sessions | general | not Scheduling |
| prioritisation-frameworks | Prioritisation frameworks | Priorisierungsframeworks | RICE, MoSCoW, impact-effort prioritization, ICE scoring | test ad | not Prioritisation or Backlog prioritisation |
| product-marketing | Product marketing | Produktmarketing | PMM | general | not Product management |
| customer-journey-mapping | Customer journey mapping | Customer-Journey-Mapping | journey mapping, customer journeys | general |  |
| retention-analysis | Retention analysis | Retention-Analyse | churn analysis, retention metrics | general | not Cohort analysis |
| user-onboarding | User onboarding | User Onboarding | onboarding flows, onboarding optimisation | general | not Training (staff onboarding) |
| product-operations | Product operations | Product Operations | product ops, ProdOps | general |  |
| vendor-management | Vendor management | Lieferantenmanagement | supplier management, vendor relations | general | not Procurement |
| prd-writing | Product requirements documents | Produktanforderungsdokumente? | PRD, PRDs, writing PRDs, product specs | general | not Documentation |
| pl-management | P&L management | GuV-Verantwortung? | P&L, P&L impact, P&L ownership, profit and loss | test ad | not Financial planning |
| content-marketing | Content marketing | Content-Marketing | B2B content marketing, content strategy | test ad | not Content creation |
| demand-generation | Demand generation | Demand Generation | demand-gen marketing, demand gen, demand generation marketing | test ad | not Lead generation |
| field-marketing | Field marketing | Field Marketing |  | test ad |  |
| lead-generation | Lead generation | Lead-Generierung | lead gen, generating leads, Leadgenerierung | test ad | not Demand generation |
| cold-calling | Cold calling | Kaltakquise | cold calls, outbound calling | test ad |  |
| social-selling | Social selling | Social Selling |  | test ad | not Social media |
| pre-sales | Pre-sales | Pre-Sales | presales, pre-qualification, pre-sales support | test ad |  |
| sales | Sales | Vertrieb | selling, closing deals, sales success, Verkauf | test ad |  |
| account-management | Account management | Account Management | key account management, Kundenbetreuung im Vertrieb? | general | not Customer service |
| linkedin | LinkedIn | LinkedIn |  | test ad | not LinkedIn Sales Navigator |
| linkedin-sales-navigator | LinkedIn Sales Navigator | LinkedIn Sales Navigator | LinkedIn Navigator, Sales Navigator | test ad | not LinkedIn |
| email-outreach | Email outreach | E-Mail-Outreach | outreach emails, cold email | test ad | not Email marketing |
| email-marketing | Email marketing | E-Mail-Marketing | newsletter marketing, newsletters, newsletter, email campaigns | CV | not Email outreach |
| marketing-automation | Marketing automation | Marketing-Automatisierung | marketing automation tools | general | not Mailchimp or Marketo (tools) |
| google-ads | Google Ads | Google Ads | AdWords, Google AdWords, paid search | general |  |
| paid-social | Paid social | Paid Social | Meta Ads, Facebook Ads, paid social advertising | general |  |
| brand-management | Brand management | Markenmanagement | branding, brand strategy | general |  |
| mailchimp | Mailchimp | Mailchimp |  | CV | not Email marketing (the skill) |
| instagram | Instagram | Instagram | Instagram marketing | CV | not Social media (general) |
| copywriting | Copywriting | Texten | copy writing, writing copy, Content writing | CV | not Content creation |
| content-creation | Content creation | Content-Erstellung | creating content, social media content, Content Creation | CV | not Copywriting |
| audience-growth | Audience growth | Reichweitenaufbau? | community growth, follower growth | CV | not Product-led growth; the name 'account growth' stays unlisted: in a sales ad it means growing customer accounts |
| video-editing | Video editing | Videobearbeitung | video production, short video editing, video editing software | CV |  |
| customer-feedback-analysis | Customer feedback analysis | Analyse von Kundenfeedback | feedback analysis, analysing customer feedback, voice of the customer, VoC | general | not User research |
| technical-product-management | Technical product management | Technisches Produktmanagement | technical product manager experience, API product management | general | not Product management in general |
| market-sizing | Market sizing | Marktgrößenbestimmung? | TAM SAM SOM, market size estimation | general | not Market analysis |
| business-case-development | Business case development | Erstellung von Business Cases | business cases, building business cases, business case | general |  |
| mvp-definition | MVP definition | MVP-Definition | MVP scoping, defining an MVP, minimum viable product | general |  |
| e-commerce | E-commerce | E-Commerce | ecommerce, European e-commerce market, e-commerce market knowledge | CV | domain knowledge only (the market, the sector); building a shop is not this skill |

## Table 2: the not-a-skill list (50)
A requirement whose every name is on this list is **not counted** as a must-have or nice-to-have: it stays visible under "Check this yourself" with its quote, and the counts sentence says "N requirements are not skills a CV can show (for example personal traits) and were not counted; they are listed below." Real soft skills (Communication, Negotiation, Teamwork, Time management, Problem solving, Analytical thinking) are skills in table 1, not here.

| phrase | German | class | note |
| --- | --- | --- | --- |
| team player | Teamplayer | trait |  |
| empathy | Empathie | trait |  |
| empathy for business pain points | Einfühlungsvermögen für Geschäftsprobleme? | trait |  |
| bias for action | Handlungsorientierung | trait |  |
| ownership | Eigenverantwortung | trait |  |
| structured action-biased ownership | strukturierte, handlungsorientierte Eigenverantwortung? | trait | phrase from a test ad |
| structured, independent, solution-oriented work style | strukturierte, selbstständige, lösungsorientierte Arbeitsweise | trait |  |
| comfort with ambiguity | Umgang mit Unsicherheit? | trait |  |
| commercial mindset | kaufmännisches Denken | trait | BORDERLINE: could be a skill (business acumen) |
| business acumen | Geschäftsverständnis | trait | BORDERLINE: could be a skill |
| generalist mindset | Generalisten-Mindset? | trait |  |
| entrepreneurship | Unternehmergeist | trait |  |
| building something of your own | etwas Eigenes aufbauen? | trait |  |
| structured thinking | strukturiertes Denken | trait | BORDERLINE: close to Analytical thinking (a skill) |
| customer-first and business-first thinking | Kunden- und Geschäftsorientierung? | trait |  |
| user and business focus | Nutzer- und Geschäftsfokus? | trait |  |
| user focus | Nutzerfokus? | trait |  |
| attention to detail | Sorgfalt | trait | BORDERLINE: a personal quality, so not counted |
| adapting to new technology | Offenheit für neue Technologien? | trait |  |
| receiving feedback | Feedback annehmen | trait |  |
| feedback | Feedback | trait |  |
| working independently | selbstständiges Arbeiten | trait |  |
| hands-on, fast-paced working | praxisnahes, schnelles Arbeiten? | environment |  |
| fast-paced environment | dynamisches Umfeld | environment |  |
| Eigeninitiative | Eigeninitiative | trait | German trait |
| Zuverlässigkeit | Zuverlässigkeit | trait | German trait |
| Belastbarkeit | Belastbarkeit | trait | German trait |
| Flexibilität | Flexibilität | trait | German trait |
| Lernbereitschaft | Lernbereitschaft | trait | German trait |
| Verantwortungsbewusstsein | Verantwortungsbewusstsein | trait | German trait |
| Engagement | Engagement | trait | German trait |
| Hands-on-Mentalität | Hands-on-Mentalität | trait | German trait |
| Kundenorientierung | Kundenorientierung | trait | BORDERLINE: could be Customer service |
| best practices | Best Practices | vague | names no skill |
| enabling technologies | Zukunftstechnologien? | vague |  |
| finding insights | Erkenntnisse gewinnen? | vague |  |
| growth | Wachstum | vague | alone, no skill named |
| complex datasets | komplexe Datensätze? | vague | describes data, not a skill |
| legal and operational requirements | rechtliche und betriebliche Anforderungen? | vague |  |
| translating growth levers into P&L impact | Wachstumshebel in GuV-Wirkung übersetzen? | vague | phrase from a test ad; P&L management is the skill |
| revenue conversations | Gespräche über Umsatz? | vague | vague; stays ONLY here (not a skill entry) |
| Multi-market APAC experience | Erfahrung in mehreren APAC-Märkten? | experience | a region, not a skill |
| BI engineer experience | Erfahrung als BI-Ingenieur? | role experience | BORDERLINE: a job title; Data analysis may be what is meant |
| data analyst experience | Erfahrung als Datenanalyst? | role experience | BORDERLINE: a job title |
| product analyst experience | Erfahrung als Product Analyst? | role experience | BORDERLINE: a job title |
| B2B workflow software | B2B-Workflow-Software | domain | an industry, not a skill |
| internal operator platforms | interne Betreiberplattformen? | domain | an industry term |
| auditor qualifications | Auditorenqualifikation? | qualification | BORDERLINE: a qualification; may belong with Audits |
| fast learner | schnelle Auffassungsgabe | trait |  |
| motivation | Motivation | trait |  |

## Table 3: the 17 existing ids, unchanged
Id and English name stay exactly as in `fixtures/skills.ts` (tests depend on them).

| id | English (unchanged) | German | aliases | flag |
| --- | --- | --- | --- | --- |
| sql | SQL | SQL | SQL-Kenntnisse, SQL Kenntnisse, SQL queries, SQL-Abfragen, Structured Query Language, SQL knowledge | NOT MySQL, NoSQL, SQL Server, PostgreSQL |
| excel | Excel | Excel | MS Excel, Microsoft Excel, Excel-Kenntnisse, Excel (advanced), Advanced Excel, Excel formulas, Excel skills | NOT Spreadsheets, Google Sheets, VBA |
| python | Python | Python | Python 3, Python-Kenntnisse, Python programming, Python scripting | not pandas |
| seo | SEO | SEO | search engine optimisation, search engine optimization, Suchmaschinenoptimierung, SEO-Kenntnisse |  |
| social-media | Social media | Social Media | social media management, social media marketing, Social-Media-Marketing, Social-Media-Management | not Instagram, not Social selling |
| canva | Canva | Canva | Canva design |  |
| typescript | TypeScript | TypeScript | TS, Typescript | NOT JavaScript |
| react | React | React | React.js, ReactJS, React JS | not Angular, not Vue |
| git | Git | Git | Git version control, Versionsverwaltung | NOT GitHub; 'version control' is broad; undecided alias: version control |
| communication | Communication | Kommunikation | communication skills, Kommunikationsfähigkeit, Kommunikationsstärke, communicating | NOT Executive communication |
| power-bi | Power BI | Power BI | PowerBI, Microsoft Power BI, Power-BI-Kenntnisse | NOT Power Query, NOT Business intelligence |
| tableau | Tableau | Tableau | Tableau Desktop, Tableau dashboards | not Power BI |
| financial-planning | Financial planning and analysis | Finanzplanung und -analyse | FP&A, financial planning, financial analysis, Finanzplanung | not Financial modelling, not Budgeting |
| financial-modelling | Financial modelling | Finanzmodellierung | financial modeling, financial models, Finanzmodelle | not Financial planning |
| vitest | Vitest | Vitest |  | NOT Jest |
| jest | Jest | Jest | Jest testing, Jest tests | NOT Vitest |
| accessibility | Accessibility | Barrierefreiheit | a11y, web accessibility, WCAG, digital accessibility |  |

## Must-not-merge pairs (for the 5.2 pass line, fixed before any measure; also tests in 5.1)
Each group must never map onto one another: Java | JavaScript | TypeScript; C | C++ | C#; SQL | NoSQL | MySQL | PostgreSQL | Microsoft SQL Server; Power BI | Power Query | Business intelligence | Looker; Excel | Spreadsheets | Google Sheets | VBA; R | Rust; Git | GitHub; React | Angular | Vue.js; Jest | Vitest; Docker | Kubernetes; Communication | Executive communication | Stakeholder management; Product management | Project management | Growth product management; Salesforce | Pardot; Email marketing | Email outreach; Reporting | Cost reporting | Financial reporting; Scrum | Agile | Kanban; Experimentation | A/B testing; ISO 9001 | ISO 14001 | ISO 45001 | ISO 50001 | ISO 27001; Swift | the word "shift".

## Additions after the first vocab-check (2026-11-16), and the owner's vetoes
`npm run vocab-check` showed 12 key requirements and 13 AI names of ad-01 to ad-08 that the reviewed v0 did not cover. To reach "unmapped 0" on those (the 5.1 check) I added, from those names only: **16 aliases** (analytical-thinking: analytical and quantitative skills, quantitative skills, analytical and data interpretation skills; data-analysis: data interpretation; public-relations: Media and PR; localisation: Localising content and channels; product-led-growth: Product-led growth (PLG); systems-thinking: Systems thinking and prioritization; process-improvement: operational productivity, optimizing operational productivity, Operational productivity and automation; integrated-management-systems: Management system standards (ISO 9001, 14001, 45001, 50001); cross-functional-collaboration: Coordinating cross-functional topics, Working across departments and locations; time-management: manage multiple priorities; stakeholder-management: influence stakeholders), **2 new entries** (`process-automation`, `scripting`) and **4 not-a-skill phrases** (media, technical understanding, adapt to new technology, work independently). Compound names (two skills in one name) map to their first skill in v0.

**Vetoed by the owner (2026-11-16):** the aliases "task management" (not time management) and "partnership development" (business development, not relationship management) were taken out and are now in `LEFT_UNLISTED` (names left unlisted on purpose, with the reason). Left unlisted on purpose so far: account growth, online shop development, task management, partnership development.

Counts now: 209 new entries (batch 1: 71, batch 2: 66, batch 3: 70, plus 2), 54 not-a-skill phrases, 17 existing.
