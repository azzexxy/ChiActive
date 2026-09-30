# ChiActive class design gallery

Open `index.html` (or run `../start-server-mac.command` and go to http://localhost:8000). The start page is the **design gallery**: a box that leads to ChiActive Studio (sign up, upload, edit), then every design, newest first. Online: https://azzexxy.github.io/ChiActive/ (the old `upload.html` link forwards there).

Every design is treated the same, including the original ChiActive store (`designs/website-design-lothar/`, 21 pages with a working bag). Each one lives in `designs/<folder>/`, is listed in `designs/manifest.json`, and opens in `view.html` with a bar on top: "You are viewing a demo website of <student name>" and a **Back to gallery** button. The old top-level store pages (`shop.html`, `jackets/`, …) forward to the store design.

## ChiActive Studio (accounts, uploads, editing)
**https://chiactive-uploads.onrender.com/studio**, linked from the gallery's “Sign up or log in” box.
- Students **sign up** with their name, a username and a password (8+ characters), or log in. Passwords are stored only as scrypt hashes, in an encrypted file (`accounts/accounts.enc` on the `activity-log` branch). The login is an HttpOnly cookie on the upload server's own address, so no student design (they run on the GitHub Pages address) can read it.
- **Upload:** a **.zip** (unzipped in the browser) or a **folder**, up to **100 MB per file** (GitHub's limit) and **1 GB per design** (GitHub Pages' limit). It's saved as **"Website design - <name>"** in `designs/website-design-<name>/`, owned by that account. Files go up in 8 MB pieces, each retried on its own; the server saves them to this repo in the background, paced under GitHub's limits, and every error says exactly what went wrong with an error code.
- **Edit text:** “✎ Edit text” opens the design inside the Studio. Every title, paragraph, button, link, list item, label and table cell gets a **✎ pencil** and a **🗑 trash** icon. The pencil opens an edit box (the page updates live while typing; Enter saves, Shift+Enter adds a line, Ctrl/⌘+B/I for bold/italic, and links show their address). Every save and delete asks for confirmation, then only that piece of the HTML file is changed and committed to GitHub straight away. The public site shows it within about a minute. Links inside the page open the other pages in the editor.
- Only the owner (and the admin) can edit a design. The design runs in a sandboxed frame in the Studio, so its own scripts can't touch the Studio or the login.
- A `.zip` added straight to `designs/` on GitHub is unpacked by the GitHub Action in `.github/workflows/unzip-designs.yml` (it has no owner until the admin sets one).

## Admin page
**https://chiactive-uploads.onrender.com/admin** (password = `ADMIN_PASSWORD` in Render).
- **Activity:** uploads (started, saved, refused, failed, abandoned, with the error and error code), text edits and deletes (before → after), sign-ups, logins, wrong passwords, gallery visits, design views, pages clicked inside designs, and admin actions, all timestamped with device and a random visitor id. Filter, search, click a person to see only them, download CSV.
- **Designs:** rename, delete, set the **owner** (who can edit it in Studio), and “✎ Edit text” on any design.
- **Student accounts:** see every account and its designs, set a new password for a student who forgot theirs, delete an account (its designs stay, without an owner).
- The log and the accounts file are encrypted on the repo branch `activity-log` (GitHub Pages only publishes `main`). The key comes from `ADMIN_PASSWORD` (or `LOG_KEY`/`DATA_KEY` if set). **If you ever change ADMIN_PASSWORD, first add `DATA_KEY` and `LOG_KEY` in Render with the OLD password**, or the accounts and older log entries can't be read.

## Upload server setup (one time)
1. Fine-grained GitHub token: GitHub → Settings → Developer settings → Fine-grained tokens → *Only select repositories: ChiActive* → Repository permissions → **Contents: Read and write**.
2. Render → **New → Blueprint** → the `azzexxy/ChiActive` repo → paste the token into `GITHUB_TOKEN`, choose an `ADMIN_PASSWORD` → Apply. `ADMIN_PASSWORD` also switches on student accounts.
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
