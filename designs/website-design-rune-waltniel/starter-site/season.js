/* ChiActive seasonal merchandising.
   Sets the active season, its discount, and the curated "what you need" guide.
   site.js applies the discount everywhere prices are shown, so a product can
   never be one price on a card and another in the cart.

   To roll the site forward to the next season: add another entry here and
   point CHIACTIVE_CURRENT_SEASON at it. Nothing else needs to change. */

window.CHIACTIVE_CURRENT_SEASON = 'autumn';

window.CHIACTIVE_SEASONS = {
  autumn: {
    key: 'autumn',
    name: 'Autumn',
    months: 'Late September to November',
    tagline: 'Chicago autumn is a jacket at 7am, a t-shirt by 2pm, and a surprise downpour on the walk home. Layer for all three.',
    discountPct: 15,
    discountLabel: 'Autumn Sale',
    ends: 'October 31',

    /* Editorial imagery for the season page. */
    heroImage: 'images/chicago-lakefront-autumn.jpg',
    heroCredit: '',
    rainImage: 'images/chicago-rain-cloudgate.jpg',
    rainTitle: 'When it rains, it rains sideways',
    rainCopy: 'A grey week on the lakefront is not the same as a grey week anywhere else. Wind pushes the rain under umbrellas and through the gap between your hood and your collar. That is why we cut the shells with a high collar and a hem you can cinch, and why the backpack is water-resistant rather than merely water-repellent.',

    /* "Shop the Look": one photo of a model in ChiActive gear, with the
       pieces he is wearing listed alongside it. */
    look: {
      title: 'Shop the Look',
      image: 'images/young-hipster-man-hiking-mountains-winter-vacation-traveling-scaled.jpg',
      caption: 'On the ridge line, late October',
      copy: 'Three pieces, one outfit. Everything below is what he is actually wearing, and every piece layers over the next as the season turns colder.',
      skus: ['green-winter-jacket', 'trail-cargo-pants', 'urban-campus-backpack']
    },

    /* The seasonal picks. Anything listed here automatically gets
       the season discount on every page, card, and cart line. */
    essentials: [
      { slot: 'The rain shell',       sku: 'always-effortless-jacket', why: 'Packs into a tote and appears the moment the sky opens up.' },
      { slot: 'The smart layer',      sku: 'zw-trench-coat',           why: 'Handles a Chicago drizzle and still looks sharp at an interview.' },
      { slot: 'The transition jacket', sku: 'green-winter-jacket',     why: 'Blocks lake wind without cooking you on a packed Red Line car.' },
      { slot: 'The deep-freeze backup', sku: 'chi-town-puffer-jacket', why: 'For the week the wind chill turns negative and does not come back.' },
      { slot: 'The trail day pant',   sku: 'trail-cargo-pants',        why: 'Water-resistant and roomy for a Saturday out at the dunes.' },
      { slot: 'The everyday carry',   sku: 'urban-campus-backpack',    why: 'Water-resistant and 25L, so your laptop survives the commute.' }
    ],

    /* Temperature bands: how to dress as the season turns.
       This is the "what do I actually wear today" answer. */
    conditions: [
      { temp: '60s', label: 'Golden afternoons',
        wear: 'Tee plus a packable shell',
        detail: 'Warm in the sun, cold in the shade. Carry the shell rather than wearing the jacket.',
        sku: 'always-effortless-jacket', cta: 'Shop the rain shell' },
      { temp: '50s', label: 'Classic October',
        wear: 'Light jacket over a layer',
        detail: 'The month that changes its mind hourly. Two light layers beat one heavy one.',
        sku: 'zw-trench-coat', cta: 'Shop the trench' },
      { temp: '40s', label: 'Wind off the lake',
        wear: 'Insulated jacket, wind-blocking outer',
        detail: 'The lakefront runs about ten degrees colder than inland. Block the wind and you are fine.',
        sku: 'green-winter-jacket', cta: 'Shop the winter jacket' },
      { temp: '30s', label: 'First hard freeze',
        wear: 'Puffer, hat, warm socks',
        detail: 'Once the wind chill bites, exposed skin is the problem. Cover the ears and the hands.',
        sku: 'chi-town-puffer-jacket', cta: 'Shop the puffer' }
    ],

    /* The packing checklist students can tick off. */
    packing: [
      'A layer you can shed by the afternoon',
      'Something water-repellent for the surprise shower',
      'A wind-blocking outer layer for the lakefront',
      'A pack that keeps your laptop dry on the commute',
      'Warm socks for the 40-degree morning walk',
      'A beanie for the 8am crossing of the quad'
    ]
  }
};
