# Webhooks and Events

Last verified against Stripe docs: 2026-05-29.

Use this when building webhook handlers, debugging event scope, handling v2 thin events, or testing Connect webhooks locally.

## Contents

- [Snapshot vs thin events](#snapshot-vs-thin-events)
- [Next.js App Router snapshot handler](#nextjs-app-router-snapshot-handler)
- [Thin event pattern](#thin-event-pattern)
- [Connect event scope](#connect-event-scope)
- [Important v2 account event types](#important-v2-account-event-types)
- [Event destinations](#event-destinations)
- [Handler discipline](#handler-discipline)

## Snapshot vs thin events

| | Snapshot events | Thin events |
|---|---|---|
| Payload | Full versioned object snapshot | Lightweight notification/reference |
| Common source | v1 APIs and snapshot event destinations | v2 APIs plus selected thin-capable event types |
| Account identity | v1 Connect events include top-level `account` | v2 account thin events use `related_object` / fetched event |
| Parse pattern | `stripe.webhooks.constructEvent` | Version-dependent; see thin-event pattern below |

Accounts v2 can trigger both v1 snapshot events and v2 thin events. For events triggered by connected accounts, v2 account events use "Your account" scope while v1 events use "Connected accounts" scope.

## Next.js App Router snapshot handler

Webhook verification requires the raw request body. Do not call `req.json()` before verification.

```ts
import Stripe from 'stripe';
import { NextRequest } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-05-27.dahlia',
});

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return new Response('Missing stripe-signature', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${(err as Error).message}`, {
      status: 400,
    });
  }

  if (event.account) {
    // v1 snapshot Connect event; event.account is the connected account ID.
  }

  return new Response(null, { status: 200 });
}
```

Pages Router requires disabling body parsing. App Router route handlers do not parse by default, but only if you read `req.text()` before JSON parsing.

## Thin event pattern

Clover+ webhook docs show event notifications with follow-up fetches:

```js
const eventNotification = stripe.parseEventNotification(body, sig, endpointSecret);
const event = await eventNotification.fetchEvent();
const relatedObject = await eventNotification.fetchRelatedObject();
```

API reference and Acacia/Basil examples may show `parseThinEvent`, and some lightweight-notification examples use `constructEvent`. Verify helper names against the installed `stripe` package and pinned API version before shipping code.

For v2 account events:

- Get the affected account from `event.related_object.id` or the fetched related object.
- Do not expect the old v1 top-level `event.account` field on v2 thin account events.
- Use `context`/auth context as documented when fetching related resources.

## Connect event scope

Classic v1 Connect events:

```json
{
  "object": "event",
  "type": "account.updated",
  "account": "acct_CONNECTED",
  "data": { "object": {} }
}
```

If an `account.updated` event arrives, the connected account object is already in `event.data.object`; alternatively, retrieve the Account from the platform side:

```js
const connectedAccount = event.data.object;
// or:
const refreshedAccount = await stripe.accounts.retrieve(event.account);
```

If an event concerns another object owned by the connected account, retrieve or mutate that object with the connected-account scope:

```js
const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
  stripeAccount: event.account,
});
```

Registered endpoints:

- Dashboard/Workbench: set "Events from" to "Connected accounts".
- API v1 webhook endpoints: set `connect: true`.
- CLI: use `--forward-connect-to` when you need a separate local route.

## Important v2 account event types

Common Accounts v2 event types:

```text
v2.core.account.created
v2.core.account.updated
v2.core.account.closed
v2.core.account[configuration.merchant].updated
v2.core.account[configuration.merchant].capability_status_updated
v2.core.account[configuration.recipient].updated
v2.core.account[configuration.recipient].capability_status_updated
v2.core.account[configuration.customer].updated
v2.core.account[configuration.customer].capability_status_updated
v2.core.account[defaults].updated
v2.core.account[identity].updated
v2.core.account[requirements].updated
v2.core.account[future_requirements].updated
v2.core.account_link.returned
```

Money movement still emits v1 event types such as `payment_intent.*`, `charge.*`, `transfer.*`, `payout.*`, and `application_fee.*`.

## Event destinations

For v2 event destinations:

- API: `/v2/core/event_destinations`.
- `event_payload: "thin"` for thin events.
- `event_payload: "snapshot"` for snapshot events.
- `webhook_endpoint.signing_secret` is includable on creation.
- `events_from` controls routing: `@self`, `@accounts`, organization variants.

Classic webhook endpoints and v2 event destinations can coexist.

## Handler discipline

- Verify signature first.
- Deduplicate by event ID.
- Return 2xx quickly.
- Do durable work idempotently.
- Fetch current Stripe state before making irreversible app-state decisions.
- For thin events, fetch the event/related object before deciding what changed.
- For Connect events, persist the connected account ID alongside the business object.

## Sources

- https://docs.stripe.com/webhooks?lang=node
- https://docs.stripe.com/connect/webhooks
- https://docs.stripe.com/event-destinations
- https://docs.stripe.com/api/v2/core/events
- https://docs.stripe.com/api/v2/core/events/event-types
- https://docs.stripe.com/api/v2/core/event-destinations/create
