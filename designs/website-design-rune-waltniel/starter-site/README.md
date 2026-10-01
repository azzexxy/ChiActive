# ChiActive Site

A fully branded, responsive ChiActive storefront built on top of the original static mockup.
Styled with the palette and local webfonts from `../brand-guidelines.md`.

## Run It On localhost

From **inside this folder** (`starter-site/`):

- **Windows:** double-click **`serve-windows.bat`**
- **Mac:** double-click **`serve-mac.command`**
- Then open **http://localhost:8000**

Both launchers start the server in this folder, wait until the port is genuinely accepting
connections, then open your browser. Press `Ctrl+C` in the terminal window to stop.

> **Why not the `.bat` in the parent folder?** `../start-server-windows.bat` decides whether Python
> exists with `where python`. On many Windows machines that finds the **Microsoft Store placeholder**
> `python.exe`, which is not a real interpreter - so the script takes the Python branch, fails, and
> never reaches its own PowerShell fallback. `serve-windows.bat` here tests the interpreter properly
> and also adds the missing `.woff2` font MIME type, so the brand fonts load.

If you prefer to serve it yourself:

```bash
cd starter-site
python -m http.server 8000        # or:  npx serve .
```

## Pages

| URL | What it is |
|---|---|
| `/index.html` | Homepage - hero, categories, seasonal guide, featured, values, testimonials, blog |
| `/shop.html` | Shop landing - all six categories |
| `/season.html` | The seasonal guide (currently Autumn) - see below |
| `/jackets/index.html` | Category grid (4 products, sale pricing) |
| `/pants/index.html` | Category grid |
| `/shoes/index.html` | Category grid |
| `/accessories/index.html` | Category grid |
| `/<category>/<product>.html` | Product detail pages (8 total) |
| `/blog/index.html` | Blog listing (5 posts) |
| `/blog/<post>.html` | Blog articles |
| `/about.html` | Brand story, values, FAQ, contact |

URLs mirror the structure planned for the real site: `/blog/[article]` and `/[category]/[product]`.

## How It Is Built

| File | Role |
|---|---|
| `styles.css` | The whole design system - tokens, type, responsive layout, cart drawer |
| `products.js` | Product catalog. Only products that have real photography are listed |
| `posts.js` | Blog post catalog driving the listing page |
| `season.js` | Active season: discount %, curated picks, temperature guide, packing list |
| `site.js` | Injects the shared header + footer, runs the cart, renders category/product pages |
| `serve-windows.bat` / `serve-mac.command` / `serve.ps1` | Local web server launchers |
| `fonts/` | Local brand webfonts (Finlandica + Google Sans Flex) - no remote CDN |
| `images/` | Logo, product photography, lifestyle shots |

The header, footer, cart badge, and drawer are injected by `site.js`, so navigation, the logo, and
the cart stay identical on every page and only need editing in one place. All paths are relative,
so the site also works when opened directly as a file.

## Features

- **Working shopping cart** - add from cards or product pages, quantity +/-, remove lines, live
  subtotal, free-shipping progress, and a mock checkout. Persists in `localStorage`.
- **Size + colour selection** - variant pills and photo swatches per product.
- **Seasonal campaigns** - a dismissible sale banner, automatic seasonal discounts, a
  temperature-band layering guide, and a saveable packing checklist.
- **Responsive** - verified with no horizontal overflow from 320px to 1600px. Mobile hamburger nav.
- **Sale merchandising** - sale badges, strikethrough pricing, and feature tags.
- **Shop the Look** - a photo of someone wearing the gear, with the exact pieces listed beside it,
  a running outfit total, and a one-click "add the whole look to cart".
- **Newsletter signup** - validated, with a demo-only confirmation toast.

## Design System

The mark is a circular woven patch: a navy ring, a cyan disc, a red six-pointed Chicago-flag star,
and cream mountains. The site is built from those four elements.

The **layout language is editorial and photography-led**, the register an outdoor brand like
Patagonia works in, rendered entirely in the ChiActive palette:

- **Light chrome.** White header with a hairline rule over a warm off-white page (`#F5F2EA`).
- **Photography leads.** Borderless product tiles with 4:5 images, no card borders or drop shadows,
  the image easing in scale on hover.
- **Quiet buttons.** Flat and rectangular with a 2px radius. Card actions are outlined and only fill
  on hover; the solid button is reserved for the primary action on a product page.
