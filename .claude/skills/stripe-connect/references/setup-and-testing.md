# Setup and Testing

Last verified against Stripe docs and local Stripe CLI help: 2026-05-29.

Use this when setting up sandboxes, local webhooks, Stripe CLI forwarding, restricted keys, or a proof loop for a Connect integration.

## Contents

- [Sandbox setup order](#sandbox-setup-order)
- [Test mode vs created sandboxes](#test-mode-vs-created-sandboxes)
- [Stripe CLI login and keys](#stripe-cli-login-and-keys)
- [Local webhook forwarding](#local-webhook-forwarding)
- [`stripe trigger`](#stripe-trigger)
- [Proof ladder](#proof-ladder)
- [Common local gotchas](#common-local-gotchas)
- [Useful test data](#useful-test-data)
- [Test clocks](#test-clocks)

## Sandbox setup order

The safe order:

1. Complete the platform's Connect profile/questionnaire first.
2. Configure platform capabilities, payout settings, and Connect branding.
3. Create additional sandboxes with "Copy your account."
4. Re-add settings Stripe does not copy: OAuth redirect URIs, email domains, webhook endpoints, and relevant domains/settings.
5. Re-auth the Stripe CLI and use that sandbox's API keys/webhook secrets.

Why this matters: created sandboxes are a one-time copy, not a sync. Stripe docs say settings and capabilities can diverge from live settings. If the sandbox existed before Connect was enabled on the source account, it can miss platform capabilities while still looking complete in the UI.

Field-observed gotcha: an isolated sandbox can show a complete setup checklist while connected-account creation still fails with platform/registration style errors. Public docs list errors like `connect_profile_not_submitted`, `platform_registration_required`, and `account_create_activation_required`; `platform_account_required` was field-observed, not found in the public error table. The docs support the no-sync explanation; the field-proven workaround is to recreate the sandbox after Connect is enabled, or use the built-in test-mode sandbox carefully.

## Test mode vs created sandboxes

- Every Stripe account has a built-in test-mode sandbox. It shares some settings with live mode and cannot be deleted.
- You can create additional isolated sandboxes.
- Additional sandboxes are isolated and do not sync after creation.
- Sandboxes may not enforce every capability the way live mode does. Do not treat sandbox success as proof of live readiness.

## Stripe CLI login and keys

```bash
stripe login
```

The CLI creates restricted API keys for sandbox and live mode, valid for 90 days. Re-run login when they expire.

For production automation, prefer restricted API keys (RAKs) with the narrowest required permissions, including Connect connected-account access where needed. Avoid giving tools/deploy previews a full secret key unless they truly need it.

## Local webhook forwarding

Snapshot events:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Connected-account snapshot events to a separate route:

```bash
stripe listen \
  --forward-to localhost:3000/api/webhooks/stripe \
  --forward-connect-to localhost:3000/api/webhooks/connect
```

If `--forward-connect-to` is omitted, Connect snapshot events use the same URL as normal snapshot events. Use `--forward-connect-to` when your Connect handler is split.

Thin events:

```bash
stripe listen \
  --thin-events "*" \
  --forward-thin-to localhost:3000/api/webhooks/v2
```

Thin Connect events to a separate route, for thin events emitted in Connected accounts scope:

```bash
stripe listen \
  --thin-events "*" \
  --forward-thin-to localhost:3000/api/webhooks/v2 \
  --forward-thin-connect-to localhost:3000/api/webhooks/v2-connect
```

Flag meanings:

- `--forward-to`: snapshot event URL.
- `--forward-connect-to`: connected-account snapshot event URL; defaults to normal snapshot URL.
- `--thin-events`: selects which thin events to listen for; default none.
- `--forward-thin-to`: thin event URL.
- `--forward-thin-connect-to`: thin Connect event URL for Connected accounts scope; defaults to normal thin URL.

For Accounts v2 account changes about your platform's connected accounts, Stripe documents the v2 `v2.core.account.*` events as **Your account** scope, so test those with `--forward-thin-to`. The paired v1 snapshot event uses **Connected accounts** scope and arrives through `--forward-connect-to`.

Read the literal signing secret(s) printed by the CLI and wire each endpoint to its matching secret. Docs confirm the CLI signing secret is stable across restarts, but do not clearly show whether multiple forward URLs print separate secrets in every case.

## `stripe trigger`

Useful:

```bash
stripe trigger account.updated
stripe trigger account.application.deauthorized
stripe trigger payout.created
stripe trigger payout.updated
stripe trigger account.updated --stripe-account acct_123
stripe trigger --help
```

Important distinction: an event type existing in the API is not the same as `stripe trigger` having a fixture.

Current docs/local help show `--stripe-account`, so supported fixtures can be scoped to a connected account. The current documented fixture list does not include `v2.core.account.*` thin fixtures. Test Accounts v2 thin events by performing the real v2 API operation and listening with the thin forwarding flags.

## Proof ladder

Use this before declaring a Connect build "working":

1. Provider smoke: Stripe accepts the exact account configuration, capability request, PaymentIntent, Transfer, or Payout.
2. Webhook shape: the expected snapshot/thin event arrives locally, signature verification passes, and the account identity path is correct.
3. App-state reconciliation: the app updates durable state from the webhook, handles retries idempotently, and reconciles with a follow-up Stripe retrieve.

This matters because Connect flows are async, retries happen, and separate charges/transfers can fail independently.

## Common local gotchas

- Signature verification fails: you parsed or changed the body before verification. Use raw body (`await req.text()` in Next.js App Router).
- Local secret mismatch: using Dashboard `whsec_...` while events arrive via `stripe listen`. Use the CLI printed secret for local CLI events.
- Connected-account events miss separate route: add `--forward-connect-to`.
- `event.account` is undefined: you are handling platform events or v2 thin events. For v2 thin account events, inspect/fetch `related_object`.
- API call acts on platform: pass `stripeAccount` request option / `Stripe-Account` header.
- Capability looks inactive but action works in sandbox: sandboxes may not enforce all capabilities. Test restricted states too.
- `stripe trigger payout.paid` fails: fixture may not exist. Drive the real flow or resend a captured event.

## Useful test data

From Connect testing docs:

- Hosted onboarding SMS code: `000-000`.
- DOB `1901-01-01`: verification success.
- DOB `1900-01-01`: OFAC alert.
- ID number `000000000`: success.
- ID number `111111111`: mismatch.
- US bank routing `110000000`, account `000999999991`.
- Trigger card `4000000000004202`: moves requirements toward due.
- Trigger card `4000000000004210`: charge block.
- Trigger card `4000000000004236`: payout block.

## Test clocks

Useful for subscriptions, trials, renewals, and dunning. Docs do not explicitly confirm connected-account test-clock usage via `Stripe-Account`; verify empirically before relying on it.

Limits include forward-only time travel and per-clock/customer/subscription limits. Watch for `test_helpers.test_clock.advancing` -> `test_helpers.test_clock.ready` before asserting state.

## Sources

- https://docs.stripe.com/sandboxes
- https://docs.stripe.com/sandboxes/dashboard/manage
- https://docs.stripe.com/sandboxes/dashboard/sandbox-settings
- https://docs.stripe.com/connect/testing
- https://docs.stripe.com/cli/listen
- https://docs.stripe.com/cli/trigger
- https://docs.stripe.com/stripe-cli/keys
- https://docs.stripe.com/keys
- https://docs.stripe.com/connect/webhooks
- https://docs.stripe.com/billing/testing/test-clocks
