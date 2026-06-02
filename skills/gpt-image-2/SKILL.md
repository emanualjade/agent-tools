---
name: gpt-image-2
description: >-
  Use any time the user is working with OpenAI's image-generation API — the
  gpt-image models (gpt-image-2 and gpt-image-1.5/1/1-mini): generating or editing
  images, sizes and aspect ratios, quality, pricing, or wiring it into an app. The
  exact model IDs, sizes, and limits here override stale memory, so consult it
  instead of guessing. Not for non-OpenAI generators (Midjourney, Stable Diffusion,
  Imagen/Gemini, Flux) or Sora video.
---

# Building with OpenAI's Image API (gpt-image-2)

A reference for wiring OpenAI image generation into your own app. Everything here is
drawn from `developers.openai.com` and verified against it — if a detail you need
isn't here, confirm it in the [image generation guide](https://developers.openai.com/api/docs/guides/image-generation)
or the [API reference](https://developers.openai.com/api/reference/resources/images/methods/generate)
rather than guessing, because this model family moves fast and plausible-sounding
parameters are easy to invent.

This skill is for *understanding and integrating* the API. It is not for generating
images during a chat.

## Models — use these exact IDs

These are the only valid image model IDs. Pass one **verbatim** as `model`. Don't
invent variants or hedge that the model "might be called something else" —
`gpt-image-2` is the current model and these strings are exact.

| Model ID | Role | Notes |
|---|---|---|
| `gpt-image-2` | **Current default.** Highest quality, medium speed. | Custom sizes; native high-fidelity image inputs. Pinned snapshot: `gpt-image-2-2026-04-21`. |
| `gpt-image-1.5` | Previous generation; keep while migrating prompts | Predefined sizes only; accepts `input_fidelity`. |
| `gpt-image-1` | Older generation | Predefined sizes only; accepts `input_fidelity`. |
| `gpt-image-1-mini` | Cheapest; large batches | The only "mini" — **there is no `gpt-image-2-mini`**. |

Pick `gpt-image-2` for almost everything (customer-facing assets, photorealism,
editing-heavy flows); drop to `quality: "low"` on it when speed/cost dominate, before
reaching for a smaller model. `dall-e-2` / `dall-e-3` share these endpoints but are
out of scope here.

> **Reference-enum lag:** the API reference's `model` dropdowns for both
> `/v1/images/generations` and `/v1/images/edits` may not list `gpt-image-2` yet —
> that's a docs-rendering lag, not a sign the ID is wrong. The model card confirms
> `gpt-image-2` supports **both** endpoints, so pass it as the model string and it works.

## Two ways to call it

**1. Images API** — REST endpoints, base64 result.
- `POST /v1/images/generations` — generate from a text prompt.
- `POST /v1/images/edits` — edit / compose using one or more input images (+ optional mask).

```ts
import OpenAI, { toFile } from "openai";
import fs from "node:fs";
const client = new OpenAI();

// Generate
const res = await client.images.generate({
  model: "gpt-image-2",
  prompt: "A photorealistic ceramic coffee mug on a sunlit oak table",
  size: "1536x1024",
  quality: "high",
  output_format: "webp",
});
const b64 = res.data[0].b64_json;          // GPT-image always returns base64, never a URL
const buf = Buffer.from(b64, "base64");

// Edit (keep the product, swap the background)
const edited = await client.images.edit({
  model: "gpt-image-2",
  image: [await toFile(fs.createReadStream("product.png"), "product.png")],
  prompt: "Place this exact product on a plain white opaque background. Change nothing about the product.",
});
```

**2. Responses API `image_generation` tool** — best for multi-turn editing and
streaming inside an agent loop.

```ts
const r = await client.responses.create({
  model: "gpt-5.5",                        // gpt-5 and newer support the image_generation tool
  input: "Draw a minimalist line-art fox logo",
  tools: [{ type: "image_generation", quality: "high", partial_images: 2 }],
});
const images = r.output
  .filter((o) => o.type === "image_generation_call")
  .map((o) => o.result);                   // base64 string(s)
```

Tool fields mirror the Images API plus: `action` (`auto` default / `generate` / `edit`)
and `input_image_mask` for masked edits.

## Sizes, aspect ratio & custom resolutions

This is the part most people get wrong, so it's worth getting exactly right.

**Standard preset sizes** (all GPT-image models): `1024x1024` (square), `1536x1024`
(landscape), `1024x1536` (portrait), and `auto` (the default — the model picks).

**`gpt-image-2` also accepts arbitrary `WIDTHxHEIGHT` resolutions** (e.g. `1536x864`),
as long as the size satisfies **all** of these:
- both width and height are **multiples of 16**;
- **aspect ratio between 1:3 and 3:1** (the long edge is at most 3× the short edge);
- **longest edge ≤ 3840px**;
- **total pixels between 655,360 and 8,294,400**;
- anything **above `2560x1440` (2K, 3,686,400 px) is experimental**; `3840x2160` (4K) is the documented ceiling.

Useful targets within those rules: `2048x2048`, `2048x1152`, `2560x1440` (QHD),
`3840x2160` / `2160x3840` (4K).

**Earlier models** (`gpt-image-1.5`, `gpt-image-1`, `gpt-image-1-mini`) use predefined
sizes only — `1024x1024`, `1024x1536`, `1536x1024`, `auto` — no custom sizes.

**The edits endpoint** documents `size ∈ {auto, 1024x1024, 1536x1024, 1024x1536}`;
treat arbitrary custom resolutions as a generation feature.

**Targets outside these limits.** A requested size can fall outside what the model
supports — below the pixel minimum, beyond the 3:1 ratio, or not 16-divisible (many
thumbnails and ad slots do). `gpt-image-2` can't render those directly; the usual fix
is to generate at the nearest supported size and downscale/crop to the exact target.
Knowing the limits above is enough to recognize when that's needed.

## Request parameters

Applies to the Images API (`generations` and, where noted, `edits`). Allowed values
are exact; "GPT-image" means `gpt-image-2` / `1.5` / `1` / `1-mini`.

| Param | Allowed values | Default | Notes |
|---|---|---|---|
| `model` | model id string | `dall-e-2`* | *Defaults to dall-e-2 unless a GPT-image-specific param is set — always set it explicitly. |
| `prompt` | string | — (required) | Max **32000** chars for GPT-image models. |
| `n` | 1–10 | 1 | Number of images per request. |
| `size` | presets or custom (above) | `auto` | See sizes section. |
| `quality` | `low`, `medium`, `high`, `auto` | `auto` | Higher = more detail/legible text, slower, costlier. |
| `output_format` | `png`, `jpeg`, `webp` | `png` | GPT-image only. |
| `output_compression` | 0–100 | 100 | GPT-image only, `jpeg`/`webp` only. |
| `background` | `transparent`, `opaque`, `auto` | `auto` | GPT-image only. **`gpt-image-2` does not support `transparent`** — get a PNG/WebP and key it out downstream. |
| `moderation` | `low`, `auto` | `auto` | `low` = less restrictive filtering. |
| `stream` | boolean | `false` | GPT-image only; pairs with `partial_images`. |
| `partial_images` | 0–3 | — | Stream preview frames; omit (or `0`) → only the final image. Each preview adds +100 image output tokens; you may get fewer than requested. |
| `user` | string | — | End-user id for abuse monitoring. |

Edits endpoint adds: `image` (1+ input images; **up to 16** for GPT-image), `mask`,
and `input_fidelity` (see below). `response_format` (`url`/`b64_json`) and `style`
exist only for DALL·E — **GPT-image models always return base64**, never a URL.

## Editing, masks & input fidelity

- **Input images**: pass via `image` (Images API edits) or as input items / `images[]`
  with a `file_id` or a base64 `image_url` data URL (≤ ~20MB) in the reference schema.
  Up to **16** reference images for GPT-image models.
- **Masks**: supply a `mask` whose transparent (alpha) area marks what to repaint. The
  mask **must contain an alpha channel** and match the image's **format and size**;
  image and mask must each be **< 50MB**. With multiple input images, the mask applies
  to the **first** one. (In the Responses tool, use `input_image_mask`.)
- **`input_fidelity`** (`high` / `low`) controls how strongly the model preserves
  details (faces, logos, product shape) from input images. **Omit it for
  `gpt-image-2`** — it always processes inputs at high fidelity (which also means edits
  with reference images consume more image input tokens). It applies to the earlier
  GPT-image edit models (`gpt-image-1.5`, `gpt-image-1`, `gpt-image-1-mini`).

## Response shape (Images API)

```jsonc
{
  "created": 1730000000,            // unix seconds
  "background": "opaque",
  "data": [{ "b64_json": "<base64>" }],  // GPT-image: b64_json only (no url, no revised_prompt)
  "output_format": "png",
  "quality": "high",
  "size": "1536x1024"
  // "usage": { input_tokens, output_tokens, total_tokens, ...token details }  // gpt-image-1 only
}
```

## Pricing & rate limits

Cost is **token-based** — output tokens scale with `quality` × dimensions. Per-1M-token
rates (OpenAI's *standard* pricing column; cached image input is billed lower):

| Model | Text in | Image in | Image out |
|---|---|---|---|
| `gpt-image-2` | $5.00 | $8.00 | **$30.00** |
| `gpt-image-1.5` | $5.00 | $8.00 | $32.00 |
| `gpt-image-1-mini` | $2.00 | $2.50 | $8.00 |

Handy per-image $ for `gpt-image-2` (from the guide's calculating-costs table):

| Quality | 1024x1024 | 1024x1536 | 1536x1024 |
|---|---|---|---|
| low | $0.006 | $0.005 | $0.005 |
| medium | $0.053 | $0.041 | $0.041 |
| high | $0.211 | $0.165 | $0.165 |

For custom sizes, estimate with the
[image generation cost calculator](https://developers.openai.com/api/docs/guides/image-generation#calculating-costs).
Each streamed partial image adds 100 image output tokens.

**Rate limits for `gpt-image-2`** (TPM = tokens/min, IPM = images/min; no Free-tier row):
Tier 1 = 100k TPM / 5 IPM · Tier 2 = 250k / 20 · Tier 3 = 800k / 50 · Tier 4 = 3M / 150 · Tier 5 = 8M / 250.

## Prompting that works

The model rewards specificity and structure. Practical rules from OpenAI's guide:

- **Order the prompt** consistently: scene/background → subject → key details → constraints.
- **Be concrete** about materials, shapes, textures, and the visual medium. For
  photorealism, literally include the word **"photorealistic"**.
- **Composition**: state framing/viewpoint (close-up, wide, top-down), angle
  (eye-level, low-angle), and lighting/mood. For people, describe scale, body framing,
  gaze, and how they interact with objects.
- **Text in images**: put literal text in **"quotes"** or **ALL CAPS**, specify
  typography (font style, size, color, placement), and **spell tricky/brand words
  letter-by-letter**. Use `quality: "medium"` or `"high"` for small or dense text.
- **Iterate, don't overload**: start from a clean base prompt and make small,
  single-change follow-ups — easier to debug than one giant prompt.
- **Latency/volume**: start at `quality: "low"`.

### Editing patterns

Edits work best when you say explicitly **what to change** and **what to preserve**,
and repeat the preserve-list on each iteration to stop drift.

- **Style transfer**: *"Use the same style as the input image and generate \<new subject\> on a white background."*
- **Identity preservation / try-on**: *"Do not change her face, skin tone, body shape, pose, or identity. Replace only the clothing, fitting it naturally with realistic fabric behavior. Match the original lighting, shadows, and color temperature."*
- **Object removal**: *"Remove the \<object\>. Do not change anything else."*
- **Compositing across images**: *"Place the \<subject\> from image 2 into the setting of image 1, matching the lighting, composition, and background."* — reference each input by index.
- **Product mockups**: *"Extract the product and place it on a plain white opaque background. Centered product, crisp silhouette, no halos or fringing."*
