# Nano Banana on Vertex AI (default platform)

How to call `gemini-3-pro-image` (Nano Banana Pro) and `gemini-3.1-flash-image`
(Nano Banana 2) on **Vertex AI / Gemini Enterprise Agent Platform**. The generation,
editing, and chat call shapes are identical to the Gemini Developer API (see
`gemini-api.md` and the SKILL.md examples) — what changes is the **client + auth**.
Verified against Google Cloud docs and `ai.google.dev/gemini-api/docs/migrate-to-cloud`.

## Model IDs

Use the **bare GA IDs** `gemini-3-pro-image` / `gemini-3.1-flash-image` (matching the Developer
API). The current Vertex model pages show these bare IDs as the **Model ID** on a GA endpoint;
the `-preview` IDs (`gemini-3-pro-image-preview`, `gemini-3.1-flash-image-preview`) are
deprecated (2026-06-25 shutdown, same as the Developer API). One lag worth knowing: the Vertex
console's *Try in Agent Platform* / *Deploy example app* buttons — and a still-present separate
"…-preview" model page — can still point at the `-preview` IDs. Ignore those and call the bare
GA IDs.

## GA status (announced 2026-05-28)

The GA blog declares both models **generally available** via Gemini Enterprise Agent Platform.
The model pages mark the endpoint GA but flag a few specific features as still-preview:

- **4K output** — 1K and 2K are GA for both models; **4K remains in preview**.
- **Nano Banana 2 video input** — accepting a video file as a prompt is in preview.
- **Search grounding** is now listed as *Supported* on the current Vertex model pages for
  both models (it was "coming soon" for Nano Banana 2 at the Feb-2026 preview launch — that
  hedge is now stale).

## Client construction (`@google/genai`)

```ts
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  vertexai: true,
  project: "your-gcp-project-id",
  location: "global",        // or a region such as "us-central1"
});
```

Or configure it entirely by environment (no constructor args needed):

```bash
export GOOGLE_GENAI_USE_VERTEXAI=true
export GOOGLE_CLOUD_PROJECT="your-gcp-project-id"
export GOOGLE_CLOUD_LOCATION="global"   # or us-central1
```

After this, use `ai.models.generateContent(...)` / `ai.chats.create(...)` exactly as in
SKILL.md — including `config.imageConfig = { aspectRatio, imageSize }` (not `responseFormat`).

## Auth

Vertex authenticates with **Google Cloud credentials (Application Default Credentials)**,
**not** a Gemini API key.

- **Local dev:** `gcloud auth application-default login` (have the user run this — it's
  interactive; suggest `! gcloud auth application-default login`).
- **Servers / CI:** a **service account** with the Vertex AI User role; point
  `GOOGLE_APPLICATION_CREDENTIALS` at its key, or use the runtime's attached identity
  (Cloud Run, GKE Workload Identity, etc.).

`location` takes a region (e.g. `us-central1`, used in the SDK examples) or the multi-region
`global` endpoint. Verify your region on the model page / in Model Garden if a call 404s on the model.

## Provenance & safety on Vertex

- **All generated images include a SynthID watermark** (no documented flag disables it).
  On Vertex, output **also** carries **C2PA Content Credentials** (interoperable provenance
  metadata, auto-added and signed by Google): both `gemini-3-pro-image` and
  `gemini-3.1-flash-image` are on Vertex's Content Credentials supported-models list (as is the
  legacy `gemini-2.5-flash-image`), and each per-model page lists "Content Credentials (C2PA)"
  under its supported capabilities.
- **Safety filtering** uses a **`safetySettings`** array — each entry is `{ category, threshold }`
  (plus optional `method`), with **uppercase** threshold enums: `BLOCK_LOW_AND_ABOVE`,
  `BLOCK_MEDIUM_AND_ABOVE`, `BLOCK_ONLY_HIGH` (also `OFF` / `BLOCK_NONE`). Note the default: for
  Gemini 2.5/3 models — both Nano Banana models — the additional filters are **`OFF`** when a
  threshold is unset, so set one explicitly to enable blocking. A filtered prompt surfaces as a
  `blockReason` in `promptFeedback`; a blocked generation returns a part with no `inlineData`
  (and a safety `finishReason`). Always handle the no-image case.
- **`personGeneration`** controls people in output — `ALLOW_ALL` / `ALLOW_ADULT` / `ALLOW_NONE`,
  set on `config.imageConfig.personGeneration`. It's **Vertex-only**: the `@google/genai` SDK
  *throws* if you pass it on the Gemini Developer API path (same for the other Vertex-only
  `imageConfig` fields `prominentPeople`, `outputMimeType`, `outputCompressionQuality`,
  `imageOutputOptions`). Don't use the lowercase `allow_all`/`dont_allow` spellings — those are
  the separate **Imagen** API's values.

## Pricing & quotas

Vertex per-image / per-token pricing is **not** assumed to match the Developer-API figures in
SKILL.md — read it off the **Gemini Enterprise Agent Platform pricing page** before quoting a
number. Vertex uses **dynamic shared quota** / project-level
`generate_content_requests_per_minute` rather than published per-image-model RPM/IPM numbers;
request quota increases via the Cloud console if you hit limits.

## Canonical docs

- Vertex generative-AI docs: `cloud.google.com/vertex-ai/generative-ai/docs`
- Migration / client-init reference: `ai.google.dev/gemini-api/docs/migrate-to-cloud`
- The per-model Vertex pages (`.../models/gemini/3-pro-image`, `.../3-1-flash-image`) are
  JavaScript-rendered — open them in a browser rather than fetching raw.
