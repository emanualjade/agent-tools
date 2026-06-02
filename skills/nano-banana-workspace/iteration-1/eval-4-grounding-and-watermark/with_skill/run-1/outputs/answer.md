## 1. Weather-accurate images — yes, via Google Search grounding

You can, and you'll need it: both models have a **January 2025 knowledge cutoff**, so neither knows today's (2026-06-02) forecast on its own. The mechanism is **Web Search grounding** — add the `googleSearch` tool to your request config and the model pulls real-time facts (weather, stock charts, recent events) into the image.

**Which model:** either works — Web Search grounding is supported on **both** Nano Banana 2 (`gemini-3.1-flash-image`) and Nano Banana Pro (`gemini-3-pro-image`). Pick based on the usual tradeoff:

- **Nano Banana 2 (Flash)** — your default. Cheaper (~½ the price), faster, fine for a typical weather card/widget.
- **Nano Banana Pro** — reach for it if the image is text-heavy (a polished forecast infographic with multilingual or dense labels), where its best-in-class text rendering pays off.

One Vertex caveat (your default platform): Web Search grounding for Nano Banana 2 was announced as "coming soon to Vertex AI" — it's GA on the Gemini Developer API, and Nano Banana Pro grounding is available on Vertex. So **confirm Flash grounding is live on Vertex** before relying on it; if it isn't yet, use Pro on Vertex or switch to the Developer API.

```ts
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";

// Vertex (your default). For the Gemini Developer API use: new GoogleGenAI({})
const ai = new GoogleGenAI({
  vertexai: true,
  project: "your-gcp-project-id",
  location: "global",
});

const CITY = "Chicago";

const response = await ai.models.generateContent({
  model: "gemini-3.1-flash-image", // or "gemini-3-pro-image" for richer text/infographics
  contents:
    `Design a clean weather card for ${CITY} today. Look up the current ` +
    `forecast and show the high/low temperature, conditions, and an icon ` +
    `that matches the actual weather.`,
  config: {
    responseModalities: ["TEXT", "IMAGE"],
    tools: [{ googleSearch: {} }],              // <-- enables real-time grounding
    responseFormat: { image: { aspectRatio: "4:5", imageSize: "2K" } },
  },
});

// Always handle the no-image case (safety filter / blocked prompt returns a part with no inlineData)
for (const part of response.candidates[0].content.parts) {
  if (part.inlineData) {
    fs.writeFileSync("weather.png", Buffer.from(part.inlineData.data, "base64"));
  } else if (part.text) {
    console.log(part.text);
  }
}
```

Notes:
- `imageSize` values are literal — `"1K"`/`"2K"`/`"4K"` with an **uppercase K**, or `"512"` (Flash only) with no K.
- With **Web Search** grounding, image-based search results are *not* passed to or returned by the model. (There's a separate **Image Search** grounding mode that *is* Flash-only and returns sources — but for weather text/facts, Web Search is what you want.)

## 2. Watermark — yes on every image, and no, you can't disable it

**Every generated and edited image carries an invisible [SynthID](https://ai.google.dev/responsible/docs/safeguards/synthid) watermark, and there is no API flag to turn it off.** It survives cropping, filters, and lossy compression; you can detect it by uploading the image to Gemini or the SynthID Detector.

A few clarifications on what is and isn't a watermark:

- **Invisible SynthID** → always present, not removable. This is the one that matters for your question.
- **Visible "Gemini sparkle" mark** → that's a *consumer Gemini app* policy (kept on Free/Google AI Pro, removed for Ultra and in AI Studio), **not** an API behavior. Images you generate through the API/SDK don't get the visible sparkle.
- **On Vertex** (your default), enterprise output is *additionally* tagged with **C2PA Content Credentials** (interoperable provenance metadata) — again, no documented flag disables it.

So: provenance marking is baked in by design and there's no opt-out via the API.