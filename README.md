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

## Editing a whole site (Studio → ✎ Edit site)
- **Visual:** ✎ change text and links, 🗑 delete, ⋯ move up/down or duplicate; pictures have their own buttons to swap the image (upload a new one) or change its description, or delete it.
- **Code & files:** every file of the design in a code editor (CodeMirror) with a live preview: edit pages, CSS and JavaScript, add pages (blank or a copy of another page), add CSS/JS files, upload or replace images and other files (up to 25 MB each), rename/move, delete. **History** shows every saved version of a file and can bring any of them back.
- **Colours:** finds the colours in the site's CSS (named colour settings first, then every colour used), with colour pickers and a live preview; saves all changed CSS files at once.
- **⬆ New version:** upload the whole site again; it replaces every file but keeps the name, owner and editors (old versions stay in GitHub history).
- Every change asks for confirmation and is saved to GitHub straight away; secret keys are removed automatically. Owners, editors and admins can edit; nobody else.

## Admin page
**https://chiactive-uploads.onrender.com/admin** (password = `ADMIN_PASSWORD` in Render).
- **Activity:** uploads (started, saved, refused, failed, abandoned, with the error and error code), text edits and deletes (before → after), sign-ups, logins, wrong passwords, gallery visits, design views, pages clicked inside designs, and admin actions, all timestamped with device and a random visitor id. Filter, search, click a person to see only them, download CSV.
- **Designs:** rename, delete, set the **owner** (who can edit it in Studio), and “✎ Edit text” on any design.
- **Student accounts:** see every account and its designs, set a new password for a student who forgot theirs, delete an account (its designs stay, without an owner).
- The log and the accounts file are encrypted on the repo branch `activity-log` (GitHub Pages only publishes `main`). The key comes from `ADMIN_PASSWORD` (or `LOG_KEY`/`DATA_KEY` if set). **If you ever change ADMIN_PASSWORD, first add `DATA_KEY` and `LOG_KEY` in Render with the OLD password**, or the accounts and older log entries can't be read.

## AI fixer (admin page → AI fixes)
When the server or Studio hits a real bug, the upload server asks Claude what went wrong, gets a small code fix, **tests it** on a full copy of the server (`upload-server/test/selftest.js`: start-up, sign up, login, upload, preview, text edit/delete, admin pages), and if every test passes commits it to `main`, so Render redeploys by itself. Everything (the error, Claude's diagnosis, the exact code change, the test results, the commit) is listed under **AI fixes**, with **Approve** and **Undo** buttons.
- **Switch it on:** Render → `chiactive-uploads` → **Environment** → add `ANTHROPIC_API_KEY` (your Claude API key from console.anthropic.com) → Save. The key lives only in Render's encrypted settings; the server removes it from its environment at start-up and never logs it, shows it or writes it to GitHub. Setting a monthly spend limit in the Anthropic console is a good idea.
- **Modes:** *Fix & deploy automatically* (default), *Ask me first*, *Off*. Browser-side errors, admin reports and any change touching logins or admin checks always wait for approval.
- **Limits and safety:** 10 Claude checks and 3 automatic deploys a day (`AI_MAX_PER_DAY`, `AI_MAX_DEPLOYS_PER_DAY`); each error is looked at once per day; only the app's own files can change; fixes that add network calls, secrets access, new modules, eval or child processes are refused; it waits for running uploads before deploying.
- **Manual:** click **Ask Claude to fix this** on any error in the Activity tab, or describe a problem in the AI fixes tab.
- Optional: `AI_MODEL` (default `claude-sonnet-4-5`). Tests: `cd upload-server && node test/selftest.js` and `node test/fixer-test.js`.

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
