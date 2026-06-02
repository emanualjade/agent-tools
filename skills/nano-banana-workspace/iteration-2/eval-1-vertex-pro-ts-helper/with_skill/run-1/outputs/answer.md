I don't have write permission here (and `/private/tmp` isn't your app anyway), so here's the helper to drop into your project — e.g. `lib/nano-banana.ts`:

```ts
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs/promises";

/**
 * Nano Banana Pro (Gemini 3 Pro Image) on Vertex AI.
 *
 * Server-only: uses `node:fs` and Application Default Credentials, so it must run in a
 * Next.js Route Handler, Server Action, or server component — never a client component.
 *
 * Auth (Vertex uses Google Cloud ADC, NOT a Gemini API key):
 *   - Local dev:  gcloud auth application-default login
 *   - Server/CI:  a service account with the "Vertex AI User" role, via
 *                 GOOGLE_APPLICATION_CREDENTIALS or the runtime's attached identity
 *                 (Cloud Run, GKE Workload Identity, etc.).
 */

// Nano Banana Pro. The GA target ID is the bare `gemini-3-pro-image`.
// NOTE: Vertex model pages may still resolve the `-preview` ID for some projects —
// if a call 404s on the model, switch this to "gemini-3-pro-image-preview".
const NANO_BANANA_PRO = "gemini-3-pro-image";

const ai = new GoogleGenAI({
  vertexai: true,
  project: "acme-prod",
  // Model availability is listed as "global"; use a region (e.g. "us-central1")
  // only if your project requires it.
  location: "global",
});

/**
 * Generate a 2K, 16:9 image from a text prompt with Nano Banana Pro and save it as a PNG.
 *
 * @param prompt   The text prompt describing the image.
 * @param outPath  Destination file path for the PNG (e.g. "./out.png").
 * @returns        The path the PNG was written to.
 */
export async function generateImage(prompt: string, outPath: string): Promise<string> {
  let response;
  try {
    response = await ai.models.generateContent({
      model: NANO_BANANA_PRO,
      contents: prompt,
      config: {
        responseModalities: ["IMAGE"],
        // Size/ratio live on imageConfig (flat — no nested `image` wrapper, and
        // NOT `responseFormat`, which the @google/genai SDK silently ignores).
        // "2K" — uppercase K is required; 16:9 is one of Pro's 10 standard ratios.
        imageConfig: { aspectRatio: "16:9", imageSize: "2K" },
      },
    });
  } catch (err) {
    // On Vertex, filtered input can come back as an HTTP 400 rather than a refusal part.
    throw new Error(
      `Nano Banana Pro request failed (input may have been safety-filtered): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  // A blocked prompt or filtered output yields a candidate with no image part.
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);

  if (!imagePart?.inlineData?.data) {
    const finishReason = response.candidates?.[0]?.finishReason;
    throw new Error(
      `No image returned${finishReason ? ` (finishReason: ${finishReason})` : ""}. ` +
        `The prompt or output was likely safety-filtered.`,
    );
  }

  // Image bytes are base64 inline data — never a URL.
  await fs.writeFile(outPath, Buffer.from(imagePart.inlineData.data, "base64"));
  return outPath;
}
```

**The specifics you asked for:**

- **Model ID:** `gemini-3-pro-image` (Nano Banana Pro). This is the GA ID. Heads-up for Vertex specifically: its model reference pages still list the `-preview` ID (`gemini-3-pro-image-preview`) for some projects, so if you get a 404 on the model, flip the constant — that's why I isolated it at the top.
- **Vertex client:** `new GoogleGenAI({ vertexai: true, project: "acme-prod", location: "global" })`. No API key — Vertex authenticates with Google Cloud ADC. Locally, run `gcloud auth application-default login`; on a server, use a service account with the **Vertex AI User** role.
- **2K + 16:9:** set on `config.imageConfig = { aspectRatio: "16:9", imageSize: "2K" }`. Two easy traps avoided here: it's `imageConfig`, **not** `responseFormat` (that field doesn't exist in the shipped SDK and is silently ignored, leaving you with a default 1K image); and `imageSize` must be `"2K"` with an uppercase K. 2K and 16:9 are both fully supported on Pro.

**A few notes for wiring it in:**

- Install the SDK: `npm i @google/genai`.
- Keep this module server-side (it imports `node:fs` and uses cloud creds). Don't import it from a `"use client"` component.
- Every returned image carries an invisible **SynthID** watermark (no API flag disables it); on Vertex, output is also tagged with **C2PA Content Credentials**.
- Per-image cost at 2K on Pro is about **$0.134** — verify against the Vertex (Gemini Enterprise Agent Platform) pricing page, since Vertex pricing can differ from the Developer-API figures.

Example call from a Route Handler:

```ts
import { generateImage } from "@/lib/nano-banana";

const path = await generateImage(
  "A photorealistic ceramic mug on a sunlit oak table, steam rising",
  "./public/generated/mug.png",
);
```