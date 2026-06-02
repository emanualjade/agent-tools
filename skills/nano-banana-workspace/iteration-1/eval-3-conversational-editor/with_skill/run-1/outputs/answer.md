For this use case you want **conversational (multi-turn) editing**, and you're on the **Gemini Developer API** (API-key), so the client reads `GEMINI_API_KEY` from the env. Two direct answers first, then the code.

### Keeping image context across turns
Use `ai.chats.create(...)` instead of one-shot `generateContent`. The returned `chat` object holds the running conversation — including the images the model produced — so each follow-up like *"add a soft shadow"* refines the **previous result** automatically. You send the product photo **once, on the first turn**; every later turn is just text. This is the recommended way to iterate.

### How many reference images per request
Up to **14 reference images total** in a single request, for both models — but the object/character split differs:

| Model | Total | Breakdown |
|---|---|---|
| **Nano Banana 2** — `gemini-3.1-flash-image` | 14 | ≤10 objects + ≤4 characters |
| **Nano Banana Pro** — `gemini-3-pro-image` | 14 | ≤6 objects + ≤5 characters |

A single-product editor only sends 1, but you can fuse up to 14 (e.g. product + several backdrops/props). I've defaulted to **Nano Banana 2 (Flash)** below — it's ~2× cheaper, faster, and the right fit for app-facing, high-volume editing. Swap the one model constant to `gemini-3-pro-image` if you need studio-grade text/lighting.

### Code

```ts
import { GoogleGenAI, type Chat } from "@google/genai";
import * as fs from "node:fs";
import * as path from "node:path";

// Reads GEMINI_API_KEY (or GOOGLE_API_KEY) from the environment. Keep the key server-side.
const ai = new GoogleGenAI({});

// Nano Banana 2 — fast, cheap, app-facing. Use "gemini-3-pro-image" for max-quality / dense text.
const EDITOR_MODEL = "gemini-3.1-flash-image";

type TurnResult = {
  image: Buffer | null;   // null when nothing was returned (e.g. safety-filtered)
  text: string;
  finishReason?: string;  // e.g. "IMAGE_SAFETY" / "IMAGE_PROHIBITED_CONTENT"
};

function mimeFromPath(p: string): string {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

/** Always-defensive response reader: image output is base64 inlineData, never a URL. */
function readTurn(response: any): TurnResult {
  const candidate = response?.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  let image: Buffer | null = null;
  let text = "";
  for (const part of parts) {
    if (part.inlineData) {
      image = Buffer.from(part.inlineData.data, "base64");
    } else if (part.text) {
      text += part.text;
    }
  }
  return { image, text, finishReason: candidate?.finishReason };
}

/** One editing session === one chat. The chat object IS the persisted image context. */
export function startEditorSession(): Chat {
  return ai.chats.create({
    model: EDITOR_MODEL,
    config: {
      // Model returns text + image by default; ["IMAGE"] for image-only.
      responseModalities: ["TEXT", "IMAGE"],
      // JS/TS field is responseFormat.image — NOT imageConfig (that's Java/Go only).
      // K must be uppercase; Flash also supports "512". Default is "1K".
      responseFormat: { image: { imageSize: "2K" } },
    },
  });
}

/**
 * First turn: send the product photo + an instruction. Send images ONLY here —
 * the chat retains them, so follow-up turns are text-only.
 * Up to 14 reference images (Flash: ≤10 objects + ≤4 characters) — add more inlineData parts.
 */
export async function loadProduct(
  chat: Chat,
  imagePaths: string[],
  instruction = "This is the product to edit. Keep the product itself unchanged unless I ask otherwise.",
): Promise<TurnResult> {
  if (imagePaths.length > 14) {
    throw new Error(`Max 14 reference images per request; got ${imagePaths.length}.`);
  }
  const imageParts = imagePaths.map((p) => ({
    inlineData: { mimeType: mimeFromPath(p), data: fs.readFileSync(p).toString("base64") },
  }));
  const response = await chat.sendMessage({
    message: [{ text: instruction }, ...imageParts],
  });
  return readTurn(response);
}

/** Every follow-up tweak: text only. The chat already holds the latest image. */
export async function tweak(
  chat: Chat,
  instruction: string,
  // Optional per-turn override of size/ratio.
  imageOptions?: { imageSize?: "512" | "1K" | "2K" | "4K"; aspectRatio?: string },
): Promise<TurnResult> {
  const response = await chat.sendMessage({
    message: instruction,
    ...(imageOptions ? { config: { responseFormat: { image: imageOptions } } } : {}),
  });
  return readTurn(response);
}

// ---- Example session -------------------------------------------------------

async function main() {
  const chat = startEditorSession();

  // Turn 1 — upload the product photo.
  let result = await loadProduct(chat, ["product.png"]);
  save(result, "step-0.png");

  // Turn 2+ — conversational tweaks; context carries over automatically.
  result = await tweak(chat, "Make the background pure white. Change nothing about the product.");
  save(result, "step-1.png");

  result = await tweak(chat, "Add a soft, realistic drop shadow beneath the product.");
  save(result, "step-2.png");
}

function save(result: TurnResult, outPath: string) {
  if (!result.image) {
    // Safety filter or refusal — there's no image part. Handle it; don't assume success.
    console.warn(`No image returned (finishReason: ${result.finishReason ?? "unknown"}). ${result.text}`);
    return;
  }
  fs.writeFileSync(outPath, result.image);
  if (result.text) console.log(result.text);
}

main().catch(console.error);
```

### Things worth knowing

- **Don't re-send the photo each turn.** The chat keeps it. Re-uploading wastes input tokens (input images tokenize at 258 tok if ≤384px on both sides, otherwise tiled into 768×768 tiles at 258 tok each) and can confuse the edit.
- **Large or reused photos:** instead of inline base64, upload once via the Files API — `const f = await ai.files.upload({ file: "product.png" })` — and build the part with `createPartFromUri(f.uri, f.mimeType)`. Better for big inputs.
- **Always handle the no-image case.** A blocked prompt/output returns a part with no `inlineData` (and possibly a safety `finishReason` like `IMAGE_SAFETY`). The `readTurn`/`save` guards above cover it.
- **Per-turn size/ratio:** you can override `responseFormat.image` on any `tweak()` call (e.g. render a final `"4K"`). Note `imageSize` uses an uppercase `K` (`"1K"`, not `"1k"`), and `"512"` has no `K` and is **Flash-only**.
- **Watermark:** every generated/edited image carries an invisible **SynthID** watermark — no API flag disables it.
- **Cost (Flash, standard paid tier):** ~$0.067 per 1K image, $0.101 at 2K, $0.151 at 4K — so each tweak turn that emits an image is billed as an output image. No free tier on the Gemini 3 image models.

If you'd rather use Vertex AI later, only the client constructor changes (`new GoogleGenAI({ vertexai: true, project, location })` + ADC auth) — every call shape above stays identical.