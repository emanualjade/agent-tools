---
name: nano-banana
description: >-
  Use any time the user is working with Google's "Nano Banana" image models on
  the Gemini API or Vertex AI — Nano Banana 2 (Gemini 3.1 Flash Image,
  `gemini-3.1-flash-image`) and Nano Banana Pro (Gemini 3 Pro Image,
  `gemini-3-pro-image`): generating or editing images, resolutions, aspect
  ratios, grounding, pricing, the @google/genai SDK, or choosing Flash vs Pro.
  The exact model IDs and limits here override stale memory — the `-preview` IDs
  are deprecated — so consult it instead of guessing. Not for OpenAI gpt-image,
  Midjourney, Stable Diffusion, Flux, or Veo/Sora video.
---

# Building with Google's Nano Banana image models

A reference for wiring Google's current image-generation models into your own app.
Everything here is drawn from `ai.google.dev/gemini-api/docs` and Google Cloud's Vertex
docs and verified against them — if a detail you need isn't here, confirm it in the
[image generation guide](https://ai.google.dev/gemini-api/docs/image-generation) rather
than guessing, because the naming around these models is genuinely confusing and plausible
IDs/params are easy to invent.

This skill is for *understanding and integrating* the models. It is not for generating
images during a chat. You call both models through the **`@google/genai`** SDK; the only
thing that changes between platforms is how you construct the client:

- **Vertex AI** (your default) → see `references/vertex-ai.md`
- **Gemini Developer API** (occasional, API-key) → see `references/gemini-api.md`

## Models — use these exact IDs

"Nano Banana" is three different models. Pass the **model code** verbatim. These are the
current **GA / stable** IDs — and they have **no `-preview` suffix and no `nano-banana-pro`
alias**, which is the single most common mistake here.

| Nickname | Real model | Model code (use this) | Role |
|---|---|---|---|
| **Nano Banana 2** | Gemini 3.1 Flash Image | `gemini-3.1-flash-image` | Fast, cheap, high-volume Flash model. Launched Feb 2026. |
| **Nano Banana Pro** | Gemini 3 Pro Image | `gemini-3-pro-image` | High-end, reasoning/quality model. Launched Nov 2025. |
| ~~Nano Banana~~ (legacy) | Gemini 2.5 Flash Image | `gemini-2.5-flash-image` | Prior generation — **don't use it**; reach for Nano Banana 2 instead. |

> **The `-preview` IDs are deprecated.** Both models launched as `*-preview`
> (`gemini-3-pro-image-preview`, `gemini-3.1-flash-image-preview`) and went GA on
> 2026-05-28. The preview IDs are scheduled to **shut down 2026-06-25** — migrate any code
> still using them to the bare IDs above. `nano-banana-pro` is a display nickname, **not a
> callable model string**. (The legacy 2.5 line's preview, `gemini-2.5-flash-image-preview`,
> was already shut down on 2026-01-15 — use `gemini-2.5-flash-image` if you ever touch it,
> though that GA legacy model is itself deprecated, with shutdown no earlier than 2026-10-02.)
> One caveat for Vertex (your default): its model pages now show the bare GA IDs as the Model
> ID, but the console's *Try* / *Deploy* buttons can still link the `-preview` IDs — see
> `references/vertex-ai.md` and call the bare IDs.

## Nano Banana 2 (Flash) vs Nano Banana Pro — the difference

This side-by-side is the whole point of the skill. Both do native generation, multi-image
fusion, and conversational editing; they differ in ceiling, controls, and price.

| | **Nano Banana 2** (`gemini-3.1-flash-image`) | **Nano Banana Pro** (`gemini-3-pro-image`) |
|---|---|---|
| **Output resolutions** | 512 (0.5K), 1K *(default)*, 2K, 4K | 1K *(default)*, 2K, 4K — **no 512** |
| **Aspect ratios** | All 14, incl. extreme `1:4 4:1 1:8 8:1` | 10 standard — **no** `1:4/4:1/1:8/8:1` |
| **Reference images** | up to **14** total: ≤10 objects + ≤4 characters | up to **14** total: ≤6 objects + ≤5 characters |
| **Thinking** | On by default + a `thinkingLevel` knob (`minimal` default / `high`) | On by default; **no** exposed level knob |
| **Web Search grounding** | Supported | Supported |
| **Image Search grounding** | **Supported (Flash-only)** | Not available |
| **Text rendering** | Reliable, legible text; improved i18n vs older Flash | Stronger — high-fidelity rendering of dense, long, complex text |
| **Creative control** | Standard editing | Studio-quality precision & advanced creative control (per the Pro model page) |
| **Input / output token limit** | 131,072 / 32,768 | 65,536 / 32,768 |
| **Knowledge cutoff** | January 2025 | January 2025 |
| **Image output price** | **$60 / 1M tok** → $0.045 / $0.067 / $0.101 / $0.151 per 0.5K/1K/2K/4K | **$120 / 1M tok** → $0.134 per 1K/2K, $0.24 per 4K |
| **Positioning** | Speed, high volume, mainstream price | Professional asset production, complex instructions, max quality |

Both are *thinking* models: reasoning is on by default and **can't be disabled in the API**,
and each may render up to two interim images while it works. The only difference is that
Flash exposes a `thinkingLevel` (`minimal`/`high`, set via `config.thinkingConfig.thinkingLevel`)
to trade quality for latency.

**When to use which:**

- **Default to Nano Banana 2 (Flash).** It's ~2× cheaper, faster, supports 512px thumbnails
  and the extreme panoramic/banner ratios, adds Image-Search grounding, and lets you trade
  quality for latency via `thinkingLevel`. Right for app-facing, high-volume, cost-sensitive
  generation and editing.
- **Reach for Nano Banana Pro** when quality is the point: dense or multilingual **text**
  (infographics, posters, packaging, UI mockups), **complex multi-element prompts** that need
  reasoning, **studio-grade** lighting/camera control, stronger multi-subject consistency (up
  to 5 characters), and polished **4K** hero renders.

## Resolutions & aspect ratios

Configured per request via `config.imageConfig` (JS/TS). Getting the literal values right
matters — the API rejects malformed ones.

- **`imageSize`**: `"512"`, `"1K"`, `"2K"`, `"4K"`. The **`K` must be uppercase** (`1k` is
  rejected) and **`512` has no `K`**. Default is `1K`. `512` is **Flash-only**; Pro tops out
  at 1K/2K/4K. (4K is 4096×4096 only at `1:1`; non-square ratios scale the long edge higher —
  e.g. 4K `4:1` is 8192×2048, 4K `1:8` is 1536×12288.)
- **`aspectRatio`**: `"1:1"`, `"2:3"`, `"3:2"`, `"3:4"`, `"4:3"`, `"4:5"`, `"5:4"`, `"9:16"`,
  `"16:9"`, `"21:9"` (both models), **plus** `"1:4"`, `"4:1"`, `"1:8"`, `"8:1"` (**Flash only**).
- **Default aspect ratio**: the model matches the input image's ratio when editing, otherwise
  produces a `1:1` square. Set `aspectRatio` to override.

(On Vertex the GA rollout flagged 4K as still-previewing while 1K/2K went GA — see
`references/vertex-ai.md`. On the Gemini Developer API all of 1K/2K/4K are priced and supported.)

## Calling it (`@google/genai`)

Create the client for your platform (see the reference files), then the calls below are
identical on Vertex and the Gemini API. The model returns **text + image by default**, so
`responseModalities` is optional — pass `["IMAGE"]` for image-only output, or list
`["TEXT","IMAGE"]` to be explicit (the examples below do).

> **Field-name gotcha — trust the SDK, not the doc samples.** Size/ratio go in
> **`config.imageConfig = { aspectRatio, imageSize }`** (Python:
> `image_config=ImageConfig(aspect_ratio=…, image_size=…)`). Google's image-generation guide
> shows a `responseFormat: { image: {…} }` field in its **JS / Python / REST** samples — that
> is **wrong for `generateContent`.** `responseFormat` is a field on Google's *separate*
> Interactions API (`ai.interactions.create`), **not** on `GenerateContentConfig` — the only
> `responseFormat`/`response_format` in the v2.7.0 SDK types lives on that Interactions API, so
> when you pass it to `generateContent` the strict serializer **silently drops it** and your
> size/ratio are ignored with no error, leaving the default **1K**. (Tell that the doc is buggy:
> its own Go/Java/C# samples correctly use `imageConfig`.) `imageConfig` is **flat** — no nested
> `image` wrapper. Verified wire body:
> `{ generationConfig: { imageConfig: { aspectRatio, imageSize } } }`. More generally, when docs
> disagree among themselves or with the SDK, let the **installed package** settle field
> names/shapes (trust its runtime converter over its JSDoc) and let the **docs** settle allowed
> values (enums, sizes, prices) — the SDK's JSDoc enums lag.

**Generate from text:**

```ts
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
const ai = new GoogleGenAI({}); // Vertex: new GoogleGenAI({ vertexai: true, project, location })

const response = await ai.models.generateContent({
  model: "gemini-3-pro-image",            // or "gemini-3.1-flash-image"
  contents: "A photorealistic ceramic mug on a sunlit oak table, steam rising",
  config: {
    responseModalities: ["TEXT", "IMAGE"],
    imageConfig: { aspectRatio: "16:9", imageSize: "2K" }, // size/ratio live here — NOT responseFormat
  },
});

for (const part of response.candidates[0].content.parts) {
  if (part.inlineData) {                   // image bytes are base64, never a URL
    fs.writeFileSync("out.png", Buffer.from(part.inlineData.data, "base64"));
  } else if (part.text) {
    console.log(part.text);
  }
}
```

**Edit / compose with input images** — pass each image as an `inlineData` part (base64)
alongside the instruction. Up to 14 reference images (see limits above).

```ts
const base64 = fs.readFileSync("product.png").toString("base64");
const response = await ai.models.generateContent({
  model: "gemini-3.1-flash-image",
  contents: [
    { text: "Place this exact product on a plain white background. Change nothing about the product." },
    { inlineData: { mimeType: "image/png", data: base64 } },
    // ...add more { inlineData } parts to fuse multiple references
  ],
  config: { responseModalities: ["TEXT", "IMAGE"] },
});
```

**Conversational editing** — multi-turn is the recommended way to iterate; the chat keeps
the image context so each turn refines the last result.

```ts
const chat = ai.chats.create({
  model: "gemini-3-pro-image",
  config: { responseModalities: ["TEXT", "IMAGE"], tools: [{ googleSearch: {} }] },
});
let r = await chat.sendMessage({ message: "Create an infographic explaining photosynthesis." });
r = await chat.sendMessage({                // refine; can override size/ratio per turn
  message: "Translate all the text to Spanish. Change nothing else.",
  config: { imageConfig: { aspectRatio: "16:9", imageSize: "2K" } },
});
```

## Grounding with Google Search

Add `tools: [{ googleSearch: {} }]` to `config` to let the model pull real-time facts into
an image — weather, stock charts, recent events.

- **Web Search grounding** works on **both** models. (With Web Search, image-based search
  results are *not* passed to the model or returned in the response.)
- **Image Search grounding** (using web images as visual context) is **Flash-only** — enable it
  with `tools: [{ googleSearch: { searchTypes: { imageSearch: {} } } }]`. The API returns the
  image sources in `groundingMetadata.groundingChunks` (each image chunk has **`sourceUri`** for
  the containing page and **`imageUri`** for the image), and you **must display a link to the
  containing source webpage** (not the image file) in your UI.

## SynthID watermark & safety

- **Every generated (and edited) image carries an invisible [SynthID](https://ai.google.dev/responsible/docs/safeguards/synthid) watermark** — there is no API flag to turn it off. It survives cropping, filters, and lossy compression; detect it by uploading to Gemini or the SynthID Detector.
- The **visible "Gemini sparkle"** mark is a *consumer Gemini app* policy (kept on Free/Google AI Pro, removed for Ultra and in AI Studio), **not** an API behavior. On Vertex, output **also** carries **C2PA Content Credentials** — both `gemini-3-pro-image` and `gemini-3.1-flash-image` are on Vertex's Content Credentials supported-models list and are auto-signed by Google. See `references/vertex-ai.md`.
- **Safety:** a blocked prompt or filtered output is rejected — always handle the case where a
  returned part has **no `inlineData`**. Filtering surfaces as a `promptFeedback.blockReason`
  or a safety `finishReason` (e.g. `IMAGE_SAFETY` / `IMAGE_PROHIBITED_CONTENT`); tune thresholds
  with `safetySettings`. See `references/vertex-ai.md` for the Vertex specifics.
- **People in output:** `config.imageConfig.personGeneration` (`ALLOW_ALL` / `ALLOW_ADULT` /
  `ALLOW_NONE`) is **Vertex-only** — the `@google/genai` SDK *throws* if you set it on the
  Gemini Developer API path. See `references/vertex-ai.md`.

## Pricing & limits

Pricing is **token-based**, with per-image equivalents the docs publish directly (Gemini
Developer API, standard paid tier):

| Model | Input (text/image) | Image output | Per image |
|---|---|---|---|
| `gemini-3.1-flash-image` | $0.50 / 1M | $60 / 1M tok | 0.5K **$0.045** · 1K **$0.067** · 2K **$0.101** · 4K **$0.151** |
| `gemini-3-pro-image` | $2.00 / 1M | $120 / 1M tok | 1K/2K **$0.134** · 4K **$0.24** |

- Output image **token counts** — Flash: 747 / 1120 / 1680 / 2520 (0.5K/1K/2K/4K). Pro: 1120 (1K & 2K) / 2000 (4K). Pro also bills text+thinking output ($12/1M; Flash $3/1M).
- **Input images** for these models bill a flat **~560 tokens each** (the pricing footnote: 560 tokens ≈ $0.0011/image on Pro). The underlying tiling rule is 258 tokens if both sides ≤384px, else 768×768 tiles at 258 tokens each.
- **No free tier** for either Gemini 3 image model.
- **Rate limits** (RPM/TPM/RPD, plus **IPM** for image models) are **not published per model** — they depend on your tier and are shown in [AI Studio](https://aistudio.google.com/rate-limit). Limits apply per project; RPD resets midnight Pacific. **Batch API** enqueued-token caps (Tier 1/2/3): Pro 2M / 270M / 1B, Flash 1M / 250M / 750M, in exchange for up to 24h turnaround.

Per-platform setup, auth, regions, GA caveats, and the full Vertex-vs-Gemini-API differences
are in the two reference files. Vertex pricing can differ from the Developer-API figures
above — confirm on the Vertex pricing page before quoting Vertex costs.
