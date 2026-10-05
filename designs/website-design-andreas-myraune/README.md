# ChiActive: Collection 01

ChiActive's own jacket collection: six AI-designed jackets with the real ChiActive patch printed on, in one ultra-minimal store.

**Live site:** https://myraune.github.io/chiactive/ (code: https://github.com/myraune/chiactive)

## Preview It

Double-click `../start-server-mac.command` (Mac) or `../start-server-windows.bat` (Windows), then open http://localhost:8000.

## The Collection

| Jacket | Type | Price |
|---|---|---|
| Lakeshore Shell | 3-layer hardshell, sky blue / navy | $289 |
| 312 Down Parka | Long down parka, navy | $349 |
| Loop Puffer | Cropped down puffer, star red | $229 |
| Wacker Anorak | Windproof anorak, cream / navy | $149 |
| North Branch Fleece | High-pile fleece, navy / sky | $139 |
| Night Line Shell | Rain shell with reflective piping, graphite | $199 |

**How the images were made:**
- The product and campaign photos were generated with Canva's AI image generator, with a minimal Scandinavian look inspired by Norrøna and a clean chest on every jacket.
- The **real** ChiActive patch was then printed onto each jacket with a script, so the logo is always correct and follows the fabric's shading.
- The files are in `images/ai/`. Cutouts with transparent backgrounds are in `images/ai/cutouts/`. The shop uses the versions on pure white in `images/ai/white/`.

## The Homepage: a Scroll Film

The homepage is told in scenes, and scrolling plays them. All the animation code is our own, with no libraries:
- `js/motion.js` is the engine: smooth scroll, scenes, text reveals and the hiding header.
- `js/zip.js` runs the opening scene.
- `js/home.js` runs the other scenes.

0. **Loading screen and entrance:** only the logo, with a light beam sweeping across it (once per session). Then the CHIACTIVE letters rise one by one and the jacket stands up.
1. **Unzip** (`js/zip.js`), inspired by [Scroll Zipper](https://codepen.io/josetxu/pen/OJWoRvG), [Zipper Curtain](https://motionary.dev/animations/zipper-curtain) and macro zipper transitions in video editing:
   - **The push-in:** the camera pushes in from the Lakeshore Shell to the zip at its collar. If AI video frames exist in `images/ai/unzip/`, they play here instead.
   - **The macro zip:** the screen becomes the jacket's fabric, drawn live in a WebGL shader: blue ripstop, navy zip tape, interlocking metal teeth and the ChiActive patch.
   - **Scrolling or dragging the pull:** above the pull the sides part in a soft V (a hyperbola) and cast a shadow into the opening, where Collection 01 is waiting. Then both sides slide off the screen.
   - **Adding an AI video:** run `python3 tools/video_to_frames.py your-video.mp4`, then rebuild.
2. **Manifesto:** a big sentence whose words light up one by one as it passes the middle of the screen, then an outlined "FOUR KINDS OF COLD" marquee that speeds up, reverses and skews with your scrolling.
3. **Four kinds of cold:** a pinned stage that scrolls sideways through four full-screen panels:
   - January on the L platform: 312 Down Parka.
   - February on the frozen breakwater: Lakeshore Shell.
   - April on the quad: Loop Puffer.
   - An October night in the rain, drawn live on a canvas: Night Line Shell.

   In each panel the photo lags behind and the month races ahead for depth, the temperature counts as you scroll, and the jacket links to its page.
4. **The star:** the camera zooms from the jacket into the chest patch, then into the red star, until the star fills the screen: "The star of the Chicago flag. On every jacket we make."
   - The patch position was measured on the photo with template matching, and the star inside the badge with colour detection, so every handoff lines up.
   - A vector star takes over at the end, so it stays sharp at any size.
5. **Shot in Chicago:** a gallery of three columns that drift at different speeds, and photos that unmask upward as they appear.
6. **Finale:** the page lifts off like a curtain and reveals the footer underneath with a giant CHIACTIVE.

**Also on every page:**
- Smooth (inertia) scrolling with the mouse wheel.
- Headings that rise in word by word.
- Page transitions in Chrome, Edge and Safari 18+: pages cross-fade, and the jacket photo flies from the list into the product page.

**Reduce motion:** with this setting on, there is no smooth scroll and nothing is pinned or animated, and every scene is simply shown. Add `?motion=1` to the address to force the animation on.

## Design

- **Minimal:** everything is white, with small type and the jackets on pure white. Inspired by Norrøna, Arc'teryx and COS.
- **Header:** the ChiActive patch centered on white, like Canada Goose's badge. It's the same on every page.
- **Shop:** one slim sticky bar with the filters, then only photo, name and price.
- **Product card hover:** the jacket slowly fades into a close-up of the chest patch, and a quiet row of sizes rises from the bottom. Click a size to add the jacket straight to the cart (quick add). On touch screens the cards show only the photo.
- **About and Journal:** the same slim sticky bar as the shop, then straight to the content. About pairs one photo with a quiet text column and links to all six jackets. The Journal shows one line per story: date, title and author.
- **Product pages:** everything you need is above the fold: a gallery (thumbnails, arrows, swipe) on the left and the buy panel on the right (type, name, price, color, size with a size guide, Add to cart, free-shipping note and three key specs). Below:
  - **Anatomy:** numbered markers on the jacket, and hovering a marker or a feature in the list highlights both.
  - The campaign photo and related jackets.
  - A slim buy bar slides up at the bottom once you scroll past Add to cart.
- **Checkout:** the same slim bar, numbered steps, fields with only a line under them, and an order summary with a free-shipping nudge.
- **Earlier explorations:** three alternative homepage concepts (Editorial, Monochrome, Neon) are kept in `_archive/concepts/` for reference.

## Page Map

| File | What it is |
|---|---|
| `shop.html` | All six jackets, filterable: `#shells`, `#insulated`, `#layers` |
| `jackets/*.html` | Product pages: gallery and buy panel, Anatomy hotspots, campaign photo, related jackets, buy bar |
| `blog/` | Journal: the student posts and the backpack article |
| `about.html` | Brand story and how the collection was made |
| `checkout.html` | Demo checkout. Nothing is sent and no payment is taken. |
| `js/products.js` | Product catalog used by the cart, search and checkout |
| `js/main.js` | Cart drawer, menu, search, product page, filters, checkout |
| `js/motion.js`, `js/zip.js`, `js/home.js` | The motion engine and the homepage scenes |
| `_archive/` | Earlier versions and explorations: `concepts/`, `light-v1/`, `lake-effect-v2/`, `north-form/`, and `xray-reveal/` (the dropped X-ray hover effect) |

## Honest Notes

- Collection 01 is a design concept for a class project. The product details describe the designs, not tested garments.
- The size guide uses typical measurements.

## Publishing to GitHub Pages

Run `python3 publish.py` from this folder (needs git and the GitHub CLI, signed in as myraune). It builds a clean copy that holds only the files the site uses, then pushes it to github.com/myraune/chiactive. The site updates in about a minute.
- The public site shows "ChiActive Journal" instead of the student authors' names. This folder (the class ZIP) keeps the names.
- `python3 publish.py --dry-run` shows what would be published without pushing.
- `404.html` is GitHub Pages' "page not found" page, and `.nojekyll` makes GitHub serve the files as they are.

