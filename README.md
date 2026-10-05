# Project A — Money in Motion

Live public-data research pilot. Original v2 institutional green/black design preserved. V9 parsing, evidence ledger, person clustering, watchlist and brief concepts integrated with a deployment-compatible reviewed catalog.

## Production

GitHub: babcofc-oss/Project-A. Vercel: project-a. Production: https://project-a-jet.vercel.app/

Static catalog and immutable primary evidence are versioned in Git; no ephemeral serverless SQLite. Watchlists persist in localStorage for each browser, with visible session-only fallback if storage is unavailable. Advisor briefs export as visible text with a selection control and primary-source links. Pilot feedback persists per browser and exports with source identifiers for review. No cross-device account sync, centralized feedback collection, billing is represented as implemented. Public business contact enrichment is described below.

## Evidence coverage

111 SEC Form 4 filings from seven issuers, filed June–October 2026, independently fetched and parsed. 68 SEC person/issuer identities plus two reviewed business-founder identities; 22 people with S-disposition sale events, seven in the Charleston city-radius territory. Other people are monitoring/classification examples, not fabricated leads. Five reviewed Form 8-K events enrich existing people. Graves and Harralson have sale-plus-executive-transition convergence; board appointments alone earn no bonus. Different disclosure classes from one issuer are not independent publishers. Future and conditional effective dates never establish completed transitions or received cash.

Reporting-person CIK and issuer CIK remain separate. Repeated filings cluster by both identifiers. Distinct transaction rows retain accession + row identifiers. F/A/M are excluded from ordinary sale totals. Rule 10b5-1 detected from the checkbox and footnotes. Source XML fingerprints are retained. Gross reported shares × price is not net worth, net proceeds or available funds.

City radius uses Census 2025 place representative coordinates for the disclosed mailing city. This is approximate, not a residence or professional street-address distance. Unresolved geography is excluded from radius views.

## Development / refresh

Serve this directory with python3 -m http.server 8787. Run python3 -m unittest test_integrity.py test_transitions.py -v and node test_scoring.js. Run PROJECT_A_USER_AGENT="Project A your-real-contact" python3 ingest.py to refresh the reviewed snapshot. Review catalog.json and primary evidence before committing. Run python3 transitions.py --discover to create the 8-K review queue. Discovered filings remain unreleased until named subjects, issuer relationships, fact anchors and SHA-256 fingerprints are reviewed in reviewed-transitions.json. Form 4 refresh reattaches validated reviewed 8-K evidence; changed or missing source evidence fails closed. Discovery refreshes daily; immutable accession XML is cached. Three workers, globally paced at fewer than two requests per second; no uncontrolled retries.

Commit production files to main to trigger the separate GitHub → Vercel project. The connector's write operation returned 403; authenticated GitHub browser uploads succeeded. Do not change The Indicator.

## Original foundations

design-reference.html is the original v2 visual reference with explicitly labeled synthetic demo content. It is never the production homepage. project-a-mvp-v9.zip preserves the engineering baseline intact. Production index.html contains no synthetic prospect fallback.

## Pilot limitations

Data is a reviewed snapshot, not a live stream. Officer roles must be reconfirmed before use. Current advisor relationships, willingness to engage, direct person contact provenance, net proceeds and available funds are UNKNOWN. 22 people have verified sale signals; qualification into high-quality advisor opportunities and recruitment of 3–5 advisor testers remain outstanding.


## Pilot review collection

Generate a prospect brief, rate its usefulness, and export the review text. The Pilot Review Desk accepts exported Project A JSON from other browsers. Imports validate the product/schema, person and filing identifiers, rating, date, score and field limits before changing session state. Duplicate reviews from the same anonymous browser/person keep the latest timestamp; different browser IDs remain separate. Imported names and companies are resolved from the catalog, never treated as verified facts supplied by a tester. Notes render as text. Feedback does not change evidence or scoring.

Reviewers are anonymous browser IDs, not authenticated advisors. No network collection or cross-device sync exists. Reviews and watchlists use browser storage; users must export reviews for backup or transfer. Avoid private client information. A prospect's shareable link opens its public catalog record with all-territory/audit controls so an existing filter cannot hide it. Unknown person IDs show an explicit notice and the default territory.

Run `node test_pilot.js` to check import validation and merge semantics, alongside `node test_scoring.js` and `python3 -m unittest test_integrity test_transitions`.


## Territory expansion

Center state/place controls cover the 2025 Census national places reference (50 states, DC, Puerto Rico). Radius filters recompute city-reference distances from the selected center; selected-state and all-territory modes remain available. Unmatched or ambiguous mailing cities are excluded from radius views, and prospect coverage is explicitly separate from geographic controls. The current catalog remains seven reviewed issuers; selecting an empty market does not discover or fabricate prospects. International and non-place geographies require additional reference/source adapters.

The national reference retains its Census source URL and archive SHA-256. `geo_enrichment.py` uses it for newly ingested professional mailing cities. To expand reviewed issuer coverage, set `PROJECT_A_ISSUERS` to comma-separated SEC CIKs before running the existing ingestion/review/publish workflow. CIK syntax is validated; repeated IDs are deduplicated. No serverless filesystem persistence is introduced.

## Additional trigger coverage

The trigger registry adds business exits, IPO / secondary offerings, ownership changes, Form 144 proposed sales, commercial / investment-property sales, officially named lottery awards, and documented inheritance, alongside stock sales and executive transitions. Each filter, guide entry, selected-opportunity explanation and advisor brief carries a short planning-usefulness explanation and evidence limits. Five new categories currently have zero validated records; available controls do not represent connected feeds.

