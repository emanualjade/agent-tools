# Accounts and Onboarding

Last verified against Stripe docs: 2026-05-29. Use `Stripe-Version: 2026-05-27.dahlia` for the stable Accounts v2 surface unless a preview-only feature requires `.preview`.

Use this when creating connected accounts, requesting capabilities, choosing Dashboard access, or sending users through onboarding.

## Contents

- [Accounts v2 stance](#accounts-v2-stance)
- [Configurations](#configurations)
- [Conditional create rules](#conditional-create-rules)
- [Minimal merchant account](#minimal-merchant-account)
- [Minimal recipient account](#minimal-recipient-account)
- [Hosted onboarding with Account Links](#hosted-onboarding-with-account-links)
- [Embedded onboarding/components](#embedded-onboardingcomponents)
- [Requirements and capability state](#requirements-and-capability-state)
- [Platform prerequisite](#platform-prerequisite)

## Accounts v2 stance

For new Connect builds:

- Create/configure connected accounts with `POST /v2/core/accounts`.
- Use configurations: `merchant`, `recipient`, `customer`.
- Use the same `acct_...` ID with v1 money-movement APIs.
- Use v2 Account Links for hosted onboarding.
- Use v1 Account Sessions for embedded components.

Node SDK setup:

```js
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-05-27.dahlia',
});
```

## Configurations

| Configuration | Key capability path | Meaning |
|---|---|---|
| `merchant` | `configuration.merchant.capabilities.card_payments.requested` | Account can collect card payments as merchant |
| `recipient` | `configuration.recipient.capabilities.stripe_balance.stripe_transfers.requested` | Account can receive `/v1/transfers` into its Stripe balance |
| `customer` | `configuration.customer.capabilities.automatic_indirect_tax.requested` | Account can act like a billable customer |

The `merchant` configuration also exposes `stripe_balance.payouts` in returned account data/requirements. Money movement and payout settings still use v1 APIs.

## Conditional create rules

The v2 create schema is mostly optional, but Connect business rules make some fields conditionally required:

- If adding `merchant`, define `defaults.responsibilities`; those responsibility values cannot be updated later.
- If adding `merchant`, set `dashboard` if it is currently `null`.
- If requesting recipient `stripe_balance.stripe_transfers`, set `dashboard` if it is currently `null`.
- If naming a capability object, its `.requested` child is required.
- `identity.country` is schema-optional, but account activation/capability validation often needs it. Treat country as an early product decision.
- `contact_email` is optional in the direct create reference, but some account-token/preview flows have required it for merchant/recipient. Keep it in examples; do not assert universal direct-create requiredness without checking live docs.

Responsibilities:

```text
defaults.responsibilities.fees_collector
defaults.responsibilities.losses_collector
defaults.responsibilities.requirements_collector  // read-only, auto-calculated
```

Dashboard values:

```text
full      // full Stripe Dashboard
express   // Express Dashboard
none      // platform must provide operational UI
```

Dashboard restrictions:

- If `dashboard` is `express`, `fees_collector` and `losses_collector` must both be `application`.
- If `dashboard` is `full`, `fees_collector` and `losses_collector` must both be `stripe`.

## Minimal merchant account

Use when the connected account needs to collect payments directly or be settlement merchant via `on_behalf_of`.

```js
const account = await stripe.v2.core.accounts.create({
  contact_email: 'merchant@example.com',
  identity: { country: 'US' },
  dashboard: 'none',
  configuration: {
    merchant: {
      capabilities: {
        card_payments: { requested: true },
      },
    },
  },
  defaults: {
    responsibilities: {
      fees_collector: 'application',
      losses_collector: 'application',
    },
  },
  include: ['configuration.merchant', 'identity', 'defaults', 'requirements'],
});
```

## Minimal recipient account

Use when the platform collects money and sends funds to the connected account.

```js
const account = await stripe.v2.core.accounts.create({
  contact_email: 'recipient@example.com',
  identity: { country: 'US' },
  dashboard: 'none',
  configuration: {
    recipient: {
      capabilities: {
        stripe_balance: {
          stripe_transfers: { requested: true },
        },
      },
    },
  },
  defaults: {
    responsibilities: {
      fees_collector: 'application',
      losses_collector: 'application',
    },
  },
  include: ['configuration.recipient', 'identity', 'defaults', 'requirements'],
});
```

Stripe recommends `application` / `application` when using destination charges with an account. If using destination/separate charges with `on_behalf_of`, recipient alone may not be enough. Add `merchant`/`card_payments` when the connected account is settlement merchant.

## Hosted onboarding with Account Links

For Accounts v2, use `POST /v2/core/account_links` and `stripe.v2.core.accountLinks.create`.

```js
const accountLink = await stripe.v2.core.accountLinks.create({
  account: account.id,
  use_case: {
    type: 'account_onboarding',
    account_onboarding: {
      configurations: ['recipient'],
      refresh_url: `${origin}/stripe/reauth?account=${account.id}`,
      return_url: `${origin}/stripe/return?account=${account.id}`,
    },
  },
});

return Response.redirect(accountLink.url);
```

Rules:

- Account Links are temporary, single-use URLs.
- Generate them on demand; do not store/reuse them.
- Pass the configuration(s) you actually intend to onboard, for example `recipient`, `merchant`, or both. Mismatches can fail with `configs_must_match_to_use_account_links`.
- `refresh_url` should create a new link with the same parameters, but authenticate the signed-in platform user before minting/redirecting to a replacement link. Do not trust only an `account` query param if the URL leaks.
- `return_url` does not prove onboarding is complete. Check requirements or wait for webhooks.
- v1 `/v1/account_links` can accept a v2 `acct_...` ID as fallback, but v2 Account Links are the recommended path for v2 accounts.

## Embedded onboarding/components

Embedded components still use v1 Account Sessions, even for v2 account IDs:

```js
const accountSession = await stripe.accountSessions.create({
  account: account.id,
  components: {
    account_onboarding: { enabled: true },
    account_management: { enabled: true },
    notification_banner: { enabled: true },
  },
});

return Response.json({ client_secret: accountSession.client_secret });
```

Client-side:

```js
import { loadConnectAndInitialize } from '@stripe/connect-js';

const stripeConnectInstance = loadConnectAndInitialize({
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  fetchClientSecret: async () => {
    const res = await fetch('/api/stripe/account-session', { method: 'POST' });
    const data = await res.json();
    return data.client_secret;
  },
});

const onboarding = stripeConnectInstance.create('account-onboarding');
container.appendChild(onboarding);
```

## Requirements and capability state

Use `include` to retrieve what the agent needs:

```js
const account = await stripe.v2.core.accounts.retrieve(accountId, {
  include: [
    'configuration.merchant',
    'configuration.recipient',
    'identity',
    'defaults',
    'requirements',
    'future_requirements',
  ],
});
```

Capability status values include `active`, `pending`, `restricted`, and `unsupported`. Sandboxes can fail to enforce some capabilities, so always inspect statuses and restricted states before going live.

## Platform prerequisite

Connected-account creation can fail because the platform profile/questionnaire is incomplete. Check Dashboard -> Settings -> Connect -> Platform profile before debugging code.

For additional sandboxes, configure Connect on the source platform first, then create the sandbox using "Copy your account." Created sandboxes are a one-time copy and do not sync later.

## Sources

- https://docs.stripe.com/api/v2/core/accounts
- https://docs.stripe.com/api/v2/core/accounts/create
- https://docs.stripe.com/connect/accounts-v2
- https://docs.stripe.com/connect/accounts-v2/connected-account-configuration
- https://docs.stripe.com/api/v2/core/account-links/create
- https://docs.stripe.com/connect/supported-embedded-components/account-onboarding
- https://docs.stripe.com/connect/get-started-connect-embedded-components
- https://docs.stripe.com/connect/account-balances
