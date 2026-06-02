## Model choice

| Use case | Model | Why |
|---|---|---|
| **50K product thumbnails/mo** | **Nano Banana 2 (Flash)** — `gemini-3.1-flash-image` | High-volume, cost-sensitive, fast. ~2× cheaper than Pro, and it's the *only* model that supports 512px. |
| **A few hundred text-heavy hero banners** | **Nano Banana Pro** — `gemini-3-pro-image` | Best-in-class text rendering (dense/multilingual/long text), plus reasoning for complex layouts and studio-grade control. This is exactly the case where Pro earns its premium. |

## Can you do thumbnails at 512px? Yes.

`512` is a valid `imageSize` **on Flash only** (Pro starts at 1K), so your thumbnail pipeline gets it for free by being on Flash. Note the literal value is the string `"512"` — **no `K`** (and the others are uppercase: `"1K"`, `"2K"`, `"4K"`).

It's a real saving: **$0.045 at 512px vs $0.067 at the 1K default** = ~$0.022/image. Across 50K/mo that's **~$1,100/month saved** by dropping from 1K to 512.

## Rough monthly cost

These are the documented **Gemini Developer API** per-image (output) prices.

**Thumbnails — Flash @ 512px:**
- 50,000 × **$0.045** ≈ **$2,250/month**
- (for comparison, at 1K default: 50,000 × $0.067 ≈ $3,350/month)

**Hero banners — Pro** (assuming ~300; for text-heavy work 2K is plenty and is GA):
- @ 2K: 300 × **$0.134** ≈ **$40/month**
- @ 4K: 300 × **$0.24** ≈ **$72/month** *(note: 4K is still flagged preview/rolling out — 2K is the safe GA choice and usually sharp enough for banner text)*

**Total ≈ $2,290–$2,320/month**, almost entirely the thumbnails.

If "a few hundred" really means 200–500 banners, that line scales to roughly **$27–$67 (2K)** or **$48–$120 (4K)** — still a rounding error next to the thumbnail volume.

## Caveats worth knowing

- **These are output-image prices only.** Both are *thinking* models (reasoning can't be disabled), so each request also bills a small amount of text+thinking output (Flash $3/1M, Pro $12/1M tokens) plus input — text prompts are negligible, but if you **edit** with reference images, each input image tokenizes (258 tokens if ≤384px per side, else tiled into 768×768 tiles at 258 tokens each). For pure text-to-image these add little; budget a few % on top.
- **No free tier** on either Gemini 3 image model.
- **If you're on Vertex AI** (the default integration path), don't quote these numbers as-is — Vertex pricing can differ; confirm on the Gemini Enterprise Agent Platform pricing page.
- Every image carries an invisible **SynthID watermark** (no opt-out) — fine for product imagery, just be aware.

**Bottom line:** Flash @ 512 for thumbnails, Pro @ 2K for the text-heavy banners. ~$2.3K/month total, and yes — 512px is exactly the right lever to pull on the thumbnails, worth ~$1.1K/month versus the 1K default.