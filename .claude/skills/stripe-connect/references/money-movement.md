# Money Movement

Last verified against Stripe docs: 2026-05-29. Accounts v2 configures accounts; v1 APIs move money.

Use this when implementing direct charges, destination charges, separate charges/transfers, application fees, payouts, cross-border funds flow, or subscription platform fees.

## Contents

- [v2-to-v1 map](#v2-to-v1-map)
- [Direct charge](#direct-charge)
- [Destination charge](#destination-charge)
- [Separate charges and transfers](#separate-charges-and-transfers)
- [Platform fees](#platform-fees)
- [Payouts](#payouts)
- [Cross-border and currency](#cross-border-and-currency)

## v2-to-v1 map

| Task | API |
|---|---|
| Create/configure account | `POST /v2/core/accounts` |
| Hosted onboarding link | `POST /v2/core/account_links` |
| Embedded account session | `POST /v1/account_sessions` |
| Direct/destination charge | `POST /v1/payment_intents` |
| Transfer funds to connected account | `POST /v1/transfers` |
| Pay out connected account balance | `POST /v1/payouts` as the connected account |
| Manage payout schedule/settings | Accounts v1 API |

The same `acct_...` ID flows through both namespaces.

## Direct charge

Use when the connected account owns the charge.

Requirements:

- Connected account has `merchant`.
- `configuration.merchant.capabilities.card_payments.status` is active for card payments.
- Use the `Stripe-Account` header / Node `stripeAccount` request option.

```js
const paymentIntent = await stripe.paymentIntents.create(
  {
    amount: 1000,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    application_fee_amount: 123,
  },
  { stripeAccount: connectedAccountId }
);
```

Do not summarize fee/loss liability as always "seller pays." For Accounts v2, check:

- `defaults.responsibilities.fees_collector`
- `defaults.responsibilities.losses_collector`

## Destination charge

Use when the platform creates the charge and automatically sends funds to one connected account.

Requirements:

- Connected account can receive transfers: `configuration.recipient.capabilities.stripe_balance.stripe_transfers.status` active.
- If using `on_behalf_of`, connected account is settlement merchant and generally needs `merchant`/`card_payments` too.

```js
const paymentIntent = await stripe.paymentIntents.create({
  amount: 1000,
  currency: 'usd',
  automatic_payment_methods: { enabled: true },
  application_fee_amount: 123,
  transfer_data: {
    destination: connectedAccountId,
  },
  // on_behalf_of: connectedAccountId,
});
```

`application_fee_amount` creates an Application Fee object and is usually cleaner for reporting than only setting `transfer_data[amount]`.

`on_behalf_of` affects settlement merchant, statement descriptor, branding/presentation, settlement currency, and cross-border behavior. It does not move destination-charge dispute/refund liability away from the platform.

## Separate charges and transfers

Use when one payment is split across multiple accounts, funds are routed later, or fulfillment timing is complex.

```js
const paymentIntent = await stripe.paymentIntents.create({
  amount: 10000,
  currency: 'usd',
  automatic_payment_methods: { enabled: true },
  transfer_group: 'ORDER_100',
});
```

Wait until the payment has produced a successful charge, usually in a `payment_intent.succeeded` or `charge.succeeded` webhook. Then retrieve the charge ID from `latest_charge` or by listing charges for the PaymentIntent:

```js
const paidIntent = await stripe.paymentIntents.retrieve(paymentIntent.id);
const chargeId = paidIntent.latest_charge;

await stripe.transfers.create({
  amount: 7000,
  currency: 'usd',
  destination: sellerAccountId,
  transfer_group: 'ORDER_100',
  source_transaction: chargeId,
});

await stripe.transfers.create({
  amount: 1500,
  currency: 'usd',
  destination: driverAccountId,
  transfer_group: 'ORDER_100',
  source_transaction: chargeId,
});
```

Footguns:

- `transfer_group` is just a label; it does not guarantee funds availability.
- Use `source_transaction` when transfers should wait for charge funds.
- You cannot add `source_transaction` after a transfer is created.
- When using `source_transaction`, each transfer amount cannot exceed the source charge, the sum of transfers for the same charge cannot exceed the source charge, and the transfer currency must match the balance transaction currency for the charge.
- For asynchronous payment methods, wait for `charge.succeeded` before transferring when possible. If you use `source_transaction` before final success, you must handle later payment failure and transfer reversal.
- Refunds do not automatically reverse transfers; reverse transfers/application fees when product rules require it.
- Async transfer failures can leave your app state wrong if you mark recipients paid before Stripe confirms the transfer.

## Platform fees

One-time payments:

```js
application_fee_amount: 123
```

Subscriptions:

```js
const subscription = await stripe.subscriptions.create({
  customer,
  items: [{ price }],
  application_fee_percent: 10,
  transfer_data: { destination: connectedAccountId },
});
```

Checkout subscriptions:

```js
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{ price, quantity: 1 }],
  success_url,
  cancel_url,
  subscription_data: {
    application_fee_percent: 10,
    transfer_data: { destination: connectedAccountId },
  },
});
```

## Payouts

Payout operations are still v1. To create a payout from a connected account balance, act as the connected account:

```js
await stripe.payouts.create(
  {
    amount: 5000,
    currency: 'usd',
  },
  { stripeAccount: connectedAccountId }
);
```

Payout schedules/settings are managed through Accounts v1 APIs. Accounts v2 exposes payout capability/status (`stripe_balance.payouts`) in account data/requirements, but request/update behavior is product/version-specific. Verify live docs for the target account.

## Cross-border and currency

Country/currency decisions can change the whole flow:

- Platform and connected account country determine supported corridors.
- Unsupported corridors can return transfer errors or require a different product path.
- Cross-border payouts have fees and service-agreement requirements.
- Supported-region cross-border transfers and US cross-border payout / recipient-service-agreement flows have different `on_behalf_of` rules. Verify the exact corridor: some destination/separate charge corridors use `on_behalf_of` to make the connected account settlement merchant, while cross-border payout flows require the platform to remain business of record.
- Currency conversion and settlement currency can affect fees and reporting.

Always check platform country, connected-account country, customer currency, settlement currency, and payout currency before committing to a charge flow.

## Sources

- https://docs.stripe.com/connect/charges
- https://docs.stripe.com/connect/direct-charges
- https://docs.stripe.com/connect/destination-charges
- https://docs.stripe.com/connect/separate-charges-and-transfers
- https://docs.stripe.com/api/payment_intents/create
- https://docs.stripe.com/api/transfers/create
- https://docs.stripe.com/api/payouts/create
- https://docs.stripe.com/api/application_fees
- https://docs.stripe.com/connect/subscriptions
- https://docs.stripe.com/connect/cross-border-payouts
- https://docs.stripe.com/connect/currencies
