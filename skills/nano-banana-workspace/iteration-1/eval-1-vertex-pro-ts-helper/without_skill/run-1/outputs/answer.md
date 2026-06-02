Web access isn't permitted in this session, so I'll write this from my own knowledge — I'll flag the one detail worth double-checking against current docs at the end.

Here's the helper. "Nano Banana Pro" is Google's branding for the **Gemini 3 Pro Image** model; on Vertex its ID is `gemini-3-pro-image-preview`.

```typescript
// lib/generate-image.ts
import { GoogleGenAI } from '@google/genai';
import { writeFile } from 'node:fs/promises';

// "Nano Banana Pro" === Gemini 3 Pro Image
const NANO_BANANA_PRO = 'gemini-3-pro-image-preview';

// Vertex client. Auth uses Application Default Credentials (ADC) — no API key.
// Gemini 3 Pro Image is served from the `global` endpoint, not a regional one.
const ai = new GoogleGenAI({
  vertexai: true,
  project: 'acme-prod',
  location: 'global',
});

/**
 * Generates a 2K, 16:9 image from a text prompt with Nano Banana Pro
 * and writes the PNG to `outputPath`. Returns the path written.
 */
export async function generateImage(
  prompt: string,
  outputPath: string,
): Promise<string> {
  const response = await ai.models.generateContent({
    model: NANO_BANANA_PRO,
    contents: prompt,
    config: {
      responseModalities: ['IMAGE'],
      imageConfig: {
        aspectRatio: '16:9',
        imageSize: '2K', // "1K" | "2K" | "4K" — Nano Banana Pro only
      },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);

  if (!imagePart?.inlineData?.data) {
    // Surface any text the model returned instead (e.g. a safety refusal).
    const text = parts.map((p) => p.text).filter(Boolean).join(' ');
    throw new Error(
      `No image returned from ${NANO_BANANA_PRO}${text ? `: ${text}` : ''}`,
    );
  }

  await writeFile(outputPath, Buffer.from(imagePart.inlineData.data, 'base64'));
  return outputPath;
}
```

Usage:

```typescript
await generateImage('A neon-lit Tokyo alley in the rain', './out/alley.png');
```

A few notes for wiring this into your Next.js app:

- **Auth:** Vertex mode uses ADC, not an API key. Locally run `gcloud auth application-default login`; in production (Cloud Run / GKE / etc.) attach a service account with the **Vertex AI User** role. You can override the project/location via `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION` env vars instead of hardcoding if you prefer.
- **Server-only:** This must run server-side (Route Handler, Server Action, or API route) — never in a client component, since it relies on cloud credentials and Node's `fs`.
- **Output format:** Nano Banana Pro returns PNG by default, so writing the decoded bytes straight to `.png` is correct. The base64 lives in `inlineData.data`; `inlineData.mimeType` will confirm `image/png` if you want to assert it.
- **`imageSize`/`aspectRatio`** live under `config.imageConfig`. `imageSize` supports `1K`/`2K`/`4K` and is specific to Nano Banana Pro (the original `gemini-2.5-flash-image` Nano Banana doesn't take it).

One thing to verify since I couldn't check live docs: `gemini-3-pro-image-preview` is the **preview** model ID. If Google has since promoted it to GA, the ID may have dropped the `-preview` suffix — confirm the current identifier in the Vertex Model Garden before shipping.