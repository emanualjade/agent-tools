I wasn't able to reach live docs (web search/fetch weren't permitted this turn), so this is from my knowledge as of my January 2026 cutoff — which does cover both Nano Banana and Nano Banana Pro. Google has been adjusting the watermark policy, so I'd confirm the visible-watermark specifics against current docs before relying on them. I can verify live if you grant web access.

Quick terminology: "Nano Banana" is Google's nickname for **Gemini 2.5 Flash Image**, and "Nano Banana Pro" is **Gemini 3 Pro Image**.

## 1. Baking in today's actual weather forecast

**Yes — but only with Nano Banana Pro (Gemini 3 Pro Image), not the base Nano Banana.**

The feature you need is **Google Search grounding**. Nano Banana Pro can call Google Search as a tool during generation, pull real-time real-world data (weather, scores, prices, recent events), and render it accurately into the image — e.g. a weather infographic with today's real numbers. Base Nano Banana (2.5 Flash Image) doesn't ground image generation this way; it would just invent plausible-looking weather.

- **Model ID:** `gemini-3-pro-image-preview`
- **How to enable:** pass the `google_search` tool in your request config.

```python
from google import genai
from google.genai import types

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents="Create a clean infographic of today's weather forecast for Tokyo, "
             "including current temperature, high/low, and conditions.",
    config=types.GenerateContentConfig(
        tools=[types.Tool(google_search=types.GoogleSearch())],
        response_modalities=["TEXT", "IMAGE"],
    ),
)
```

Notes: grounded requests are billed for search usage, and you're expected to honor the grounding/citation display requirements. Accuracy of rendered text/numbers is much better on Pro, but always sanity-check generated figures.

## 2. Watermarks

There are **two** different watermarks — keep them separate:

- **SynthID (invisible):** Embedded in *every* image from Gemini image models. **Always on, cannot be disabled** — no API flag for it. It's part of Google's responsible-AI policy. This is true for both Nano Banana and Nano Banana Pro across all tiers.

- **Visible watermark (the small Gemini "sparkle" logo):** This is tier/product dependent, not a per-request toggle.
  - Base Nano Banana (2.5 Flash Image) via the **API** generally returns images with SynthID only — no visible logo.
  - Nano Banana Pro: free/consumer-tier outputs typically carry the visible logo; **paid API tier** outputs come without the visible logo (but still with SynthID).

So: **you cannot remove SynthID**, and the visible watermark isn't a switch — you avoid it by using the paid API tier rather than free/consumer surfaces. This is exactly the area Google has been changing, so verify against current docs/pricing for your tier.

Want me to retry the live doc lookup (`ai.google.dev/gemini-api/docs/image-generation`) to confirm the current visible-watermark-per-tier behavior and exact model IDs? I just need web access granted.