# Nano Banana on the Gemini Developer API (API-key path)

The occasional alternative to Vertex. Same models (`gemini-3-pro-image`,
`gemini-3.1-flash-image`), same generation/editing/chat call shapes as SKILL.md — the
difference from Vertex is the **client + auth** and a few API-only details (rate-limit
source, batch, Files API). Verified against `ai.google.dev/gemini-api/docs`.

## Client construction (`@google/genai`)

```ts
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});                 // reads GEMINI_API_KEY from the env
// or pass it explicitly:
const ai2 = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
```

The official samples use the empty-constructor form and rely on the environment:

```bash
export GEMINI_API_KEY="your-api-key"   # GOOGLE_API_KEY also works
```

Get a key from Google AI Studio. The key carries the billing/usage tier — keep it
server-side. After construction, call `ai.models.generateContent(...)` /
`ai.chats.create(...)` exactly as in SKILL.md.

## Passing input images

- **Small / one-off images:** inline base64 as `{ inlineData: { mimeType, data } }` parts
  (shown in SKILL.md). Simplest, but counts against the request size.
- **Large or reused images:** upload via the **Files API** and reference the returned URI —
  `const f = await ai.files.upload({ file: "photo.png" })`, then build a part with
  `createPartFromUri(f.uri, f.mimeType)`. Preferred for big inputs and when reusing the same
  image across calls.

`responseModalities` can be `["TEXT", "IMAGE"]` (default in examples) or `["IMAGE"]` for
image-only output.

## Pricing (standard paid tier)

| Model | Input (text/image) | Text+thinking out | Image out | Per image |
|---|---|---|---|---|
| `gemini-3.1-flash-image` | $0.50 / 1M | $3 / 1M | $60 / 1M tok | 0.5K $0.045 · 1K $0.067 · 2K $0.101 · 4K $0.151 |
| `gemini-3-pro-image` | $2.00 / 1M | $12 / 1M | $120 / 1M tok | 1K/2K $0.134 · 4K $0.24 |
| `gemini-2.5-flash-image` (legacy) | $0.30 / 1M | — | — | $0.039 |

Output-image token counts — Flash: 747 / 1120 / 1680 / 2520 for 0.5K/1K/2K/4K. Pro: 1120 for
1K & 2K, 2000 for 4K. Input images bill a flat **~560 tokens each** (≈ $0.0011/image on Pro per
the pricing footnote; underlying rule: 258 tokens if both dimensions ≤384px, else 768×768 tiles
at 258 tokens each). **Neither Gemini 3 image model has a free tier.**

## Rate limits

Per-model **RPM / TPM / RPD** (and **IPM**, images-per-minute, which applies only to
image-generating models) are **not published in the docs** — they depend on your usage tier
and are shown live at **[aistudio.google.com/rate-limit](https://aistudio.google.com/rate-limit)**.
Key facts that *are* documented:

- Limits apply **per project**, not per API key; **RPD resets at midnight Pacific**.
- Tiers: **Free** (no image-gen access in practice), **Tier 1** (active billing account),
  **Tier 2** (paid $100 + 3 days from first payment), **Tier 3** (paid $1,000 + 30 days from
  first payment). Higher tier = higher limits.
- Preview/experimental models get tighter limits than stable ones.

## Batch API

For non-interactive bulk jobs you get much higher throughput in exchange for **up to 24h
turnaround**. Enqueued-token caps by tier (Tier 1 / 2 / 3):

| Model | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| `gemini-3-pro-image` | 2,000,000 | 270,000,000 | 1,000,000,000 |
| `gemini-3.1-flash-image` | 1,000,000 | 250,000,000 | 750,000,000 |

Plus: 100 concurrent batch requests, 2GB input file size, 20GB file storage. Batch pricing is
roughly half the standard per-image rate. (As of now the rate-limits page still labels these
rows with the `-preview` model names; the caps are expected to carry to the GA IDs — confirm
in AI Studio.)

## Canonical docs

- Image generation guide: `ai.google.dev/gemini-api/docs/image-generation`
- Model pages: `ai.google.dev/gemini-api/docs/models/gemini-3-pro-image` and `.../gemini-3.1-flash-image`
- Pricing: `ai.google.dev/gemini-api/docs/pricing` · Rate limits: `ai.google.dev/gemini-api/docs/rate-limits`
