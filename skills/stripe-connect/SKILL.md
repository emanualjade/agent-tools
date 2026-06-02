---
name: stripe-connect
description: >-
  Help with Stripe Connect platforms and marketplaces — onboarding connected
  accounts, routing and splitting payments, taking application fees, managing
  payouts, and debugging Connect integrations. Use whenever doing any work with 
  Stripe Connect. Also use on triggers direct charges, destination charges,
  separate charges and transfers, Accounts v2, Account Links, embedded
  onboarding, Connect webhooks, v2 thin events, event destinations, stripe
  sandboxes, restricted keys, Stripe CLI testing, application_fee_amount,
  transfer_data, on_behalf_of, acct_ IDs, Stripe-Account or payouts.
---

# Stripe Connect

This skill helps you guide someone through Stripe Connect — from "which setup do I even want?" all the way to "why isn't my webhook firing in the sandbox?" Connect is broad and full of sharp edges, and the official docs are scattered, so the goal here is to give you the right mental model, sensible defaults, the gotchas that actually waste people's afternoons, and a map of where the real docs live.

## How to talk to the person you're helping

Talk like a knowledgeable friend explaining things over coffee — warm, relaxed, plain-spoken. You're the one who's done a lot of Stripe; treat them as a capable person who may be new to Connect and genuinely appreciates a little hand-holding.

- **Lead with the plain-English point, then the technical detail.** "You'll take the money and pass most of it on to the seller — here's the Stripe term for that" beats opening with `transfer_data[destination]`.
- **Unpack the jargon the first time you use it.** Don't assume they know what a "capability," a "destination charge," or an `acct_` ID is. One quick clause of explanation costs little and saves confusion.
- **Always say *why* it matters for *their* situation**, not just what the API does.
- **When in doubt, explain a bit more, not less.** The thing to dial back is being terse, pointed, or jargon-heavy.

This isn't just bedside manner. Half of Connect work is helping a real person feel confident about a *money* decision — who holds the funds, who's on the hook for a chargeback, who pays the fees. Nobody feels confident reading a wall of API terms. Warm and clear is the job.

## The mental model (start here)

Two ideas unlock almost everything:

**1. One account, switch on roles.** Forget the old "pick an account type — Standard, Express, or Custom" framing; the modern **Accounts v2** model replaces it. Now there's *one* kind of connected account, and you turn on **configurations** (roles) for what it needs to do:

| Role (configuration) | Plain meaning | Turn it on when… |
|---|---|---|
| `merchant` | It can **take money** from customers | the account sells things and collects payment itself |
| `recipient` | It can **receive** payouts/transfers from you | you collect the money and pass funds to them |
| `customer` | **You bill it** (it acts like a customer) | you charge them, e.g. a subscription |

One account can wear several hats. So instead of "which of three types fits this seller?", just ask **"what does this person need to *do*?"** and switch on those roles.

**2. Configure in v2, move money in v1 — same account, two doors.** Stripe's API has two namespaces. You **create and configure** accounts with the new **v2** tools (`/v2/core/accounts`), and hosted onboarding links are v2 too (`/v2/core/account_links`). Embedded onboarding still creates a v1 Account Session. When you actually **charge a card, transfer funds, or pay someone out**, you use the long-stable **v1** tools (PaymentIntents, Transfers, Payouts) — handing them the *same* account. It's one integration spanning both; the person isn't juggling two accounts. (Accounts v2 is **generally available for Connect platforms** — not a beta. Pin the API version `2026-05-27.dahlia` for the stable v2 surface; only reach for a `.preview` version if you need a preview-only capability.)

> Read this when you need it: the deep account model, capabilities, and onboarding code live in **`references/accounts-and-onboarding.md`**. Actual charge/transfer/payout implementation lives in **`references/money-movement.md`**.

## Helping someone choose a setup

The decision that matters most is **how the money flows**, because it decides *who holds funds, who's liable for refunds/chargebacks, and who pays Stripe's fees*. Walk them through it in plain terms first:

| If they want… | Use | Who's liable / pays fees |
|---|---|---|
| Sellers run their own storefront; customers basically buy *from the seller* | **Direct charge** | connected account by default; confirm v2 fee/loss responsibility settings |
| Customers buy *from the platform*, money then flows to a provider | **Destination charge** | the platform |
| One payment split across **several** recipients, or paid out later | **Separate charges & transfers** | the platform |

