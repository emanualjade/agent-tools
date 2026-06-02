# Doc Map and Verification

Last verified: 2026-05-29.

Use this when the agent needs the current Stripe source of truth, has to verify a date-sensitive claim, or is unsure which Stripe doc page owns a topic.

The links are not the point. Use them to verify a specific fact, resolve a version-sensitive uncertainty, or inspect the current API shape; then synthesize the answer in the user's context.

## Contents

- [Verification rules](#verification-rules)
- [Essential docs for online research](#essential-docs-for-online-research)
- [Core docs](#core-docs)
- [Onboarding docs](#onboarding-docs)
- [Money movement docs](#money-movement-docs)
- [Webhooks and events docs](#webhooks-and-events-docs)
- [Testing and CLI docs](#testing-and-cli-docs)
- [Country, currency, pricing](#country-currency-pricing)
- [Settled points from 2026-05-29 review](#settled-points-from-2026-05-29-review)
- [Still verify before asserting](#still-verify-before-asserting)

## Verification rules

- Stripe docs are the source of truth. Re-check docs for anything versioned, preview, pricing, CLI behavior, capabilities, country/currency support, or legal/compliance related.
- Pin `Stripe-Version: 2026-05-27.dahlia` for stable Accounts v2 unless using a preview-only feature.
- Prefer official docs and API references over blog posts, memory, generated quickstarts, or old examples.
- If a field-observed behavior is not publicly documented, label it as field-observed instead of deleting it.
- Do not confuse Accounts v1 controller/type docs with Accounts v2 configuration/responsibilities docs.

## Essential docs for online research

When researching online, start with the smallest set of docs that can answer the question. Open more only when the first source points there or the user's flow genuinely crosses that boundary.

| If the question is about... | Start here | What to verify |
|---|---|---|
| Overall Connect model | https://docs.stripe.com/connect | Current framing and links to the active Connect guides |
| Creating/configuring accounts | https://docs.stripe.com/api/v2/core/accounts | Current Accounts v2 object, endpoints, version notes |
| Responsibilities, Dashboard, capabilities | https://docs.stripe.com/connect/accounts-v2/connected-account-configuration | `fees_collector`, `losses_collector`, Dashboard restrictions, KYC collector |
| Hosted onboarding | https://docs.stripe.com/api/v2/core/account-links/create | v2 Account Link params, `configurations`, `refresh_url`, expiry |
| Embedded onboarding/components | https://docs.stripe.com/connect/get-started-connect-embedded-components | v1 Account Session handoff and Connect.js flow |
| Charge type / money flow | https://docs.stripe.com/connect/charges | Direct vs destination vs separate charges/transfers trade-offs |
| Transfers after platform charge | https://docs.stripe.com/connect/separate-charges-and-transfers | `source_transaction`, transfer timing, split rules |
| Webhooks and Connect event scope | https://docs.stripe.com/connect/webhooks | `event.account`, v1/v2 scope differences, connected-account endpoints |
| v2 thin events | https://docs.stripe.com/event-destinations | Thin vs snapshot payloads, event destinations, parser pattern |
| Local CLI testing | https://docs.stripe.com/cli/listen | Forwarding flags for snapshot/thin and platform/connected scopes |
| Sandboxes | https://docs.stripe.com/sandboxes/dashboard/sandbox-settings | What copies, what never copies, and no-sync behavior |
| Country, currency, pricing | https://docs.stripe.com/connect/currencies | Supported corridors/currencies; follow through to pricing when needed |

Use this section as a research runway, not as a citation dump. The useful output is the conclusion: what the docs imply for this user's architecture, code, setup order, or test plan.

## Core docs

| Topic | URL | Key fact |
|---|---|---|
| Connect overview | https://docs.stripe.com/connect | Top-level Connect hub |
| Accounts v2 API | https://docs.stripe.com/api/v2/core/accounts | Source for v2 account object/endpoints |
| Accounts v2 create | https://docs.stripe.com/api/v2/core/accounts/create | Source for exact create params, capability paths, errors |
| Accounts v2 configuration | https://docs.stripe.com/connect/accounts-v2/connected-account-configuration | Responsibilities, Dashboard, KYC collector, v1 controller map |
| Legacy accounts/controller | https://docs.stripe.com/connect/accounts | Useful for existing v1 integrations |
| Controller migration | https://docs.stripe.com/connect/migrate-to-controller-properties | v1 controller properties replacing account types |

## Onboarding docs

| Topic | URL | Key fact |
|---|---|---|
| v2 Account Links | https://docs.stripe.com/api/v2/core/account-links/create | Recommended hosted onboarding link for Accounts v2 |
| Legacy hosted onboarding | https://docs.stripe.com/connect/custom/hosted-onboarding | Still useful for v1 concepts and hosted flow behavior |
| Embedded components | https://docs.stripe.com/connect/get-started-connect-embedded-components | Server creates Account Session; client mounts Connect.js |
| Account onboarding component | https://docs.stripe.com/connect/supported-embedded-components/account-onboarding | Requirements collection UI |

## Money movement docs

| Topic | URL | Key fact |
|---|---|---|
| Charge types | https://docs.stripe.com/connect/charges | Compare direct, destination, separate charges/transfers |
| Direct charges | https://docs.stripe.com/connect/direct-charges | Charge is on connected account; use `Stripe-Account` |
| Direct-charge fee behavior | https://docs.stripe.com/connect/direct-charges-fee-payer-behavior | v2 `fees_collector` controls direct-charge fee collection |
| Destination charges | https://docs.stripe.com/connect/destination-charges | Platform charge with `transfer_data[destination]` |
| Separate charges/transfers | https://docs.stripe.com/connect/separate-charges-and-transfers | Platform charge then `/v1/transfers` |
| Transfers API | https://docs.stripe.com/api/transfers/create | Create transfer to `acct_...` destination |
| Payouts API | https://docs.stripe.com/api/payouts/create | Create payouts; act as connected account when needed |
| Application fees | https://docs.stripe.com/api/application_fees | Application Fee object and refunds |
| Connect subscriptions | https://docs.stripe.com/connect/subscriptions | Platform fees for recurring flows |

## Webhooks and events docs

| Topic | URL | Key fact |
|---|---|---|
| Webhooks Node | https://docs.stripe.com/webhooks?lang=node | Raw body and signature verification |
| Connect webhooks | https://docs.stripe.com/connect/webhooks | Connected-account events and scope behavior |
| Event destinations | https://docs.stripe.com/event-destinations | v2 destinations and thin/snapshot payloads |
| v2 event destinations API | https://docs.stripe.com/api/v2/core/event-destinations/create | Programmatic event destination creation |
| v2 events API | https://docs.stripe.com/api/v2/core/events | Retrieve/list v2 events |
| v2 event types | https://docs.stripe.com/api/v2/core/events/event-types | `v2.core.account.*` event names |

## Testing and CLI docs

| Topic | URL | Key fact |
|---|---|---|
| Sandboxes overview | https://docs.stripe.com/sandboxes | Test-mode sandbox plus created sandboxes |
| Sandbox management | https://docs.stripe.com/sandboxes/dashboard/manage | Create/delete/manage sandboxes |
| Sandbox settings copy | https://docs.stripe.com/sandboxes/dashboard/sandbox-settings | What copies, what never copies, no sync after creation |
| Connect testing | https://docs.stripe.com/connect/testing | Test data for onboarding, capabilities, payouts |
| CLI listen | https://docs.stripe.com/cli/listen | `--forward-to`, `--forward-connect-to`, `--forward-thin-to`, `--forward-thin-connect-to` |
| CLI trigger | https://docs.stripe.com/cli/trigger | Supported synthetic fixtures and `--stripe-account` |
| CLI keys | https://docs.stripe.com/stripe-cli/keys | CLI restricted keys and expiry |
| API keys | https://docs.stripe.com/keys | Restricted API keys and key handling |

## Country, currency, pricing

| Topic | URL | Key fact |
|---|---|---|
| Currencies | https://docs.stripe.com/currencies | Supported presentment/settlement currencies |
| Connect currencies | https://docs.stripe.com/connect/currencies | Connect-specific currency behavior |
| Cross-border payouts | https://docs.stripe.com/connect/cross-border-payouts | Supported corridors and fees |
| Multi-currency settlement | https://docs.stripe.com/connect/multicurrency-settlement | Settlement currency behavior |
| Connect pricing | https://stripe.com/connect/pricing | Pricing lives on stripe.com marketing domain; verify region/account-specific figures live |

## Settled points from 2026-05-29 review

- Accounts v2 is broadly available to Connect platforms; other account use cases may be preview-gated.
- Stable API version: `2026-05-27.dahlia`. Latest preview observed: `2026-05-27.preview`.
- v2 accounts use `acct_...` IDs and interoperate with v1 money movement.
- Hosted onboarding for Accounts v2 should use `POST /v2/core/account_links`.
- Embedded components still use v1 `POST /v1/account_sessions`.
- `requirements_collector` maps to `defaults.responsibilities.requirements_collector` and is auto-calculated.
- `contact_email` is optional in direct create reference; keep it in examples but do not call it universally required.
- CLI has four relevant forwarding flags: `--forward-to`, `--forward-connect-to`, `--forward-thin-to`, `--forward-thin-connect-to`.
- `stripe trigger --stripe-account` exists, but current documented fixtures do not include `v2.core.account.*` thin events.

## Still verify before asserting

- Exact preview feature pins and account eligibility.
- Whether `stripe_balance.payouts` can be explicitly requested for the target account/version or is derived through onboarding.
- Whether the CLI prints separate signing secrets for multiple simultaneous forwarding URLs.
- Exact JS thin-event helper names for the installed `stripe` package.
- Exact pricing for the user's country/account/contract.
- Whether connected-account test clocks work for the user's intended flow.
- Any field-observed sandbox repair behavior beyond the docs-supported no-sync explanation and field-proven recreate workaround.
