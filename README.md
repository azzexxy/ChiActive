# ChiActive Storefront: four designs

Open `index.html` (or run `../start-server-mac.command` and go to http://localhost:8000). You land on a **design chooser** with previews of four complete storefronts. Click one to browse it; the **Switch design** button in the corner of every page brings you back.

| Folder | Design | Look |
|---|---|---|
| `forecast/` | Forecast | Dark weather-station look. Season tabs re-color the homepage and rebuild your outfit. |
| `journal/` | Lakefront Journal | Editorial magazine: masthead, cover story, numbered chapters, sale rack, table of contents. |
| `transit/` | The L | Chicago transit poster: each homepage section is a stop, the sale is a departures board, the discount is a fare card. |
| `classic/` | Classic | The original redesign (bright, flag-striped, rounded). |

Every design has the same 21 pages: homepage, Shop, Sale, Help & FAQ, About, 5 category pages, 9 product pages (Trail Cargo Pants + 8 more), blog listing and the backpack review. All share one cart: items you add in one design are still in the bag when you switch.

## Community designs (uploads)
At the bottom of the design picker is **Community designs**:

- **Upload a design**: drop a `.zip` or a folder with someone's website (it needs an `index.html` or any `.html` page), or use *Choose .zip* / *Choose folder*. Give it a name and who made it, then click *Add to the picker*. It gets a live preview card and opens like the other designs, with a "Design picker" button to come back. *Remove* deletes it (click twice).
- Uploads are saved **in that browser only** (IndexedDB) and are served by `sw.js`, so they need the local server (`start-server-mac.command` → http://localhost:8000). They don't work when opening `index.html` by double-clicking.
- **Shared designs**: put a design folder inside `designs/` and it appears for everyone who has these files (see `designs/README.md`). On GitHub Pages the picker finds the folders in the repo automatically.

Files: `designs.js` (upload + picker logic), `sw.js` (serves uploaded files), `vendor/jszip.min.js` (JSZip 3.10.1, MIT license, reads .zip files in the browser), `designs/` (shared designs).

## Shared files
- `images/` product photos (originals untouched), `images/web/` optimized copies, `images/previews/` chooser screenshots, logo, skyline illustration
- `fonts/` brand fonts (loaded locally, no internet needed)
- Each design folder has its own `styles.css`; `site.js` is the same everywhere (cart, Layer Finder, filters, product options, Shop menu)
- The old top-level pages (`shop.html`, `jackets/`, …) are now shortcuts to the Classic versions so old links still work

## Where product details come from
Sizes, colors, materials and descriptions come from the live listings on shopchiactive.com (the backpack's come from the student review). Nothing is invented; where the store lists nothing, the page says so.

## Placeholder store policies (confirm before using for real)
Student code STUDENT15 (15% off), free shipping over $50 (flat $6.95 under $50) and free 30-day returns are demo policies used consistently in every design and in the cart. Checkout is a demo; no payment is taken.
