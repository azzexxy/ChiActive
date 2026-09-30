# ChiActive Storefront

Open `index.html` (or run `../start-server-mac.command` and go to http://localhost:8000). The start page shows the **ChiActive store** (`classic/`) and, below it, the class design gallery. The **Switch design** button in the corner of every store page brings you back.

The store has 21 pages: homepage, Shop, Sale, Help & FAQ, About, 5 category pages, 9 product pages (Trail Cargo Pants + 8 more), blog listing and the backpack review. The bag is saved in the browser, so it survives page reloads.

## Class design gallery (uploads)
**Shareable link:** `upload.html` (online: https://azzexxy.github.io/ChiActive/upload.html). Everyone can upload there and see every design; the design picker (`index.html`) shows them too under "Community designs".

- Students drop a **.zip** (unzipped automatically) or a **folder**, and must enter their **student name**. The design is saved as **"Website design - <student name>"** in `designs/website-design-<student-name>/` and listed in `designs/manifest.json`. A second upload by the same name becomes "(2)", so nothing is overwritten.
- Uploads go through the **upload server** (`upload-server/`, deployed on Render with `render.yaml`), which commits them to this GitHub repo. The design can be opened **instantly**: the upload server serves it straight away at `https://chiactive-uploads.onrender.com/d/<folder>/` (from memory, or from the exact GitHub commit). Meanwhile GitHub Pages republishes the site (usually under a minute, faster thanks to `.nojekyll`), and the gallery switches to the Pages link automatically once it is live.
- Designs open in `view.html`, which keeps a bar on top: "You are viewing a demo website of <student name>" with a **Back to gallery** button. The student's site runs underneath it, so the bar stays while you click through their pages.
- A `.zip` added straight to `designs/` on GitHub is unpacked the same way by the GitHub Action in `.github/workflows/unzip-designs.yml`.
- If the upload server isn't set up or isn't answering, uploads are saved in that visitor's browser only (IndexedDB, served by `sw.js`).
- Settings live in `site-config.js` (upload server address, repo, Pages address).

### Upload server setup (one time)
1. Create a fine-grained GitHub token: GitHub → Settings → Developer settings → Fine-grained tokens → *Only select repositories: ChiActive* → Repository permissions → **Contents: Read and write**.
2. Render → **New → Blueprint** → connect the `azzexxy/ChiActive` repo → paste the token into `GITHUB_TOKEN` → Apply.
3. If Render gives the service a different address than `https://chiactive-uploads.onrender.com`, put that address in `site-config.js` (`uploadApi`).
The free Render plan sleeps when idle, so the first upload after a while can take up to a minute to start.

## Shared files
- `images/` product photos (originals untouched), `images/web/` optimized copies, `images/previews/` chooser screenshots, logo, skyline illustration
- `fonts/` brand fonts (loaded locally, no internet needed)
- Each design folder has its own `styles.css`; `site.js` is the same everywhere (cart, Layer Finder, filters, product options, Shop menu)
- The old top-level pages (`shop.html`, `jackets/`, …) are now shortcuts to the Classic versions so old links still work

## Where product details come from
Sizes, colors, materials and descriptions come from the live listings on shopchiactive.com (the backpack's come from the student review). Nothing is invented; where the store lists nothing, the page says so.

## Placeholder store policies (confirm before using for real)
Student code STUDENT15 (15% off), free shipping over $50 (flat $6.95 under $50) and free 30-day returns are demo policies used consistently across the store and in the cart. Checkout is a demo; no payment is taken.
