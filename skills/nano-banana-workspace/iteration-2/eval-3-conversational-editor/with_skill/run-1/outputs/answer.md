Great use case — this is exactly what the chat (multi-turn) API is built for. Here are the two direct answers, then production-ready code.

## The two answers up front

**Keeping image context across turns:** Use `ai.chats.create(...)` instead of one-shot `generateContent`. The chat session retains the full content history — including the image parts returned by the model — so each follow-up like *"make the background white"* refines the previous result rather than starting over. You send the product photo once in the first message; after that you send plain-text tweaks.

**Reference images per request:** **Up to 14 total.** The breakdown depends on the model:
- **Nano Banana 2** (`gemini-3.1-flash-image`): ≤10 objects + ≤4 characters
- **Nano Banana Pro** (`gemini-3-pro-image`): ≤6 objects + ≤5 characters

For a product editor you'll usually send **one** photo in the opening turn, but you can fuse multiple references (e.g. product + a backdrop swatch + a logo) up to that 14 limit.

**Model choice:** Default to **Nano Banana 2 (Flash)** — it's ~2× cheaper, faster, and white-background/soft-shadow edits are squarely in its wheelhouse. Reach for Pro only if you need dense text rendering or studio-grade lighting/camera control on a hero shot.

## The code

```ts
// editor.ts — conversational product-photo editor on the Gemini Developer API
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
import * as path from "node:path";

// Reads GEMINI_API_KEY (or GOOGLE_API_KEY) from the environment.
// Keep the key server-side — it carries your billing tier.
const ai = new GoogleGenAI({});

const MODEL = "gemini-3.1-flash-image"; // Nano Banana 2. Swap to "gemini-3-pro-image" for max quality.

/**
 * Pulls the first image out of a model response and writes it to disk.
 * Returns null if the model returned no image — which happens when a prompt
 * or output is filtered for safety, so callers MUST handle it.
 */
function saveFirstImage(response: any, outPath: string): string | null {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData) {
      // Image bytes are base64 — never a URL.
      fs.writeFileSync(outPath, Buffer.from(part.inlineData.data, "base64"));
      return outPath;
    }
    if (part.text) console.log("model:", part.text);
  }
  const reason = response.candidates?.[0]?.finishReason;
  console.warn(`No image returned${reason ? ` (finishReason: ${reason})` : ""}.`);
  return null;
}

function inlineImage(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
  return { inlineData: { mimeType, data: fs.readFileSync(filePath).toString("base64") } };
}

export class ProductPhotoEditor {
  private chat;
  private turn = 0;

  constructor() {
    // One chat session = one conversation. It holds the image context for us,
    // so follow-up turns only need text.
    this.chat = ai.chats.create({
      model: MODEL,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio: "1:1", imageSize: "2K" }, // size/ratio live here — NOT responseFormat
      },
    });
  }

  /**
   * Opening turn: upload the product photo plus an initial instruction.
   * You can pass extra reference images here too (backdrop, logo, etc.) —
   * up to 14 inlineData parts total for Flash (≤10 objects + ≤4 characters).
   */
  async start(productPhotoPath: string, instruction: string, extraRefs: string[] = []) {
    const response = await this.chat.sendMessage({
      message: [
        { text: instruction },
        inlineImage(productPhotoPath),
        ...extraRefs.map(inlineImage), // additional references, optional
      ],
    });
    return saveFirstImage(response, `edit-${this.turn++}.png`);
  }

  /**
   * Follow-up tweak: just text. The chat already remembers the latest image,
   * so "make the background white" edits the previous result.
   */
  async tweak(instruction: string) {
    const response = await this.chat.sendMessage({ message: instruction });
    return saveFirstImage(response, `edit-${this.turn++}.png`);
  }
}

// --- usage ---
async function main() {
  const editor = new ProductPhotoEditor();

  await editor.start(
    "product.jpg",
    "Use this exact product. Place it on a clean studio background. Change nothing about the product itself."
  );

  await editor.tweak("Make the background pure white.");
  await editor.tweak("Add a soft, realistic drop shadow beneath the product.");
  await editor.tweak("Warm up the lighting slightly. Keep everything else the same.");
}

main().catch(console.error);
```

## Things worth flagging

- **The `imageConfig` gotcha:** aspect ratio and size go in `config.imageConfig`, **not** a `responseFormat` field. The docs' code samples show `responseFormat` but it doesn't exist in the shipped SDK — pass it and you'll silently get a default 1K image instead of what you asked for.
- **You can override size/ratio per turn** — pass `config: { imageConfig: {...} }` to an individual `sendMessage` call (e.g. render a final 4K version on the last tweak).
- **Always handle the no-image case.** A filtered prompt/output returns a part with no `inlineData` (and often a `finishReason` like `IMAGE_SAFETY`) — that's why `saveFirstImage` returns `null` rather than assuming success.
- **Large or reused images:** if your product photos are big, upload once via the Files API (`ai.files.upload(...)` → `createPartFromUri(f.uri, f.mimeType)`) instead of inlining base64 every turn — though in a chat you only send the photo once anyway, so inline is usually fine here.
- **SynthID:** every output carries an invisible SynthID watermark; there's no flag to disable it. Good to know if your pipeline does any downstream hashing/dedup.

Want me to adapt this for **Vertex AI** (different client/auth) instead of the API-key path, or wire it into an Express/Next.js endpoint that streams edits back to a browser?