A couple of plain-English truths worth saying out loud to them:
- **A "platform fee" (`application_fee_amount`) is how you make money** — the slice you keep from each transaction.
- **`on_behalf_of` changes whose name is on the customer's statement, *not* who's liable.** Easy to assume otherwise.
- **For Accounts v2, the direct-charge fee/loss answer comes from `defaults.responsibilities`.** Check `fees_collector` and `losses_collector` before promising who pays Stripe fees or absorbs negative balances.
- **Country and currency are product decisions, not just form fields.** They can change available capabilities, whether cross-border payouts work, whether `on_behalf_of` is required, and which fees apply.

> The full trade-off walkthrough, fees, payouts, and "how to explain each option to a non-technical stakeholder" live in **`references/decision-guide.md`**.

## Common mistakes that waste hours (skim before building)

These are the ones that actually bite people. Each is "do this, because…":

- **"Can't create connected accounts" is almost always an incomplete *platform profile*, not a code bug.** Creating connected accounts requires you to finish Stripe's Connect questionnaire (Dashboard → Settings → Connect → Platform profile) — it's a real, documented prerequisite. When account-creation calls fail with platform/registration errors, check that *first*.
- **Treat `platform_account_required` as field-observed wording, not a public-doc canonical error.** Use it as a strong clue for platform-profile / sandbox-copy problems, but say plainly when a specific error string came from field use rather than Stripe's public error table.
- **A sandbox is frozen at the moment it's created — Stripe explicitly does *not* sync it afterward.** When you create one with "Copy your account" (the default), it copies your settings + capabilities (including the Connect `transfers` capability) *once, at creation*. So if you enable Connect on your main account *after* the sandbox exists, that change **never flows in** — and the field-observed cruel part is the in-sandbox setup checklist can still look "complete" because it's showing stale copied state. Stripe doesn't document an in-place repair path for that stale isolated sandbox; the field-proven workaround is to **recreate** the sandbox after Connect is live on main (then re-auth the Stripe CLI + swap env keys), or use the built-in **test-mode sandbox**, which *does* share state with live — but be careful, because changes there can leak back into your live settings. A few things never copy at all (OAuth redirect URLs, email domains), and every sandbox has its own API keys + webhook endpoints. Bottom line: **finish your platform profile / Connect setup *first*, then create sandboxes.**
- **Sandboxes don't always enforce capabilities** — they can let an action through even when the capability isn't really `active`. So "it worked in the sandbox" doesn't prove it'll work live; exercise the restricted states too. (This is *why* the checklist above can look done while the API still rejects you.)
- **Onboarding links are single-use and short-lived.** Check `expires_at`, generate a fresh one each time someone needs it, and never store/reuse one.
- **Capabilities must be explicitly requested** (for v2, e.g. `configuration.merchant.capabilities.card_payments` or `configuration.recipient.capabilities.stripe_balance.stripe_transfers`) or money silently can't move. If payouts or charges "mysteriously" don't work, check capabilities first.
- **Separate charges & transfers have three easy-to-miss transfer footguns.** When using `source_transaction`, it points at the **Charge** (`ch_...`), not the PaymentIntent; each transfer and the sum of transfers cannot exceed the source charge; the transfer currency must match the charge balance transaction currency. Refunds also do **not** automatically reverse transfers, so mention transfer/application-fee reversals in refund paths.
- **Don't blindly copy Stripe's generated quickstart prompts.** They're useful scaffolds, but they can quietly choose a charge type, Dashboard access, liability posture, or `on_behalf_of` behavior. Make the money-flow decision first; then adapt the scaffold.
- **v2 webhooks are different, and there's a nasty surprise:** a v2 account fires *both* old-style ("snapshot") and new "thin" events, and they arrive under *different scopes* — the v2 ones look like they're from "your own account," not the connected one. Worse, **v2 thin events don't carry the account ID where the old ones did** — you dig it out of `related_object`. Get this wrong and events look like they're "not firing."
- **Verify webhook signatures against the *raw* request body.** In Next.js App Router, read `await req.text()` — don't `req.json()` first, or verification fails.
- **Acting on a connected account? Pass the `Stripe-Account` header** (the `stripeAccount` option in the Node SDK), or your call quietly hits the platform instead.
- **Use restricted API keys for production automation.** Stripe recommends restricted keys; for Connect, scope connected-account access instead of giving tools or deploy previews a full secret key unless they truly need it.

