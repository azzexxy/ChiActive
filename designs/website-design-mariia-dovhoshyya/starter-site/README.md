# ChiActive Starter Site

A static mockup of the ChiActive website in its current, unbranded state. Your job is to use your AI coding tool to restyle it with the brand in `../brand-guidelines.md` and the logo in `../logo-v1.png`.

## Preview It

To avoid browser security restrictions and broken relative links, run the local server launcher located in the parent folder:
- On Mac: Double-click `../start-server-mac.command`
- On Windows: Double-click `../start-server-windows.bat`
- Alternatively, you can open `index.html` directly in your browser. All product images and brand fonts are stored locally in `images/` and `fonts/`, so no internet connection is required to preview the mockup.

## Page Map

The folders mirror the URL structure we plan to use on the real site: `/blog/[article]` and `/[product-category]/[product-name]`.

| File | What it represents |
|---|---|
| `index.html` | Homepage (the live site does not have a real homepage yet) |
| `accessories/index.html` | Accessories category with the Faux-Fur Aviator Hat |
| `accessories/chiactive-faux-fur-aviator-hat.html` | Faux-Fur Aviator Hat preview using the supplied image and price |
| `shop.html` | Shop landing page with category tiles |
| `jackets/index.html` | Category page with a product grid, including sale prices |
| `pants/index.html` | Category page with a single product |
| `pants/chiactive-trail-cargo-pants.html` | Product page with a size variant selector, gallery, description, specs, and related products |
| `blog/index.html` | Blog listing |
| `blog/chiactive-urban-campus-backpack.html` | A single blog post written by a student |
| `about.html` | Placeholder About page |
| `styles.css` | Every page uses this one stylesheet |

Products and posts are copied from the starter mockup. Shoes, Gear, Layers, and Accessories have category pages. Added product previews use only supplied images and prices. Some unsupplied product/article destinations and the cart still use `#`.

## Working With Your AI Tool

- Open the whole `Website Design` folder in your AI tool so it can see the brand guidelines and logo, but only edit files inside `starter-site`.
- The logo is already available at `images/logo-v1.png`, and the brand fonts are in `fonts/`.
- You may change layouts, content, navigation, and page structure or add new pages. Update links as you make those changes, and keep all website files inside `starter-site/`.
