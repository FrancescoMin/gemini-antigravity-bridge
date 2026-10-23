# Official product icons

Retrieved directly from Google on 2026-10-23. Both files are bundled unchanged;
the browser scales the Antigravity PNG to the manifest's 16/48/128 icon sizes.
There are no external icon requests at runtime.

| File | Official source | SHA-256 |
| --- | --- | --- |
| `antigravity-logo.png` | https://www.antigravity.google/assets/image/brand/antigravity-icon__full-color.png ([press assets](https://www.antigravity.google/press)) | `e0cd08ccd10cd8d08ccf0ba449823ee88495825c0841619618100d3ab089f51e` |
| `gemini-logo.png` | https://gemini.google/images/spark_4c.png (icon linked by https://gemini.google/desktop/) | `f39c8b1c0dbdf1411a52b203cd7d2815ef1dc5f899f457499e7d5aa57f25b6c8` |

The product marks remain the property of Google. Their use identifies the
navigation destination and does not imply affiliation or endorsement. They are
third-party assets, not original artwork licensed under this repository's
Apache-2.0 license.

## README images

- `assets/screenshots/gemini-view.png` is a real screenshot supplied by a
  contributor for this README. It is stored at its original 2549 × 1304
  resolution with exactly the same decoded pixels. PNG metadata, including
  software and creation-time fields, was removed without recompressing image
  data. The visible empty start screen shows no account details, personal
  avatar, chat history, or device identifiers.
- `assets/screenshots/antigravity-view.png` is a browser capture of the static
  illustrative UI in `test/readme/index.html?view=antigravity`. All content is
  synthetic, including the generic “Example project” label. It uses the bundled
  official product icon and contains no EXIF or ancillary metadata.

The optional synthetic Gemini fixture is retained at `?view=gemini`, separately
from the real screenshot used by the README. Its temporary-chat symbol is the
original `gemini_chat_temp` glyph from the Luminous Symbols font served by Google
Fonts (`fonts.gstatic.com`) and referenced by Gemini's public interface. Its
outline is embedded in the fixture; no account content or font runtime request
is included.