- **Underlined links** are the primary affordance; **hairline rules** replace boxed cards.
- **Type.** `Finlandica Headline` for headings, `Google Sans` for body, both loaded locally.

Palette roles:

| Token | Value | Used for |
|---|---|---|
| `--ink` | `#1B2634` | Text, solid buttons, footer, sale banner |
| `--cyan` | `#41B6E6` | Accents, links, hero CTA, cart count dot, tile watermark |
| `--red` | `#E4022B` | The star motif, sale badges, urgency |
| `--cream` | `#F5E7BE` | Warm surfaces (season hero, newsletter) |
| `--paper` | `#F5F2EA` | Page background |

The **six-pointed star** is the recurring brand accent. It appears in the logo, the sale banner, the
hero eyebrow, the value cards, as a watermark on category tiles that have no photography yet, and on
the testimonial cards.

### Homepage composition

Hero with trust bar (`4 seasons / 12 pieces / 30-day returns / Est. CHI`) then categories, the
seasonal guide, featured products, "Why ChiActive" values, student testimonials, blog, newsletter.

### Photography

All imagery lives in `images/`. The catalog only lists products that have a photograph, so no tile
can ever render an empty "No image yet" placeholder. If you add a product without a photo it will
show a placeholder - give it an image first, or leave it out.

Two seasonal images were added for the Autumn guide and are open-licensed:

| File | Source | Licence |
|---|---|---|
| `chicago-lakefront-autumn.jpg` | "Chicago Lakefront Trail" by TheWxResearcher (Wikimedia Commons) | CC0 - public domain |
| `chicago-rain-cloudgate.jpg` | "The Cloud Gate on a stormy day" by o palsson (Flickr) | CC BY 2.0 |

The Cloud Gate image is **CC BY**, so its credit should stay with it if this is ever published.
Replace either file with your own photo of the same name and the layout will pick it up.

## Seasonal Merchandising

Everything seasonal lives in **`season.js`**:

- `CHIACTIVE_CURRENT_SEASON` - which season is active (currently `autumn`).
- `discountPct` / `discountLabel` / `ends` - the sale itself.
- `essentials[]` - the curated picks, each with a **slot** ("The everyday layer") and a **why** line
  written for that season. **Any product listed here automatically gets the discount.**
- `conditions[]` - the temperature bands (`60s / 50s / 40s / 30s`), each with what to wear, a short
  explanation, and the product to shop. Rendered as the "Dress for the temperature" guide on both
  the homepage and `/season.html`. This is the "what do I wear today" answer.
- `packing[]` - the checklist items on `/season.html`.

The discount is applied by `effectivePrice()` in `site.js`, so a seasonal product shows the same
price on its card, its product page, the cart, and the subtotal - it cannot drift apart. Products
that are not seasonal picks keep their normal pricing.

Every price on the site is **charm-priced** and ends in `.99`. `effectivePrice()` takes the
discount first and then rounds **up to the next `.99`**, so the customer never pays more than the
advertised percentage off, and no price ever lands on an awkward `.25` or `.50`.

**Results of the Autumn Sale (15% off):**

| Product | Usual | Autumn |
|---|---|---|
| ChiActive Trail Cargo Pants | $24.99 | **$21.99** |
| Green Winter Jacket | $63.99 | **$54.99** |
| Always Effortless Jacket | $117.99 | **$100.99** |
| ZW Trench Coat | $109.99 | **$93.99** |
| Chi Town Puffer Winter Jacket | $184.99 | **$157.99** |
| Urban Campus Backpack | $59.99 | **$50.99** |
| ChiActive Snow Boots | $94.99 | not a seasonal pick, keeps its own sale price |

### Rolling forward to the next season

1. Add a new entry (for example `winter`) to `CHIACTIVE_SEASONS` in `season.js`, reusing the shape.
2. Point `CHIACTIVE_CURRENT_SEASON` at it.

The banner text, the nav label, the guide page, the discount, the conditions guide, and the
checklist all update on their own. No HTML needs to change.

## Adding A Product

1. Add a record to `CHIACTIVE_PRODUCTS` in `products.js` (copy an existing entry).
2. Create `/<category>/<slug>.html` containing:

```html
<main class="container" id="main" data-product-sku="YOUR-SKU"></main>
```

The page renders itself. No other edits needed - it appears in its category, in the shop, and in
related products automatically.
