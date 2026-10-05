# Project A — Money in Motion

Live public-data research pilot. Original v2 institutional green/black design preserved. V9 parsing, evidence ledger, person clustering, watchlist and brief concepts integrated with a deployment-compatible reviewed catalog.

## Production

GitHub: babcofc-oss/Project-A. Vercel: project-a. Production: https://project-a-jet.vercel.app/

Static catalog and immutable primary evidence are versioned in Git; no ephemeral serverless SQLite. Watchlists persist in localStorage for each browser, with visible session-only fallback if storage is unavailable. Advisor briefs export as visible text with a selection control and primary-source links. Pilot feedback persists per browser and exports with source identifiers for review. No cross-device account sync, centralized feedback collection, billing or contact enrichment is represented as implemented.

## Evidence coverage

111 SEC Form 4 filings from seven issuers, filed June–October 2026, independently fetched and parsed. 68 person/issuer identities; 22 people with S-disposition sale events, seven in the Charleston city-radius territory. Other people are monitoring/classification examples, not fabricated leads. Five reviewed Form 8-K events enrich existing people. Graves and Harralson have sale-plus-executive-transition convergence; board appointments alone earn no bonus. Different disclosure classes from one issuer are not independent publishers. Future and conditional effective dates never establish completed transitions or received cash.

Reporting-person CIK and issuer CIK remain separate. Repeated filings cluster by both identifiers. Distinct transaction rows retain accession + row identifiers. F/A/M are excluded from ordinary sale totals. Rule 10b5-1 detected from the checkbox and footnotes. Source XML fingerprints are retained. Gross reported shares × price is not net worth, net proceeds or available funds.

City radius uses Census 2025 place representative coordinates for the disclosed mailing city. This is approximate, not a residence or professional street-address distance. Unresolved geography is excluded from radius views.

## Development / refresh

Serve this directory with python3 -m http.server 8787. Run python3 -m unittest test_integrity.py test_transitions.py -v and node test_scoring.js. Run PROJECT_A_USER_AGENT="Project A your-real-contact" python3 ingest.py to refresh the reviewed snapshot. Review catalog.json and primary evidence before committing. Run python3 transitions.py --discover to create the 8-K review queue. Discovered filings remain unreleased until named subjects, issuer relationships, fact anchors and SHA-256 fingerprints are reviewed in reviewed-transitions.json. Form 4 refresh reattaches validated reviewed 8-K evidence; changed or missing source evidence fails closed. Discovery refreshes daily; immutable accession XML is cached. Three workers, globally paced at fewer than two requests per second; no uncontrolled retries.

Commit production files to main to trigger the separate GitHub → Vercel project. The connector's write operation returned 403; authenticated GitHub browser uploads succeeded. Do not change The Indicator.

## Original foundations

design-reference.html is the original v2 visual reference with explicitly labeled synthetic demo content. It is never the production homepage. project-a-mvp-v9.zip preserves the engineering baseline intact. Production index.html contains no synthetic prospect fallback.

## Pilot limitations

Data is a reviewed snapshot, not a live stream. Officer roles must be reconfirmed before use. Current advisor relationships, willingness to engage, contact provenance, net proceeds and available funds are UNKNOWN. 22 people have verified sale signals; qualification into high-quality advisor opportunities and recruitment of 3–5 advisor testers remain outstanding.
