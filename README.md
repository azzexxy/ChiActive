# ChiActive class design gallery

Open `index.html` (or run `../start-server-mac.command` and go to http://localhost:8000). The start page is the **design gallery**: an upload box, then every design, newest first. Online: https://azzexxy.github.io/ChiActive/ (the old `upload.html` link forwards there).

Every design is treated the same, including the original ChiActive store (`designs/website-design-lothar/`, 21 pages with a working bag). Each one lives in `designs/<folder>/`, is listed in `designs/manifest.json`, and opens in `view.html` with a bar on top: "You are viewing a demo website of <student name>" and a **Back to gallery** button. The old top-level store pages (`shop.html`, `jackets/`, …) forward to the store design.

## Uploading
- Students drop a **.zip** (unzipped in their browser) or a **folder** and enter their **student name**. It's saved as **"Website design - <student name>"** in `designs/website-design-<student-name>/`. A second upload with the same name becomes "(2)".
- Size limits are GitHub's own: up to **100 MB per file** (GitHub refuses bigger files) and **1 GB per design** (the most GitHub Pages publishes). Unusable files (like .docx) are skipped and the student is told which.
- The browser sends files to the **upload server** (`upload-server/`, on Render via `render.yaml`) in 8 MB pieces; each piece is retried on its own if the connection hiccups. The server writes them to disk, then saves them to this repo in the background, pacing itself under GitHub's limits. The student sees progress and, if something fails, the exact reason plus an error code.
- The design can be opened **instantly**: while GitHub Pages republishes (about a minute), the upload server serves it at `https://chiactive-uploads.onrender.com/d/<folder>/`.
- A `.zip` added straight to `designs/` on GitHub is unpacked by the GitHub Action in `.github/workflows/unzip-designs.yml`.
- If the upload server can't be reached, the upload is saved in that visitor's browser only (IndexedDB, served by `sw.js`), and the student is told so.

## Admin page
**https://chiactive-uploads.onrender.com/admin** (password = `ADMIN_PASSWORD` in Render).
- **Activity:** every upload started, saved, refused, failed or abandoned (with the error, error code, file count and size), gallery visits, design views, pages clicked inside designs, admin logins and actions, all with timestamps, device and a random visitor id (plus the student name if that browser uploaded). Filter, search, click a person to see only them, download CSV.
- **Designs:** rename (design name and the student name in the demo bar) or delete any design, the store included.
- The log is saved encrypted on the repo branch `activity-log` (GitHub Pages only publishes `main`, so it's never part of the website). Only the admin password (or `LOG_KEY`, if set) can read it; if you change the password, older entries can't be decrypted anymore unless you set `LOG_KEY` to the old password.

## Upload server setup (one time)
1. Fine-grained GitHub token: GitHub → Settings → Developer settings → Fine-grained tokens → *Only select repositories: ChiActive* → Repository permissions → **Contents: Read and write**.
2. Render → **New → Blueprint** → the `azzexxy/ChiActive` repo → paste the token into `GITHUB_TOKEN`, choose an `ADMIN_PASSWORD` → Apply.
3. If Render gives the service a different address than `https://chiactive-uploads.onrender.com`, put it in `site-config.js` (`uploadApi`).
The free Render plan sleeps when idle, so the first upload after a while waits up to a minute for it to wake up. The token expires on the date you chose; renew it and update `GITHUB_TOKEN` in Render.

## Shared files
- `images/` product photos (originals untouched), `images/web/` optimized copies, `images/previews/` chooser screenshots, logo, skyline illustration
- `fonts/` brand fonts (loaded locally, no internet needed)
- The store design carries its own copies of the images and fonts it uses, so it works on its own like any other design

## Where product details come from
Sizes, colors, materials and descriptions come from the live listings on shopchiactive.com (the backpack's come from the student review). Nothing is invented; where the store lists nothing, the page says so.

## Placeholder store policies (confirm before using for real)
Student code STUDENT15 (15% off), free shipping over $50 (flat $6.95 under $50) and free 30-day returns are demo policies used consistently across the store and in the cart. Checkout is a demo; no payment is taken.
