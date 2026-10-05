# ChiActive — Minimal edition

A whitespace-first take on the ChiActive storefront — minimal structure, but
loud where it counts. Same brand (`../brand-guidelines.md`: cyan `#41B6E6`,
deep slate `#2F3F53`, star red `#E4022B`, warm cream `#F5E7BE`; Finlandica
headlines, Google Sans body), built from hairline rules and generous
whitespace, then layered with:

- a scrolling **promo ticker** and a red **sale strip**
- coloured **advertising blocks** (student 15%, free shipping, winter sale)
- image-led **category tiles** and a full **promo panel** (Urban Campus Backpack)
- an **editorial split** with stats, plus lifestyle photography throughout
- colour accents: cyan highlights, red sale tags, a slate "New drop" panel

The look stays calm and typographic; the colour and photography do the selling.

This folder is a **self-contained site** — it does not change the original
`starter-site/` pages. Compare the two side by side.

## Preview

Run the class launcher from the parent folder, then open:

```
http://localhost:8000/minimal/
```

(Or open `minimal/index.html` directly in a browser — everything is local.)

All assets are shared from the parent folder via relative paths:
`../images/` for photography and the logo, `../fonts/` for the brand webfonts.

## Pages

| File | What it is |
|---|---|
| `index.html` | Home — hero, category list, featured products, sign-up |
| `shop.html` | Full catalogue (7 products) in a clean 4-up grid |
| `product.html` | Product detail: gallery, size + quantity, specs, related items |
| `about.html` | Story, who we build for, contact |
| `styles.css` | The whole design system for this edition |
| `app.js` | Mobile nav + demo cart (no dependencies, no build step) |

## Notes

- The cart is a demo. "Checkout" is a mock and nothing is sent anywhere.
- Cart state persists in `localStorage` under `chiactive_minimal_cart_v1`, a
  separate key from the main site, so the two carts never mix.
- Everything is offline-ready: no CDNs, no remote fonts, no external scripts.