> Detailed fixes, the v1-vs-v2 webhook walkthrough, signature/handler code, and local CLI recipes live in **`references/webhooks-and-events.md`** and **`references/setup-and-testing.md`**.

## Building and testing (Node / Next.js)

The fastest safe loop: work in a **sandbox**, use the **Stripe CLI** to pipe webhooks to your local server, and exercise both the old and new event styles.

- `stripe listen --forward-to localhost:3000/api/webhooks/stripe` forwards classic **snapshot** events and prints a signing secret (stable across restarts — safe to drop in `.env.local`). Connected-account snapshot events use the same URL by default.
- `stripe listen --forward-to localhost:3000/api/webhooks/stripe --forward-connect-to localhost:3000/api/webhooks/connect` forwards **connected-account snapshot events** to a separate route (e.g. a direct charge on a seller). Use it when your platform and Connect handlers are split.
- `stripe listen --thin-events "*" --forward-thin-to localhost:3000/api/webhooks/v2` forwards the **new v2 "thin" events.** Heads-up: it's `--forward-thin-to`, *not* `--forward-to` — `--thin-events` only *picks* which thin events to listen for, and the separate `--forward-thin-to` flag is what actually delivers them.
- For Accounts v2 account changes, the thin `v2.core.account.*` events about your platform's connected accounts use **Your account** scope, so test them with `--forward-thin-to`. Reserve `--forward-thin-connect-to` for thin events emitted in **Connected accounts** scope.
- Because a v2 connected account can fire **both** a v1 event (Connected-accounts scope → `--forward-connect-to`) **and** a v2 thin event (Your-account scope → `--forward-thin-to`) for the same change, testing a connected-account flow end-to-end may mean running more than one of these at once.

> Full setup: sandboxes, the live-first/snapshot rule, CLI recipes, version pinning, and test data live in **`references/setup-and-testing.md`**.

## Where the official docs live

Connect's docs are genuinely scattered, and Stripe restructures them often, so an agent that just "searches Stripe" tends to flail. **`references/doc-map-and-verification.md`** is a curated map for targeted verification: use it to find the right source of truth, answer the concrete uncertainty, then come back to the skill's decision guidance. Do not make the links themselves the answer.

## Reference routing

Open the smallest reference that matches the task:

- **Advising / choosing architecture:** `references/decision-guide.md`
- **Creating accounts / onboarding / capabilities:** `references/accounts-and-onboarding.md`
- **Implementing charges, fees, transfers, payouts, subscriptions:** `references/money-movement.md`
- **Webhook handlers, event scope, v2 thin events:** `references/webhooks-and-events.md`
- **Sandboxes, Stripe CLI, local testing, proof ladder:** `references/setup-and-testing.md`
- **Source URLs, version checks, unresolved flags:** `references/doc-map-and-verification.md`

## Before you trust any of this — verify

Stripe ships fast, and parts of v2 are new. Treat this skill as a strong starting map, not gospel:

- **Pin the API version** (`2026-05-27.dahlia` for stable v2) so things don't shift under you.
- A few v2 details that were murky in earlier drafts are now **settled** (verified against current docs, 2026-05-29): hosted onboarding links use the **v2** endpoint `POST /v2/core/account_links` (SDK `stripe.v2.core.accountLinks.create`) — v1 still accepts a v2 account ID, but v2 is the recommended, configuration-aware path. Embedded-component **account sessions, by contrast, are still v1-only** (`/v1/account_sessions`) — a real v2→v1 handoff. And `stripe trigger` *can* scope supported fixtures to a connected account (`--stripe-account acct_…`), but the current documented fixture list does **not** include `v2.core.account.*` thin events; exercise those by performing real v2 API operations in a sandbox and checking `stripe trigger --help` for any future additions.
- Still genuinely verify-as-you-go: the exact preview-version pin for any capability that's still in preview, and per-account gating. **When something's flagged "verify," confirm it against current docs or by poking a test account rather than asserting it confidently.** Modeling "let's verify" is part of doing Connect well.
