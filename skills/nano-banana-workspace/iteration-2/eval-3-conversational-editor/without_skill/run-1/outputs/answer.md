I wasn't able to reach the live docs (web permissions were declined this session), so the specifics below are from my own knowledge — double-check the model name and image-count guidance against the current Gemini docs, since this API moves fast. The code patterns themselves are stable.

## Short answers

**Keeping image context across turns:** Use a **chat session** (`ai.chats.create`). The SDK keeps the full history — including the *images the model returns* (they come back as `inlineData` parts) — so each follow-up tweak is conditioned on the previous result automatically. The alternative is to hold the `contents[]` array yourself and append the model's returned image part back into history each turn.

**Reference images per request:** The model accepts multiple input images, but Google's guidance for Gemini 2.5 Flash Image is **up to 3 reference images for best results** (e.g. product + background + style). It can technically ingest more (bounded by the context/token budget), but instruction-following degrades past ~3.

## Setup

```js
// npm i @google/genai
import { GoogleGenAI, Modality } from '@google/genai';
import * as fs from 'node:fs';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// "nano banana" — the native image gen/edit model. (Was ...-image-preview pre-GA.)
const MODEL = 'gemini-2.5-flash-image';

// --- helpers ---
const fileToPart = (path, mimeType) => ({
  inlineData: { mimeType, data: fs.readFileSync(path).toString('base64') },
});

function extractImage(response) {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((p) => p.inlineData);
  return img?.inlineData ?? null; // { mimeType, data(base64) }
}

const saveImage = (inlineData, path) =>
  fs.writeFileSync(path, Buffer.from(inlineData.data, 'base64'));
```

## Primary approach — chat session keeps image context for you

```js
const chat = ai.chats.create({
  model: MODEL,
  // Optional for the image model, but lets it return image + a short text rationale.
  config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
});

// Turn 1: user uploads the product photo.
let res = await chat.sendMessage({
  message: [
    fileToPart('product.jpg', 'image/jpeg'),
    { text: 'This is my product. Keep the product itself identical across all edits.' },
  ],
});
saveImage(extractImage(res), 'turn0.png');

// Turn 2: a follow-up tweak — no need to resend the image.
res = await chat.sendMessage({ message: 'Make the background pure white.' });
saveImage(extractImage(res), 'turn1.png');

// Turn 3: another tweak, conditioned on the white-bg result.
res = await chat.sendMessage({ message: 'Add a soft drop shadow under the product.' });
saveImage(extractImage(res), 'turn2.png');
```

Because the returned image is stored in the chat history as a `model` turn, "add a shadow" operates on the white-background version — context is preserved end-to-end. This is also what makes relative edits ("a bit lighter than that", "undo the shadow, make it harder") work.

## Alternative — manage history manually (control + cost)

Use this when you want to prune history (long edit chains get expensive — every image in history is re-tokenized each call):

```js
const contents = [];

async function edit(userParts) {
  contents.push({ role: 'user', parts: userParts });
  const res = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
  });
  // The returned content already has role:'model' and includes the image part —
  // pushing it back is what carries the visual context forward.
  contents.push(res.candidates[0].content);
  return extractImage(res);
}

saveImage(await edit([fileToPart('product.jpg', 'image/jpeg'), { text: 'make the background white' }]), 's0.png');
saveImage(await edit([{ text: 'add a soft shadow' }]), 's1.png');
```

**Cost-saving variant:** instead of accumulating all turns, keep only the *latest generated image* and resend `[latestImage, newInstruction]` each turn. You lose conversational back-reference ("like the previous one") but keep token cost flat regardless of edit-chain length.

## Multiple reference images in one request

```js
const res = await ai.models.generateContent({
  model: MODEL,
  contents: [{
    role: 'user',
    parts: [
      fileToPart('product.jpg', 'image/jpeg'),     // 1
      fileToPart('background.jpg', 'image/jpeg'),   // 2
      fileToPart('style-ref.jpg', 'image/jpeg'),    // 3  ← keep it to ~3
      { text: 'Place the product from image 1 onto the background in image 2, ' +
              'matching the lighting and color grade of image 3.' },
    ],
  }],
  config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
});
saveImage(extractImage(res), 'composite.png');
```

## Practical tips

- **Reference images by position** in your prompt ("the product in image 1") — it disambiguates far better than relying on order alone.
- **Pin the subject** on turn 1 ("keep the product identical") so iterative edits don't drift the product's shape/label.
- **Output images** are PNG-ish `inlineData`; check `mimeType` rather than assuming. For files >~20 MB total, upload via the **Files API** and reference by URI instead of inlining base64.
- **Watch token growth** in long sessions — prune history or fall back to the "latest image only" pattern.

Want me to wrap this into a small Express/Next.js endpoint (multipart upload → session-keyed chat → returns the edited image), or add streaming?