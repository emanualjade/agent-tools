Short answer: **Flash for thumbnails, Pro for the text-heavy banners**, and **yes — you can render thumbnails at 512px, but only on Flash.** Details below.

## Thumbnails → Nano Banana 2 (Flash), `gemini-3.1-flash-image`

This is exactly what Flash is built for: high volume, cost-sensitive, fast. It's also the **only** model that supports 512px output — Nano Banana Pro tops out at 1K/2K/4K and has no 512 option. So your money-saving plan works, and it requires Flash anyway.

A few mechanics worth knowing:
- The literal value is `"512"` (no `K`) in `responseFormat.image.imageSize`. The other sizes use an **uppercase** `K` (`"1K"`, `"2K"`, `"4K"`).
- If you'd rather trade a little quality for speed at this volume, Flash exposes a `thinkingLevel` knob (`minimal` default / `high`) — leave it at `minimal` for thumbnails.

**Cost at 50,000/month** (Gemini Developer API list price, image output only):

| Size | Per image | × 50,000/mo |
|---|---|---|
| **512** | $0.045 | **$2,250** |
| 1K | $0.067 | $3,350 |

So going 512px instead of 1K saves you ~**$1,100/month**. Easy win if 512px is visually fine for a thumbnail.

## Hero banners with lots of text → Nano Banana Pro, `gemini-3-pro-image`

Text rendering is precisely where Pro pulls ahead — the docs call it "best-in-class: high-fidelity, multilingual, long text," versus Flash's merely "reliable legible text." For a few hundred hero banners where the text *is* the point, the quality difference is worth Pro's higher price, and at this low volume the absolute cost is trivial.

**Cost for "a few hundred" banners** (Pro, image output only):

| Size | Per image | × 300 | × 500 |
|---|---|---|---|
| 1K / 2K | $0.134 | ~$40 | ~$67 |
| 4K | $0.24 | ~$72 | ~$120 |

⚠️ **One caveat to check before you commit to Pro for banners:** Pro does **not** support the extreme wide aspect ratios `1:4 / 4:1 / 1:8 / 8:1` — those are Flash-only. Pro does handle `16:9` and `21:9`, which covers most hero banners. But if your banners are very wide letterbox strips (e.g. 8:1), you'd be stuck choosing between Pro's text quality and Flash's aspect ratio. If you need both, a common workaround is to generate the wide canvas and compose text separately, or test whether 21:9 is wide enough.

Also note **4K is still flagged preview** at GA (1K/2K are GA) — fine to use, just be aware it could change.

## Bottom line

- **Thumbnails:** Flash at 512px → **~$2,250/month** for 50K.
- **Banners:** Pro at 2K → **~$40–70/month** for a few hundred.
- **Combined: roughly $2,300/month**, dominated almost entirely by thumbnail volume.

Two things that could move these numbers:
1. **Input images aren't free.** If you generate thumbnails by editing existing product photos (rather than pure text-to-image), each reference image adds input tokens (258 tokens if ≤384px, otherwise tiled into 768×768 tiles at 258 each, billed at $0.50/1M for Flash). It's small per image but at 50K/month it adds up to a modest line item — worth modeling if you're editing photos.
2. **Platform.** The figures above are **Gemini Developer API** list prices. The skill's default platform is **Vertex AI**, where per-image pricing isn't assumed to match — if you're on Vertex, confirm on the Vertex/Gemini Enterprise Agent Platform pricing page before locking in a budget. Note there's **no free tier** on either Gemini 3 image model regardless of platform.

Want me to write the actual generation calls (`@google/genai`) for both paths, or a quick cost-estimator script you can plug your real volumes into?