# ChiActive, 3D redesign

Same store, same pages, same products, same brand (Chicago flag sky + red stars, navy, lakefront sand, Finlandica + Google Sans).
Open `index.html` in a browser. No build step.

## What's new
- `index.html` + `home.css` + `home.js` + `home3d.js`: new homepage.
  - 3D hero (three.js r128 from cdnjs): low-poly Chicago on Lake Michigan, a Chicago-flag star you can drag to spin and tap to change season, and weather per season (snow, rain, lakefront light, falling leaves).
  - The Chicago flag is the season switcher. It is wired to the Layer Finder in `site.js`, so moving the temperature slider also changes the city.
  - 3D product ring, lake-wind text that blows away from your cursor, a CTA "L" map of categories into the Loop, and a student ID card that fills itself in and flips to show STUDENT15.
- `fx.js` + `fx.css`: 3D pointer tilt with a light glare on product cards, tiles, blog cards and product galleries, on every page.
- `site.js` and `styles.css` are unchanged (bag, promo code, finder, product pages all work as before). All asset links bumped to `?v=8`.

If WebGL isn't available, the hero falls back to `images/chicago-skyline.svg`. Motion is reduced when the visitor has "reduce motion" turned on.
