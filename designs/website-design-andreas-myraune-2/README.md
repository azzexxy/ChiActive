# ChiActive: Collection 01

ChiActive's own jacket collection in an ultra-minimal store: six AI-designed jackets with the real ChiActive patch printed on.

**Live site:** https://myraune.github.io/chiactive/ (code: https://github.com/myraune/chiactive)

## Preview It

Double-click `../start-server-mac.command` (Mac) or `../start-server-windows.bat` (Windows), then open http://localhost:8000.

## The Design (v5, ultra-minimal)

- **White space first:** the pages use only white, the brand navy `#2F3F53` as the text colour, and one red six-point star (from the Chicago flag) in the logo.
- **Two typefaces:** Finlandica Headline for the wordmark and names, Google Sans for everything else. Everything is in sentence case, at small sizes.
- **The rail:** the homepage is a thin line across the screen with the six jackets hanging from it. They swing gently into place when the page loads; with "reduce motion" on, they just hang still.
- **Today's jacket:** one sentence under the rail reads the current Chicago weather (Open-Meteo: free, no key, nothing about the visitor is sent) and picks a jacket. For example: "It's 38°F in Chicago, with 18 mph wind off the lake. Today's jacket: Lakeshore Shell." If the weather can't be loaded, it simply says "Six jackets for the four-season city."
- **Photos:** campaign photos are shown framed in white space at their real resolution, never stretched full-width, so they stay sharp.
- **Page transitions** (Chrome, Edge, Safari 18+): the jacket photo carries over from the list to the product page.

## The Collection (Collection 02)

This version has its own collection, separate from the main site: six quiet, tonal jackets named after Chicago streets and neighborhoods.

| Jacket | Type | Colour | Price |
|---|---|---|---|
| Clark Shell | 3-layer shell, hidden zip | Stone | $319 |
| Lakeview Parka | Long bonded down parka | Ecru | $379 |
| Halsted Down Jacket | Short, boxy down jacket | Midnight | $259 |
| Kinzie Overshirt | Padded overshirt | Lake Blue | $169 |
| Racine Fleece | Smooth fleece jacket | Graphite | $129 |
| Ohio Street Rain Coat | Long rain coat | Flag Red | $239 |

**How the images were made:**
- The product and campaign photos were generated with Canva's AI image generator (design "ChiActive Collection 02").
- `tools/prepare_images.py` cleans the backgrounds to pure white and prints the **real** ChiActive patch on each jacket, shaded by the fabric under it. It also makes the patch close-ups and the transparent cutouts for the rail.
- The originals are kept in `images/c02/raw/`.

## Files

| File | What it is |
|---|---|
| `index.html` | Home: the rail, today's jacket, two campaign photos |
| `shop.html` | All six jackets, filterable by `#shells`, `#insulated` and `#layers` |
| `jackets/*.html` | Product pages: photos, size, add to cart, details and size guide |
| `blog/` | Journal: the student posts and the backpack article |
| `about.html`, `checkout.html`, `404.html` | About, demo checkout (nothing is sent, no payment), page not found |
| `site.css` | All styles |
| `js/main.js` | Cart, search, menu, product form, filters, checkout |
| `js/rail.js` | Today's weather and jacket on the homepage |
| `js/products.js` | Product catalog for the cart and search (built by `tools/build.py`) |
| `tools/build.py` | Builds every page from `tools/products.json`, `journal.json` and `article.html`: run `python3 tools/build.py` |
| `tools/prepare_images.py` | Turns the AI originals into product photos on white, patch close-ups and rail cutouts |
| `_archive/` | Earlier versions, including `scroll-film/` (the unzip and scroll-animation version) |

## Publishing

Run `python3 publish.py` from this folder. It publishes only the files the site uses to GitHub Pages, and replaces the student authors' names with "ChiActive Journal" on the public copy (this folder keeps the names).

## Honest Notes

- Collection 01 is a design concept for a class project. The product details describe the designs, not tested garments.
- The size guide uses typical measurements.
