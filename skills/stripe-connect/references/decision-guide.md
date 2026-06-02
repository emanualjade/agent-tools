# Stripe Connect Decision Guide

Last verified against Stripe docs: 2026-05-29. Pin `Stripe-Version: 2026-05-27.dahlia` for the stable Accounts v2 surface unless a preview-only feature requires `.preview`.

Use this when the user is still choosing an architecture, explaining Connect to stakeholders, or asking "which Stripe Connect setup should I use?"

## Contents

- [Start with the product questions](#start-with-the-product-questions)
- [Accounts v2 mental model](#accounts-v2-mental-model)
- [Charge-type choice](#charge-type-choice)
- [Liability and fees](#liability-and-fees)
- [Onboarding choice](#onboarding-choice)
- [Country and currency](#country-and-currency)
- [Platform fees](#platform-fees)
- [Common recommendations](#common-recommendations)

## Start with the product questions

Ask these before writing code:

1. Who does the customer believe they are buying from: the platform or the seller/provider?
2. Does one payment go to one recipient, multiple recipients, or a recipient chosen later?
3. Who should be merchant/settlement merchant for statement descriptors, settlement currency, and tax/regulatory reasons?
4. Who should pay Stripe fees and absorb negative balances?
5. Which countries and currencies are involved: platform country, connected-account country, customer currency, settlement currency, payout currency?
6. Does the connected account need a Stripe-hosted Dashboard, Express Dashboard, or no Dashboard?
7. Should onboarding be Stripe-hosted, embedded in the product, or fully API/custom?
8. Is this a one-time payment flow, subscription flow, or both?

Do not blindly copy Stripe generated quickstart prompts. They are useful implementation scaffolds, but they often bake in charge type, Dashboard access, liability, and `on_behalf_of` choices. Make the money-flow decision first, then adapt the scaffold.

## Accounts v2 mental model

For new builds, prefer Accounts v2. Think "one account, roles switched on":

| Configuration | Plain meaning | Use when |
|---|---|---|
| `merchant` | Account can collect payments from customers | Direct charges, or destination/separate flows where `on_behalf_of` makes the connected account settlement merchant |
| `recipient` | Account can receive transfers/payouts from platform flows | Destination charges and separate charges/transfers where the platform collects then sends funds |
| `customer` | Account can be charged by the platform | Billing a connected business, subscriptions, account-as-customer flows |

Core rule: configure/onboard accounts with v2 (`/v2/core/accounts`, `/v2/core/account_links`), but move money with v1 APIs (`PaymentIntents`, `Transfers`, `Payouts`).

## Charge-type choice

| Flow | Charge created on | Good fit | Usually liable / pays fees | Core fields |
|---|---|---|---|---|
| Direct charge | Connected account | Seller/provider is the obvious merchant; customer buys from seller | Connected account by default, but v2 `defaults.responsibilities` can change fee/loss handling | SDK request option `{ stripeAccount: acct }`, optional `application_fee_amount` |
| Destination charge | Platform | Customer buys from platform, one connected account receives most/all funds | Platform for destination/separate charge platform-level refunds, disputes, fees | `transfer_data[destination]`, optional `application_fee_amount`, optional `on_behalf_of` |
| Separate charges & transfers | Platform | One charge split across multiple accounts, delayed routing, complex fulfillment | Platform | PaymentIntent on platform, then `/v1/transfers` with `destination`, `transfer_group`, often `source_transaction` |

Plain-English explanation:
- Direct charge: "The seller takes the payment; your platform can take a fee."
- Destination charge: "The platform takes the payment and automatically sends money to one provider."
- Separate charges/transfers: "The platform takes the payment now and moves funds later or to multiple recipients."

## Liability and fees

For Accounts v2, do not answer direct-charge fee/loss questions from memory. Check:

- `defaults.responsibilities.fees_collector`: who Stripe collects direct-charge payment fees from (`application` or `stripe`).
- `defaults.responsibilities.losses_collector`: who is responsible for negative balances incurred by the connected account (`application` or `stripe`).
- `defaults.responsibilities.requirements_collector`: read-only, auto-calculated from losses collector and Dashboard access.

Important restrictions:
- If `losses_collector` is `application`, `fees_collector` must also be `application`.
- If `dashboard` is `express`, both losses and fees collector must be `application`.
- If `dashboard` is `full`, both losses and fees collector must be `stripe`.
- For destination charges, Stripe collects fees from the platform.

`on_behalf_of` changes settlement merchant/presentation, not destination/separate charge platform liability. If `on_behalf_of` makes the connected account the settlement merchant, the account generally needs `merchant`/`card_payments`, not only `recipient`/`stripe_transfers`.

## Onboarding choice

| Onboarding style | Use when | API |
|---|---|---|
| Hosted Account Links | Fastest safe default; Stripe-hosted flow is acceptable | `POST /v2/core/account_links` for Accounts v2 |
| Embedded components | User should stay inside your product; you want Stripe-built UI | `POST /v1/account_sessions`, even for v2 accounts |
| API/custom onboarding | You are ready to collect/maintain requirements yourself | Accounts v2 create/update plus requirements handling |

Hosted Account Links are single-use and short-lived. Always generate a fresh link on demand. `return_url` means the user returned, not that onboarding is complete; check requirements or webhooks.

## Country and currency

Treat country/currency as product architecture:

- Platform country and connected-account country affect capabilities, service agreements, cross-border transfers, and `on_behalf_of` requirements.
- Settlement and payout currencies can change fees and whether currency conversion occurs.
- Unsupported payout corridors can force a different product approach or require Global Payouts / sales-assisted options.

For a Canada/CAD MVP, verify Canada platform support, connected-account countries, CAD settlement, and whether cross-border payout corridors are needed before choosing a charge flow.

## Platform fees

- One-time payments: `application_fee_amount` on PaymentIntents/Checkout payment flows.
- Subscriptions: `application_fee_percent` on Subscriptions or `subscription_data[application_fee_percent]` in Checkout.
- Destination charges: `application_fee_amount` gives cleaner platform-fee reporting than manually setting only `transfer_data[amount]`.

## Common recommendations

- One seller/provider per order, customer buys from platform: destination charge with recipient account.
- Multi-party split or delayed fulfillment: separate charges & transfers.
- Seller needs to be the obvious merchant and own the charge: direct charge with merchant account.
- Connected account only receives funds and platform stays merchant: recipient only may be enough.
- Connected account appears as settlement merchant via `on_behalf_of`: add merchant/card payments capability too.

## Sources

- https://docs.stripe.com/connect/charges
- https://docs.stripe.com/connect/direct-charges
- https://docs.stripe.com/connect/destination-charges
- https://docs.stripe.com/connect/separate-charges-and-transfers
- https://docs.stripe.com/connect/accounts-v2
- https://docs.stripe.com/connect/accounts-v2/connected-account-configuration
- https://docs.stripe.com/connect/cross-border-payouts
- https://docs.stripe.com/connect/subscriptions
- https://docs.stripe.com/api/checkout/sessions/create
- https://docs.stripe.com/api/subscriptions/create