17 Form 144 notices were fetched from SEC EDGAR and uniquely matched by exact normalized account-subject name plus issuer to existing Form 4 identities. Four notices were held for insufficient identity matches. Filing-agent CIKs are not assumed to be person identifiers. Proposed market values never enter sale totals, recency, intent or convergence bonuses; proposals stay monitoring context until completed-sale evidence exists. Immutable XML and fingerprints accompany accepted records.

`form144.py` runs within ingestion. `reviewed_triggers.py` provides a release gate for additional manually reviewed evidence on existing identities: primary authority, retained fingerprint, fact anchors, named subject, relationship evidence, permitted stage, and source provenance. Lottery identities must be officially named; estate opening alone is rejected; inheritance needs beneficiary evidence and actionable status requires documented distribution. Property signals are limited to reviewed commercial / investment use. New private-owner / beneficiary identity discovery remains a separate adapter task.

Run `node test_triggers.js`, `node test_scoring.js`, `node test_pilot.js`, `node test_territory.js`, and `python3 -m unittest test_integrity test_transitions test_form144`. Scoring v4 retains sale + reviewed executive-transition convergence only; it does not give unsupported convergence bonuses to new categories.

## Mobile terminal layout

At widths up to 850px, a compact Menu opens the original navigation; the KPI strip stays in two columns. Prospects / Signal Feed buttons switch the two radar panels while selection, shared search, watchlist, and filters keep the same state. Territory / signal controls expand on demand; desktop keeps both panels and open filters. Signal selections open the same opportunity intelligence below; Back to prospects restores the prospect panel. Mobile controls remain touch-sized, and form fields use 16px type.

## Reviewed private-business exits

Two named founders are now connected to completed South Carolina acquisitions reported on August 20, 2026: Lee Hickman / Charleston Grounds Management and Ken Robinson / Clear Lakes and Wetland Services. Vesterra’s primary announcement establishes exact founder relationships and reported company completion; Bland’s buyer announcement corroborates the acquisitions. Same transaction, no independent convergence bonus. August 20 is a publication date and completion upper bound; exact closing dates, individual ownership percentages, sale participation, consideration, retained equity, earn-outs and current roles remain UNKNOWN. Neither record contributes to Form 4 gross-sale totals.

`business_exits.py` validates fingerprinted announcements, person/company relationship anchors, completion, publication date and company-market provenance. Private identities use exact reviewed founder + company + primary authority keys; SEC CIKs remain null. No fuzzy cross-company matching. The adapter runs on ingestion refresh, replaces its own records idempotently and holds invalid entries with explicit errors. Its initial geography/source gate supports reviewed South Carolina exits. Additions elsewhere require an explicit reviewed source/geography gate; nationwide territory controls already work.

Company service markets are visibly distinguished from filing mailing cities. City-reference radius may match a company market, never a founder’s address or personal location. Two primary announcements are retained as text to avoid executing archived page scripts. Scoring v5 gives these primary announcements 18/20 evidence points and named company-scoped identities 8/10; no magnitude points for unknown proceeds. Briefs carry business planning themes without claiming SEC evidence for private founders.

Run `python3 -m unittest test_integrity test_transitions test_form144 test_business_exits` and the existing four Node checks before publishing catalog + source ledgers + code together.

## Professional contact intelligence

18 distinct published business routes from nine retained official pages are bound to the 70 reviewed person/company identities. These are company or acquirer routes, never represented as direct person contacts. Published corporate/main phone numbers, purpose-limited customer service channels, official contact pages, and 3D Systems investor-relations email retain review date, SHA-256, source URL, organization, scope and purpose. Direct person email/phone, current affiliation, deliverability and consent remain UNKNOWN. No guesses, private contact data or outreach automation. Contact availability does not change financial opportunity scores.

`contacts.py` validates authority, exact company/issuer or reviewed private-entity identity, source fingerprints and published value anchors. It clears stale routes on refresh and rejects evidence older than 90 days or future dated. The UI and brief also withhold expired contact evidence. Contact data and retained sources are versioned in Git; ingestion and private-business refresh reattach validated routes. Update reviewed source and manifest together after re-review.

Run `python3 -m unittest test_contacts test_integrity test_transitions test_form144 test_business_exits` and `node test_contact_briefs.js` plus the existing Node checks. Contact tests cover stale data, tampering, wrong authorities, unsupported direct-contact claims, exact entity binding and idempotent refresh.

## Named professional contacts and availability

The v2 contact adapter adds one official named business contact: R. Arthur (Art) Seaver Jr.’s Southern First profile publishes his business phone and email. Two additional official biographies identify Kevin Gregoire / Blackbaud and Ryan Fisher / Ingevity. Biographies are identity research, not contact routes. There are now 23 distinct published entries: the existing 18 company/acquirer routes, three named profile pages, and Seaver’s two named business channels. These do not create prospects or financial-score bonuses. All private phone/email, deliverability and consent remain unasserted.

Named profile bindings require an approved exact primary URL, exact catalog person ID/name/company/issuer, and retained name/role/company anchors. Named phone and email must appear beside the person-specific published labels; general company/footer contacts cannot be relabeled as named. The published email link is decoded from the official page’s public email-protection link, never guessed or probed.

`contacts.js` centralizes freshness, safe links, exact person binding, category filters and brief generation. Contact availability filters distinguish published named business email/phone, named profile + company routes, company channels only, and missing/expired evidence. View Contact Routes jumps directly from the selected opportunity. Source entries sharing provenance are grouped for readability on iPhone. Tests: `node test_contacts.js`, `node test_contact_briefs.js`, existing Node checks, and `python3 -m unittest test_contacts test_integrity test_transitions test_form144 test_business_exits`.
