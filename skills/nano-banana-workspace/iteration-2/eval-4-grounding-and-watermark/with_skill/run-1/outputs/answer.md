## (1) Weather-grounded images — yes, via Google Search grounding

You can bake in today's real forecast. These are *thinking* models with a **Web Search grounding** tool — you turn it on and the model pulls live facts (weather, stock charts, recent events) into the render. You enable it by adding `tools: [{ googleSearch: {} }]` to the request `config`.

**Which model:** Web Search grounding works on **both** Nano Banana 2 (`gemini-3.1-flash-image`) and Nano Banana Pro (`gemini-3-pro-image`), so the model choice is about quality, not capability. Two things push the decision:

- A weather card is essentially an **infographic with dense, legible text** (temps, day labels, maybe multilingual) — that's exactly Pro's strength (best-in-class text rendering). For a polished weather widget I'd reach for **`gemini-3-pro-image`**.
- **Platform caveat (you default to Vertex):** Web Search grounding for **Flash (Nano Banana 2) was "coming soon" to Vertex** at the enterprise launch — confirm it's actually live on your project before relying on it. **Pro's** Search grounding *is* available on Vertex, and **both** are GA for grounding on the Gemini Developer API. So on Vertex, Pro is the safe pick today.

Here's a production-shaped Vertex call. Note `imageConfig` (not `responseFormat`) for size/ratio, and always handle the part-with-no-image case (a blocked prompt returns no `inlineData`):

```ts
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";

// Vertex client (ADC auth — `gcloud auth application-default login` locally,
// or a Vertex AI User service account in CI). On the Developer API instead:
// const ai = new GoogleGenAI({}); // reads GEMINI_API_KEY
const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT!,
  location: "global",
});

async function generateWeatherCard(city: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-image", // Pro: best text rendering + Search grounding GA on Vertex
    contents:
      `Design a clean weather card for ${city} for today. ` +
      `Use the current, real forecast: high/low temperature, conditions, ` +
      `and a 3-day outlook. Make all text crisp and legible.`,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      tools: [{ googleSearch: {} }], // <-- enables live Web Search grounding (the weather)
      imageConfig: { aspectRatio: "4:5", imageSize: "2K" },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  let saved = false;
  for (const part of parts) {
    if (part.inlineData) {
      // image bytes are base64, never a URL
      fs.writeFileSync(`weather-${city}.png`, Buffer.from(part.inlineData.data, "base64"));
      saved = true;
    } else if (part.text) {
      console.log(part.text);
    }
  }
  // Blocked/filtered prompts come back with no inlineData (and on Vertex, filtered
  // input can be an HTTP 400) — don't assume an image is always present.
  if (!saved) throw new Error("No image returned — likely a safety filter or grounding miss.");
}
```

Two notes:
- Accuracy depends on the search results the model retrieves at request time — prompt it to use the *current, real* forecast (as above) rather than assuming it knows.
- With **Web Search** grounding, image-based search results aren't returned. (There's a separate **Image Search** grounding that *is* Flash-only and requires you to display source links — but you don't need it for weather; plain Web Search is the right tool here.)

## (2) Watermark — yes on every image, and no, you can't disable it

**Every generated *and edited* image carries an invisible [SynthID](https://ai.google.dev/responsible/docs/safeguards/synthid) watermark, and there is no API flag to turn it off.** It survives cropping, filters, and lossy compression; you detect it by uploading the image to Gemini or the SynthID Detector. On **Vertex**, enterprise output is *additionally* tagged with **C2PA Content Credentials** (provenance metadata) — also not disable-able.

The thing youcan avoid is the **visible "Gemini sparkle"** badge — but that's only a *consumer Gemini app* policy, **not an API behavior**. Images you generate through the API/SDK (Vertex or Developer API) don't get the visible sparkle in the first place; the invisible SynthID is the part that's always present and non-removable.

So: invisible SynthID is mandatory on all API output; visible badge isn't an API concern.