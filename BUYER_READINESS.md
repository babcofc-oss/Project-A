# Project A: buyer-value operating plan

Updated October 8, 2026. Objective: build a repeatably valuable prospect-research capability that a fintech, broker-dealer or bank could embed, partner with, or acquire. No buyer interest, valuation or acquisition probability is established.

## Positioning
Evidence-backed planning-event intelligence: who changed, what changed, why it may matter now, what primary evidence establishes, and what remains unknown. A qualified client, available assets or unmet need is never inferred from gross sale value or a job title.

## What should become difficult to replace
Public SEC filings are accessible to others. Differentiation must come from reliable person/issuer matching, reviewed event histories, amendment handling, timely useful combinations, advisor-rated usefulness, repeat delivery, and integration into an existing workflow. Reviewed interpretations and evaluation history should improve quality without silently turning opinion into fact.

## Ordered value gates
| Priority | Build or prove | Evidence required |
| --- | --- | --- |
| 1 | Fresh, reliable research in a narrow useful market | Covered issuers and feeds explicit; failures surfaced; sample identity/event audit; no hidden stale hot labels |
| 2 | Advisor value | 3–5 actual advisors evaluate at least five dossiers; identify useful themes and repeated objections; anonymous IDs and QA excluded from verified-tester claims |
| 3 | Repeat value and payment | Useful updates create return use; actual paid pilot, repeat purchase/renewal and delivery costs recorded |
| 4 | Embed in existing tools | Versioned JSON contract and CSV first; native CRM/API only after a customer requests a specific destination and authenticates it |
| 5 | Defensible operation | Data-source usage terms and code ownership documented; source review, correction and removal processes; central authenticated review history, access controls and audit trails |
| 6 | Enterprise pilot | One firm validates review/supervision needs, data freshness and integration; measured productivity and commercial terms before scaling |

## Current implemented versus unproved
Implemented: primary evidence retention/fingerprints, exact SEC person/issuer identity, bounded same-person rules, configured-issuer monitored refresh, manual-review labels, source-linked briefs/AI packets, nationwide U.S. ZIP reference search, portable watchlists, purpose-labeled feedback, self-reported demand metrics, and generic CSV/JSON research handoff.
Unproved or unconnected: broad nationwide prospect coverage, native CRM sync, authenticated user accounts, central outcome collection, production live LLM service, verified advisor testers, paying customers, revenue/retention and buyer interest. Several trigger categories have no connected discovery feed.

## Integration contract v1
JSON schema: project-a-research-handoff, schema_version 1. Stable person_id is the idempotency key; person and issuer CIKs remain separate. File timestamp, catalog/scoring versions and evaluated feed freshness accompany all records. source_events preserve event IDs, filing accessions, dates, facts, source URLs and retained SHA-256. research_priority is explicitly inference; matched gross value is not cash available. Private-client information and reviewer notes are excluded. Consumers must map CSV fields, deduplicate by person_id, retain source provenance, honor UNKNOWN and avoid automated solicitation or wealth inference. No vendor-specific import or API has been tested.

## Relevant industry evidence, not prospective-buyer claims
- Broadridge announced its AdvisorTarget acquisition May 30, 2024: https://www.broadridge.com/press-release/2024/advisortarget-is-now-a-part-of-broadridge . Adjacent advisor-targeting data, not the same end-client product.
- FactSet announced its TIFIN.AI partnership and strategic investment June 29, 2026: https://investor.factset.com/news-releases/news-release-details/factset-expands-wealth-management-workflow-ai-capabilities . Highlights embedded workflows, secure operation and auditable AI.

Next execution: expand fresh primary-source coverage in one promising market, qualify dossiers and get real advisor feedback. Do not inflate counts, pad categories or substitute more dashboard features for demonstrated usefulness.
