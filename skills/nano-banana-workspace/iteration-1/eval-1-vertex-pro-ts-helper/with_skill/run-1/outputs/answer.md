Here's a production-ready helper. The key Vertex-specific bits — the model ID (`gemini-3-pro-image`) and the `vertexai: true` client — are called out inline.

```typescript
// lib/nano-banana.ts
import { GoogleGenAI } from "@google/genai";
import { writeFile } from "node:fs/promises";

/**
 * Nano Banana Pro = Gemini 3 Pro Image.
 * Use the bare GA model ID — NOT the deprecated `-preview` suffix.
 *
 * Vertex caveat: Vertex's model reference pages can still list
 * `gemini-3-pro-image-preview` under a "Preview" banner. The GA target is the
 * bare ID below; if a call 404s on the model, open your project's model page
 * and use the exact ID it shows.
 */
const NANO_BANANA_PRO = "gemini-3-pro-image";

// Vertex AI client. Authenticates with Google Cloud Application Default
// Credentials (ADC) — not a Gemini API key.
//   - Local dev:  gcloud auth application-default login
//   - Server/CI:  a service account with the "Vertex AI User" role
//                 (GOOGLE_APPLICATION_CREDENTIALS or attached runtime identity)
const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT ?? "acme-prod",
  location: process.env.GOOGLE_CLOUD_LOCATION ?? "global", // or a region, e.g. "us-central1"
});

export interface GenerateImageOptions {
  /** The text prompt describing the image. */
  prompt: string;
  /** Absolute or relative path to write the PNG to. */
  outputPath: string;
}

export interface GenerateImageResult {
  outputPath: string;
  /** Any text the model returned alongside the image (often empty). */
  text: string;
}

/**
 * Generates a 2K, 16:9 image with Nano Banana Pro from a text prompt and
 * writes the resulting PNG to disk.
 *
 * @throws if the prompt/output was filtered for safety (no image returned).
 */
export async function generateImage({
  prompt,
  outputPath,
}: GenerateImageOptions): Promise<GenerateImageResult> {
  const response = await ai.models.generateContent({
    model: NANO_BANANA_PRO,
    contents: prompt,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      // In JS/TS the resolution/ratio live under `responseFormat.image`.
      // (`imageConfig` only exists in the Java/Go bindings.)
      // imageSize: uppercase "K" is required ("2k" is rejected).
      responseFormat: { image: { aspectRatio: "16:9", imageSize: "2K" } },
    },
  });

  // A blocked prompt or filtered output comes back with no image part — and on
  // Vertex, filtered *input* can instead surface as an HTTP 400 (thrown above).
  const parts = response.candidates?.[0]?.content?.parts ?? [];

  let imageBytes: Buffer | undefined;
  let text = "";

  for (const part of parts) {
    if (part.inlineData?.data) {
      // Image bytes are base64-encoded — never a URL.
      imageBytes = Buffer.from(part.inlineData.data, "base64");
    } else if (part.text) {
      text += part.text;
    }
  }

  if (!imageBytes) {
    const reason = response.candidates?.[0]?.finishReason;
    throw new Error(
      `No image was generated${reason ? ` (finishReason: ${reason})` : ""}. ` +
        `The prompt or output may have been filtered for safety.`
    );
  }

  await writeFile(outputPath, imageBytes);
  return { outputPath, text };
}
```

Usage:

```typescript
import { generateImage } from "@/lib/nano-banana";

const { outputPath } = await generateImage({
  prompt: "A photorealistic ceramic mug on a sunlit oak table, steam rising",
  outputPath: "./out.png",
});
console.log(`Saved to ${outputPath}`);
```

A few notes specific to your setup:

- **Model ID:** `gemini-3-pro-image` — the bare GA ID. Don't use `gemini-3-pro-image-preview` (deprecated, shutting down 2026‑06‑25), and `nano-banana-pro` is just a nickname, not a callable string.
- **2K + 16:9 are both valid for Pro.** Pro supports 1K/2K/4K (no 512) and the 10 standard ratios including 16:9. Note 2K is GA, but **4K is still flagged preview** if you ever bump the size.
- **Auth is GCP ADC, not an API key.** Run `gcloud auth application-default login` locally; in your Next.js deployment use a service account with the *Vertex AI User* role. Since these are server-side calls, keep `generateImage` in a route handler / server action — never a client component.
- **Every image carries an invisible SynthID watermark** (and C2PA Content Credentials on Vertex); there's no flag to disable it.
- The helper always handles the "no image part" case — on Vertex, filtered *input* may instead throw an HTTP 400 from the `generateContent` call, which will propagate up.

Want me to wrap this in a Next.js route handler or server action as well?