I wasn't able to run a live search (permission wasn't granted), so the numbers below are from my knowledge as of early 2026 — confirm them against Google's official Gemini API pricing page before you budget, since image pricing moves. The model recommendations and the resolution/billing mechanics are stable, though.

## Which model for each

| Use case | Model | Why |
|---|---|---|
| **50k product thumbnails/mo** | **Nano Banana** (Gemini 2.5 Flash Image) | Cheap, fast, fine for product imagery without critical text. |
| **A few hundred hero banners with lots of text** | **Nano Banana Pro** (Gemini 3 Pro Image) | Pro's headline feature is **legible, accurate text rendering** (multi-line, multilingual). The base model garbles dense text — this is exactly the case Pro exists for. |

Splitting the workload by model like this is the right call — don't pay Pro prices for thumbnails, and don't fight the base model's text weakness on banners.

## Rough monthly cost

Per-image prices I'm working from:
- **Nano Banana (base):** ~**$0.039/image** (flat — 1290 output tokens × $30/1M)
- **Nano Banana Pro:** ~**$0.134/image** at 1K/2K, ~**$0.24/image** at 4K

So:
- **Thumbnails:** 50,000 × $0.039 ≈ **$1,950/mo**
- **Hero banners:** 300 × $0.134 ≈ **$40/mo** (or ~$72/mo if you render them at 4K)

Thumbnails dominate your bill, so that's where optimization matters.

## Can you generate thumbnails at 512px to save money? — No

This is the key thing to get right: **these models bill a flat per-image token count regardless of output dimensions.** Base Nano Banana charges 1290 tokens (~$0.039) per image whether the result is 512px or 1024px. Asking for a smaller image does **not** lower the price. (Pro is tiered, but only in coarse 1K/2K vs 4K bands — not a continuous "smaller = cheaper" dial, and its native floor is ~1K anyway.)

What actually saves money:

1. **Batch API — ~50% off.** Gemini's batch (async) endpoint is roughly half price. If thumbnail generation doesn't need to be real-time (e.g. you process new SKUs in nightly jobs), 50k thumbnails drops from ~$1,950 to **~$975/mo**. This is your biggest lever.
2. **Generate once, downscale yourself.** Render at the model's native resolution, then resize to 512px locally (Sharp/Pillow/ImageMagick). Free, and gives you exact control over the final dimensions and format.
3. **Cache/dedupe.** Don't regenerate a thumbnail that already exists for an unchanged product image.

So: 512px won't cut the per-call cost, but Batch + local downscaling gets you the cheap-and-small result you're after — landing thumbnails around **$975/mo** and banners around **$40/mo**.

Two things worth confirming on the official pricing page before you commit: (1) current per-image prices for both models, and (2) that Batch is supported for the image endpoint in your region/tier.