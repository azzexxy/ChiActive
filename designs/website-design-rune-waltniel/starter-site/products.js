/* ChiActive product catalog.
   Single source of truth for every product on the site.

   Only products that have real photography are listed here, so nothing on
   the site can render an empty "No image yet" tile.

   Image paths are written relative to the SITE ROOT (starter-site/);
   site.js prepends the correct ../ prefix for whatever page is showing.

   Prices all end in .99 (charm pricing). Seasonal discounts are rounded to
   the nearest .99 by effectivePrice() in site.js. */

window.CHIACTIVE_CATEGORIES = [
  { slug: 'jackets',     name: 'Jackets',     blurb: 'Wind-blocking shells and puffers for the lakefront chill.' },
  { slug: 'pants',       name: 'Pants',       blurb: 'Cargos and trail pants built for class, commute, and trail.' },
  { slug: 'shoes',       name: 'Shoes',       blurb: 'Boots that handle snow, salt, and the icy walk to class.' },
  { slug: 'accessories', name: 'Accessories', blurb: 'Hats and packs for everyday campus carry.' }
];

window.CHIACTIVE_PRODUCTS = [
  {
    sku: 'trail-cargo-pants',
    name: 'ChiActive Trail Cargo Pants',
    category: 'pants',
    price: 24.99,
    image: 'images/d8fe858e-eb62-4d03-a595-571e5113690c.png',
    gallery: ['images/d8fe858e-eb62-4d03-a595-571e5113690c.png', 'images/gray.png', 'images/forest-green.png', 'images/dark-brown.png'],
    swatches: [
      { name: 'Black', image: 'images/d8fe858e-eb62-4d03-a595-571e5113690c.png' },
      { name: 'Gray', image: 'images/gray.png' },
      { name: 'Forest Green', image: 'images/forest-green.png' },
      { name: 'Dark Brown', image: 'images/dark-brown.png' }
    ],
    tags: ['Water-Resistant', 'Baggy Fit', '6 Pockets'],
    blurb: 'Lightweight, versatile cargo pants built for everyday wear and outdoor adventures.',
    description: 'ChiActive Trail Cargo Pants are made for students who want something comfortable, practical, and ready for adventure. The lightweight, water-resistant design works great for hiking, traveling, exploring the city, or heading to class. With multiple pockets for everyday essentials, these pants make it easy to stay active without sacrificing comfort or style.',
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    specs: { 'Size': 'XS, S, M, L, XL, XXL', 'Color': 'Black', 'Material': '90% Nylon, 10% Spandex', 'Fit': 'Baggy fit', 'Water Resistant': 'Water-Resistant' },
    url: 'pants/chiactive-trail-cargo-pants.html',
    featured: true
  },
  {
    sku: 'green-winter-jacket',
    name: 'Green Winter Jacket',
    category: 'jackets',
    price: 63.99,
    oldPrice: 88.99,
    image: 'images/young-hipster-man-hiking-mountains-winter-vacation-traveling-scaled.jpg',
    gallery: ['images/young-hipster-man-hiking-mountains-winter-vacation-traveling-scaled.jpg'],
    tags: ['Wind-Resistant', 'Insulated'],
    blurb: 'A warm, packable winter layer that shrugs off lake-effect wind on the walk to class.',
    description: 'Built for the long walk between the train and the lecture hall. This insulated jacket traps heat without the bulk, so it works over a hoodie in November and under a shell in January. The wind-resistant face fabric keeps the lake wind where it belongs: outside.',
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    specs: { 'Color': 'Forest Green', 'Shell': 'Wind-resistant recycled poly', 'Insulation': 'Synthetic, 120g', 'Fit': 'Regular', 'Hood': 'Adjustable, helmet-compatible' },
    url: 'jackets/green-winter-jacket.html',
    featured: true
  },
  {
    sku: 'chi-town-puffer-jacket',
    name: 'Chi Town Puffer Winter Jacket',
    category: 'jackets',
    price: 184.99,
    oldPrice: 199.99,
    image: 'images/Screenshot-2026-09-16-at-8.30.52-AM.png',
    gallery: ['images/Screenshot-2026-09-16-at-8.30.52-AM.png'],
    tags: ['Waterproof', 'Below-Zero Rated'],
    blurb: 'Our warmest puffer, rated for the deep-freeze weeks when the wind chill goes negative.',
    description: 'When the forecast says negative wind chill, this is the jacket you reach for. A waterproof shell, fully taped seams, and high-loft synthetic fill hold heat through the worst January has to offer. Cinch the hem, pull up the hood, and walk to class like it is nothing.',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    specs: { 'Color': 'Deep Slate', 'Shell': 'Waterproof 10k/10k laminate', 'Insulation': 'High-loft synthetic, 200g', 'Fit': 'Relaxed', 'Seams': 'Fully taped' },
    url: 'jackets/chi-town-puffer-jacket.html',
    featured: true
  },
  {
    sku: 'always-effortless-jacket',
    name: 'Always Effortless Jacket (Women)',
    category: 'jackets',
    price: 117.99,
    oldPrice: 147.99,
    image: 'images/Skarmavbild-2026-09-16-kl.-08.30.03.png',
    gallery: ['images/Skarmavbild-2026-09-16-kl.-08.30.03.png'],
    tags: ['Lightweight', 'Water-Repellent'],
    blurb: 'A featherweight packable shell you can stuff in a tote and forget about until it rains.',
    description: 'The one you keep in your bag all four seasons. Water-repellent, surprisingly warm for how little it weighs, and cut to layer over everything. Perfect for the days when the forecast cannot make up its mind.',
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    specs: { 'Color': 'Sand', 'Shell': 'Water-repellent ripstop', 'Packed Size': 'Fits in its own pocket', 'Fit': 'Slim', 'Weight': '9 oz' },
    url: 'jackets/always-effortless-jacket.html',
    featured: true
  },
  {
    sku: 'zw-trench-coat',
    name: 'ZW Collection Short High-Collar Trench Coat',
    category: 'jackets',
    price: 109.99,
    oldPrice: 128.99,
    image: 'images/Screenshot-2026-09-16-at-08.26.32.png',
    gallery: ['images/Screenshot-2026-09-16-at-08.26.32.png'],
    tags: ['Water-Repellent', 'City Style'],
    blurb: 'A short trench with a high collar for the days you need to look sharp and stay dry.',
    description: 'Chicago spring and fall call for something that handles a drizzle and still looks sharp at an internship interview. The high collar blocks wind, the short cut keeps it modern, and the water-repellent finish handles the surprise showers.',
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    specs: { 'Color': 'Camel', 'Shell': 'Water-repellent cotton blend', 'Fit': 'Regular, belted', 'Collar': 'High stand collar', 'Length': 'Short' },
    url: 'jackets/zw-trench-coat.html'
  },
  {
    sku: 'snow-boots',
    name: 'ChiActive Snow Boots',
    category: 'shoes',
    price: 94.99,
    oldPrice: 159.99,
    image: 'images/Screenshot-2026-09-16-at-8.33.54-AM.png',
    gallery: ['images/Screenshot-2026-09-16-at-8.33.54-AM.png'],
    tags: ['Waterproof', 'Insulated', 'Grippy'],
    blurb: 'Waterproof, insulated, and grippy enough for an icy sidewalk at 8 a.m.',
    description: 'From snow, to icy and slippery sidewalks, to freezing temperatures, walking to your next class becomes a lot easier in these. A waterproof membrane keeps slush out, 200g of insulation keeps warmth in, and a lugged outsole bites into ice.',
    sizes: ['6', '7', '8', '9', '10', '11', '12'],
    specs: { 'Color': 'Black / Charcoal', 'Upper': 'Waterproof leather + textile', 'Insulation': '200g synthetic', 'Outsole': 'Lugged rubber, ice-grip compound', 'Shaft Height': 'Mid-calf' },
    url: 'shoes/snow-boots.html',
    featured: true
  },
  {
    sku: 'aviator-hat',
    name: 'ChiActive Faux-Fur Aviator Hat',
    category: 'accessories',
    price: 51.99,
    image: 'images/chi-active-aviator-hat-2.png',
    gallery: ['images/chi-active-aviator-hat-2.png'],
    tags: ['Wind-Blocking', 'Faux Fur'],
    blurb: 'The earflap hat that makes a Chicago January walk actually tolerable.',
    description: 'Chicago winters can be extremely cold and windy, especially for students walking to class or waiting on a platform. This aviator-style hat covers the ears fully, blocks wind across the face, and the faux-fur lining traps heat without the itch.',
    sizes: ['S/M', 'L/XL'],
    specs: { 'Color': 'Dark Brown', 'Lining': 'Faux fur', 'Shell': 'Wind-blocking quilted nylon', 'Earflaps': 'Foldable, snap-up', 'Care': 'Spot clean' },
    url: 'accessories/aviator-hat.html',
    featured: true
  },
  {
    sku: 'urban-campus-backpack',
    name: 'ChiActive Urban Campus Backpack',
    category: 'accessories',
    price: 59.99,
    image: 'images/WhatsApp-Image-2026-09-20-at-11.32.42-PM-819x1024.jpeg',
    gallery: ['images/WhatsApp-Image-2026-09-20-at-11.32.42-PM-819x1024.jpeg'],
    tags: ['Water-Resistant', '25 L', 'Laptop Sleeve'],
    blurb: 'Built for campus. Ready for Chicago. Weather-resistant, 25 liters, laptop-ready.',
    description: 'Designed for college students who need a reliable backpack for classes, commuting, biking, studying outdoors, and exploring Chicago. Water-resistant recycled polyester, a padded 15.6-inch laptop compartment, dual bottle pockets, and a lightweight 1.8 lb build.',
    sizes: ['One Size'],
    specs: { 'Color': 'Black', 'Dimensions': '18" H x 12" W x 7" D', 'Weight': '1.8 lbs', 'Capacity': 'Approximately 25 L', 'Material': 'Water-resistant recycled polyester', 'Laptop': 'Up to 15.6"' },
    url: 'accessories/urban-campus-backpack.html',
    featured: true
  }
];
