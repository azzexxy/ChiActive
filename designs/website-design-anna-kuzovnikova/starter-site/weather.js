/**
 * ChiActive Live Chicago Weather & Seasonal Particle Animation Engine
 *
 * 4 Chicago Seasons with 19 Authentic Meteorological Modes:
 *
 * ❄️ WINTER:
 *  1. ❄️ Blizzard (Lake Effect Snow & Gale Swirls)
 *  2. 🧊 Polar Vortex (Sub-Zero -15°F Deep Freeze)
 *  3. 🌧️ Freezing Rain (Sidewalk Slush & Sleet)
 *  4. 🌨️ Hail (Lakefront Ice Pellets & Bounces)
 *  5. 🌬️ Lake Gale (35+ mph Freezing Lake Michigan Gales)
 *
 * 🌸 SPRING:
 *  6. 🌦️ Spring Drizzle (Campus Quad Light Showers)
 *  7. ⚡ Lake Squall (Spring Thunderstorm & Lightning)
 *  8. 🌫️ Morning Mist (Dense Lakefront Fog Advisory)
 *  9. ☀️ Crisp Thaw (Spring Thaw & Sunshine)
 * 10. 🌈 Double Rainbow (Post-Squall Lakefront Rainbow)
 *
 * ☀️ SUMMER:
 * 11. 🌦️ Summer Rain (Warm Refreshing Downpour)
 * 12. 🔥 Heatwave (94°F Asphalt Thermal Shimmer)
 * 13. ☀️ Beach Sun (Golden North Avenue Beach Sunshine)
 * 14. 🌪️ Tornado Warning (Midwest Siren Funnel Vortex)
 *
 * 🍂 FALL:
 * 15. 🍂 Leaf Fall (Golden Campus Autumn Leaves)
 * 16. 🌧️ Autumn Drizzle (Chilly October Drizzle)
 * 17. ☁️ Moody Overcast (Loop Gray Sky Hustle)
 * 18. ⚡ Autumn Squall (October Cold Front Thunder)
 * 19. 🌙 Midnight Chill (Late-Night Starlit Library Walk)
 */

(function () {
  let canvas, ctx;
  let currentMode = 'leaves';
  let currentSeason = 'fall';
  let particles = [];
  let animId = null;
  let lightningOpacity = 0;
  let sunPulse = 0;
  let heatWaveTime = 0;
  let tornadoAngle = 0;

  // Season Definitions & Weather Groupings
  const SEASONS = {
    winter: {
      name: 'Winter',
      icon: '❄️',
      defaultMode: 'snow',
      modes: ['snow', 'vortex', 'sleet', 'hail', 'wind']
    },
    spring: {
      name: 'Spring',
      icon: '🌸',
      defaultMode: 'springrain',
      modes: ['springrain', 'storm', 'fog', 'sun', 'rainbow']
    },
    summer: {
      name: 'Summer',
      icon: '☀️',
      defaultMode: 'summersun',
      modes: ['summerrain', 'heat', 'summersun', 'tornado']
    },
    fall: {
      name: 'Fall',
      icon: '🍂',
      defaultMode: 'leaves',
      modes: ['leaves', 'fallrain', 'overcast', 'autumnstorm', 'midnight']
    }
  };

  // 19 Complete Weather Mode Copy Profiles in ChiActive Collegiate Voice
  const WEATHER_COPY = {
    // === WINTER ===
    'snow': {
      temp: '22°F',
      status: 'Lake Effect Blizzard • Snowfall 2"/hr • Wind 34 mph',
      tag: 'Sub-Zero Campus Winter Survival',
      h1: "The blizzard doesn't care about your 8 AM exam. <span>Your coat should.</span>",
      desc: "High-loft thermal insulation and wind-blocking baffles engineered for freezing campus quads and icy 'L' train platforms.",
      cta: "Explore Winter Parkas"
    },
    'vortex': {
      temp: '-15°F',
      status: 'Polar Vortex Deep Freeze Alert • Wind Chill -35°F',
      tag: 'Polar Vortex Arctic Armor',
      h1: "The Polar Vortex doesn't negotiate with your alarm. <span>Armor up.</span>",
      desc: "Maximum-density expedition parkas and thermal aviator headwear engineered to survive minus-fifteen-degree Arctic blasts across Michigan Avenue.",
      cta: "Explore Sub-Zero Armor"
    },
    'sleet': {
      temp: '31°F',
      status: 'Freezing Rain & Sidewalk Slush • Wind 26 mph',
      tag: 'Slush & Sleet Traction Protection',
      h1: "Chicago sidewalk slush doesn't care about clean sneakers. <span>Step fearless.</span>",
      desc: "High-traction ice-grip soles and sealed DWR ripstop cargo pants crafted to survive treacherous winter slush crossings and icy stairs.",
      cta: "Shop Waterproof Boots"
    },
    'hail': {
      temp: '28°F',
      status: 'Lakefront Hail & Ice Pellets • Gusts 45 mph',
      tag: 'Impact-Resistant Hard Shells',
      h1: "Midwest hail doesn't ask if you're running late. <span>Shield your stride.</span>",
      desc: "Abrasion-resistant 3-layer Gore-Tex ripstop jackets engineered to deflect pelting ice and freezing Lake Michigan gusts.",
      cta: "Explore Impact Shells"
    },
    'wind': {
      temp: '26°F',
      status: 'Windy City Gale Warning • Lake Gusts 44 mph',
      tag: 'Chicago Outdoor & Campus Wear',
      h1: "The lake wind doesn't care about your plans. <span>Your jacket should.</span>",
      desc: "Technical, comfortable apparel designed for college students conquering lecture halls, 'L' train commutes, and Lake Michigan blizzards.",
      cta: "Explore Windproof Jackets"
    },

    // === SPRING ===
    'springrain': {
      temp: '52°F',
      status: 'Campus Spring Showers • Fresh Lake Breeze 14 mph',
      tag: 'Spring Quad Commuter Gear',
      h1: "April drizzle on the quad doesn't pause class. <span>Breathe easy, stay dry.</span>",
      desc: "Lightweight breathable shell pullovers that pack into their own pocket, ready for spontaneous Midwest spring showers.",
      cta: "Shop Lightweight Anoraks"
    },
    'storm': {
      temp: '48°F',
      status: 'Lake Michigan Squall & Thunder • Wind 36 mph',
      tag: 'Stormproof Chicago Commuter Gear',
      h1: "The Loop downpour doesn't care about your notes. <span>Stay bone-dry.</span>",
      desc: "DWR water-repellent shells and suspended laptop sleeves built to protect your tech from torrential Midwest squalls.",
      cta: "Explore Rain Gear"
    },
    'fog': {
      temp: '45°F',
      status: 'Dense Lakefront Fog Advisory • Visibility 0.2 mi',
      tag: 'Zero-Visibility Lakefront Transit',
      h1: "The lakefront fog doesn't care where your class is. <span>Move with confidence.</span>",
      desc: "Reflective safety accents and moisture-wicking breathable shells engineered for low-visibility morning walks along Michigan Avenue.",
      cta: "Shop High-Vis & Mist Layers"
    },
    'sun': {
      temp: '58°F',
      status: 'Crisp Spring Thaw & Lakefront Sun • Wind 12 mph',
      tag: 'Four-Season Lakefront Activewear',
      h1: "First warm rays over Lake Michigan. <span>Shed the heavy layers.</span>",
      desc: "Transitional midweight fleece and stretch-woven cargo pants designed for crisp sunny walks between lectures and the lakefront.",
      cta: "Shop Spring Transition Wear"
    },
    'rainbow': {
      temp: '62°F',
      status: 'Post-Squall Double Rainbow • Crisp Clean Air',
      tag: 'Fresh Horizon Recovery',
      h1: "The storm has cleared over Lake Michigan. <span>Chase the horizon.</span>",
      desc: "Vibrant lightweight activewear and moisture-shedding shells crafted to celebrate post-storm sunshine and lakefront running trails.",
      cta: "Shop Fresh Horizon Drops"
    },

    // === SUMMER ===
    'summerrain': {
      temp: '76°F',
      status: 'Refreshing Afternoon Downpour • Humidity 82%',
      tag: 'Quick-Drying Summer Commute',
      h1: "Sudden summer downpours won't derail your day. <span>Dry in minutes.</span>",
      desc: "Hydrophobic featherlight jackets and rapid-dry campus shorts engineered to shrug off summer deluges without overheating.",
      cta: "Shop Quick-Dry Tech"
    },
    'heat': {
      temp: '94°F',
      status: 'Midwest Heat Advisory • Heat Index 102°F',
      tag: 'Concrete Jungle Heatwave Tech',
      h1: "Summer heat on the asphalt doesn't pause for finals. <span>Stay cool.</span>",
      desc: "Ultra-breathable moisture-wicking tees, quick-dry shorts, and UV protection crafted for blazing campus days and beach volleyball at North Avenue.",
      cta: "Shop Breathable Summer Tech"
    },
    'summersun': {
      temp: '84°F',
      status: 'Golden Lakefront Sunshine • UV Index 9 (Very High)',
      tag: 'Lakefront Trail & Beach Sessions',
      h1: "Sun-drenched shores along the Lakefront Trail. <span>Move freely.</span>",
      desc: "UPF 50+ sun-shielding active tees and ultralight athletic joggers made for bike rides down to Oak Street Beach and outdoor workouts.",
      cta: "Explore Summer Activewear"
    },
    'tornado': {
      temp: '68°F',
      status: 'Midwest Severe Tornado Siren • Gusts 75 mph',
      tag: 'Emergency Storm Protocol',
      h1: "Midwest tornado sirens don't pause for exams. <span>Take shelter & stay geared.</span>",
      desc: "Heavy-duty ripstop storm shells and reinforced weather gear engineered for wild Midwest storm fronts and rapid weather extremes.",
      cta: "Shop Heavy-Duty Shells"
    },

    // === FALL ===
    'leaves': {
      temp: '54°F',
      status: 'Golden Campus Leaf Fall • Crisp Lake Breeze 14 mph',
      tag: 'Campus Leaf Fall Comfort',
      h1: "Swirling leaves and crisp winds between lectures. <span>Step into cozy layers.</span>",
      desc: "Brushed fleece pullovers, flexible trail cargo pants, and ergonomic campus packs made for brisk walks across Lincoln Park and Hyde Park.",
      cta: "Shop Knitwear & Fleece"
    },
    'fallrain': {
      temp: '47°F',
      status: 'Chilly Autumn Drizzle • Lake Wind 22 mph',
      tag: 'October Chill Weatherproofing',
      h1: "Cold autumn drizzle over the Loop. <span>Keep your focus sharp.</span>",
      desc: "Insulated waterproof shell jackets with fleece-lined chin guards and waterproof zip compartments to guard your gear against damp cold.",
      cta: "Shop Insulated Rain Shells"
    },
    'overcast': {
      temp: '50°F',
      status: 'Classic Chicago Overcast • Overcast Sky 100%',
      tag: 'Everyday Campus Hustle',
      h1: "Gray skies over the Loop. <span>Brighten your daily grind.</span>",
      desc: "Mid-weight fleece and versatile streetwear designed for chilly classroom air conditioning and overcast Chicago afternoons.",
      cta: "Shop Campus Fleece & Hoodies"
    },
    'autumnstorm': {
      temp: '43°F',
      status: 'October Cold Front Squall & Thunder • Wind 38 mph',
      tag: 'Cold Front Gale Armor',
      h1: "Cold fronts tearing off Lake Michigan. <span>Block the bite.</span>",
      desc: "Windproof storm parkas built with taped seams and thermal storm hoods to battle bone-chilling October squalls.",
      cta: "Shop Cold-Front Parkas"
    },
    'midnight': {
      temp: '36°F',
      status: 'Midnight Library Hours • Starlit Navy Skies',
      tag: 'Late-Night Campus Hustle',
      h1: "Late-night library sessions in sub-zero dark. <span>Stay warm and seen.</span>",
      desc: "Reflective 3M accents, heavy fleece linings, and insulated commuter hoods designed for 2 AM walks home across sleeping campus quads.",
      cta: "Shop Night Reflective Gear"
    }
  };

  // Backwards compatibility aliases
  WEATHER_COPY['autumn'] = WEATHER_COPY['leaves'];
  WEATHER_COPY['blizzard'] = WEATHER_COPY['snow'];

  // Helper to determine season for a mode
  function getSeasonForMode(mode) {
    for (const [seasonKey, seasonObj] of Object.entries(SEASONS)) {
      if (seasonObj.modes.includes(mode)) return seasonKey;
    }
    return 'fall';
  }

  // Detect current Chicago season based on current calendar month
  function detectCurrentSeason() {
    const month = new Date().getMonth(); // 0-11
    if (month === 11 || month === 0 || month === 1) return 'winter';
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    return 'fall'; // Sep, Oct, Nov
  }

  // Initialize Weather Engine
  function init() {
    canvas = document.getElementById('weather-canvas');
    if (!canvas) return;

    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    updateDateDisplay();

    // Auto-detect season based on real date (e.g. October = Fall)
    const detectedSeason = detectCurrentSeason();
    const defaultMode = SEASONS[detectedSeason].defaultMode;

    setupWeatherControls();
    setSeason(detectedSeason, false);
    setMode(defaultMode);
  }

  function resizeCanvas() {
    const hero = canvas.parentElement;
    if (hero) {
      canvas.width = hero.offsetWidth;
      canvas.height = hero.offsetHeight;
      createParticles();
    }
  }

  function updateDateDisplay() {
    const dateEl = document.getElementById('weather-date-display');
    if (!dateEl) return;

    const now = new Date();
    const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
    const dateStr = now.toLocaleDateString('en-US', dateOptions);
    const timeStr = now.toLocaleTimeString('en-US', timeOptions);
    dateEl.textContent = `${dateStr}, ${timeStr}`;
  }

  // Particle Factory for All 19 Atmospheric Modes
  function createParticles() {
    particles = [];
    if (!canvas) return;
    const w = canvas.width;
    const h = canvas.height;

    if (currentMode === 'snow') {
      // 1. Lake Effect Blizzard
      const count = Math.min(95, Math.floor(w / 12));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w, y: Math.random() * h,
          radius: Math.random() * 3 + 1,
          speedY: Math.random() * 2.2 + 1.2,
          speedX: Math.random() * 2.2 + 0.8,
          swing: Math.random() * 0.04, swingCount: Math.random() * 100,
          opacity: Math.random() * 0.6 + 0.4
        });
      }
    } else if (currentMode === 'vortex') {
      // 2. Polar Vortex Frost Shards
      for (let i = 0; i < 65; i++) {
        particles.push({
          x: Math.random() * w, y: Math.random() * h,
          size: Math.random() * 4 + 2,
          speedY: Math.random() * 1.8 + 0.5,
          speedX: (Math.random() - 0.5) * 3,
          rot: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 0.08,
          opacity: Math.random() * 0.7 + 0.3
        });
      }
    } else if (currentMode === 'sleet') {
      // 3. Freezing Rain & Slush Pellets
      for (let i = 0; i < 85; i++) {
        particles.push({
          x: Math.random() * w, y: Math.random() * h,
          radius: Math.random() * 2 + 1,
          speedY: Math.random() * 8 + 10,
          speedX: -2.5,
          opacity: Math.random() * 0.6 + 0.3
        });
      }
    } else if (currentMode === 'hail') {
      // 4. Lakefront Hail & Ice Pellets (Bouncing)
      const count = Math.min(80, Math.floor(w / 14));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w, y: Math.random() * h,
          radius: Math.random() * 2.5 + 2,
          speedY: Math.random() * 12 + 14,
          speedX: -(Math.random() * 3 + 2),
          opacity: Math.random() * 0.5 + 0.5,
          bounced: 0
        });
      }
    } else if (currentMode === 'wind') {
      // 5. 35+ mph Lake Michigan Gales
      const count = Math.min(48, Math.floor(w / 22));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w, y: Math.random() * h,
          length: Math.random() * 120 + 50,
          speedX: Math.random() * 10 + 10, speedY: Math.random() * 0.6 - 0.3,
          opacity: Math.random() * 0.35 + 0.15
        });
      }
    } else if (currentMode === 'springrain') {
      // 6. Fresh Campus Spring Drizzle
      const count = Math.min(85, Math.floor(w / 12));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w, y: Math.random() * h,
          length: Math.random() * 14 + 10,
          speedY: Math.random() * 7 + 8,
          speedX: -1.8,
          opacity: Math.random() * 0.35 + 0.25
        });
      }
    } else if (currentMode === 'storm') {
      // 7. Lake Squall & Thunderstorm
      const count = Math.min(115, Math.floor(w / 9));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w, y: Math.random() * h,
          length: Math.random() * 20 + 14,
          speedY: Math.random() * 12 + 16,
          speedX: -4.5,
          opacity: Math.random() * 0.45 + 0.3
        });
      }
    } else if (currentMode === 'fog') {
      // 8. Lakefront Dense Morning Mist
      for (let i = 0; i < 12; i++) {
        particles.push({
          x: Math.random() * w, y: Math.random() * h,
          radius: Math.random() * 150 + 120,
          speedX: -(Math.random() * 0.45 + 0.18),
          opacity: Math.random() * 0.12 + 0.05
        });
      }
    } else if (currentMode === 'sun') {
      // 9. Crisp Spring Thaw & Sun
      for (let i = 0; i < 32; i++) {
        particles.push({
          x: Math.random() * w, y: Math.random() * h,
          radius: Math.random() * 3 + 1,
          speedY: -(Math.random() * 0.4 + 0.1),
          speedX: Math.random() * 0.4 - 0.2,
          opacity: Math.random() * 0.4 + 0.2
        });
      }
    } else if (currentMode === 'rainbow') {
      // 10. Double Rainbow Sparkles
      for (let i = 0; i < 38; i++) {
        particles.push({
          x: Math.random() * w, y: Math.random() * h,
          radius: Math.random() * 3 + 1,
          speedY: -(Math.random() * 0.5 + 0.1),
          speedX: (Math.random() - 0.5) * 0.5,
          hue: Math.floor(Math.random() * 360),
          opacity: Math.random() * 0.6 + 0.3
        });
      }
    } else if (currentMode === 'summerrain') {
      // 11. Warm Summer Rain
      const count = Math.min(100, Math.floor(w / 10));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w, y: Math.random() * h,
          length: Math.random() * 18 + 14,
          speedY: Math.random() * 11 + 12,
          speedX: -2.5,
          opacity: Math.random() * 0.4 + 0.3
        });
      }
    } else if (currentMode === 'heat') {
      // 12. 94°F Asphalt Heatwave
      for (let i = 0; i < 45; i++) {
        particles.push({
          x: Math.random() * w, y: Math.random() * h,
          speedY: -(Math.random() * 2.5 + 1.2),
          speedX: Math.random() * 0.6 - 0.3,
          radius: Math.random() * 2.5 + 1,
          opacity: Math.random() * 0.45 + 0.15
        });
      }
    } else if (currentMode === 'summersun') {
      // 13. Beach Sunshine
      for (let i = 0; i < 40; i++) {
        particles.push({
          x: Math.random() * w, y: Math.random() * h,
          radius: Math.random() * 3.5 + 1.2,
          speedY: -(Math.random() * 0.5 + 0.2),
          speedX: Math.random() * 0.6 - 0.3,
          opacity: Math.random() * 0.5 + 0.25
        });
      }
    } else if (currentMode === 'tornado') {
      // 14. Midwest Tornado Siren Funnel
      for (let i = 0; i < 95; i++) {
        particles.push({
          distance: Math.random() * 180 + 30,
          y: Math.random() * h,
          speedY: -(Math.random() * 3 + 2),
          angle: Math.random() * Math.PI * 2,
          orbitSpeed: Math.random() * 0.09 + 0.05,
          size: Math.random() * 4 + 2,
          opacity: Math.random() * 0.6 + 0.3
        });
      }
    } else if (currentMode === 'leaves' || currentMode === 'autumn') {
      // 15. Golden Campus Leaf Fall
      const leafColors = ['#f59e0b', '#dc2626', '#d97706', '#b45309', '#ea580c', '#f97316'];
      for (let i = 0; i < 38; i++) {
        particles.push({
          x: Math.random() * w, y: Math.random() * h,
          size: Math.random() * 10 + 8,
          speedY: Math.random() * 1.6 + 0.9,
          speedX: Math.random() * 2.2 + 0.8,
          rot: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.05,
          color: leafColors[Math.floor(Math.random() * leafColors.length)],
          opacity: Math.random() * 0.3 + 0.7
        });
      }
    } else if (currentMode === 'fallrain') {
      // 16. Chilly Autumn Drizzle
      const count = Math.min(90, Math.floor(w / 11));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w, y: Math.random() * h,
          length: Math.random() * 16 + 10,
          speedY: Math.random() * 9 + 10,
          speedX: -3.5,
          opacity: Math.random() * 0.35 + 0.2
        });
      }
    } else if (currentMode === 'overcast') {
      // 17. Classic Moody Loop Overcast
      for (let i = 0; i < 15; i++) {
        particles.push({
          x: Math.random() * w, y: Math.random() * h,
          radius: Math.random() * 130 + 85,
          speedX: -(Math.random() * 0.6 + 0.2),
          opacity: Math.random() * 0.16 + 0.07
        });
      }
    } else if (currentMode === 'autumnstorm') {
      // 18. October Cold Front Squall
      const count = Math.min(115, Math.floor(w / 9));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w, y: Math.random() * h,
          length: Math.random() * 22 + 14,
          speedY: Math.random() * 14 + 16,
          speedX: -5.5,
          opacity: Math.random() * 0.45 + 0.3
        });
      }
    } else if (currentMode === 'midnight') {
      // 19. Late-Night Starlit Navy Chill
      for (let i = 0; i < 70; i++) {
        particles.push({
          x: Math.random() * w, y: Math.random() * h,
          radius: Math.random() * 2 + 0.8,
          twinkleSpeed: Math.random() * 0.04 + 0.02,
          twinkleCount: Math.random() * Math.PI * 2,
          baseAlpha: Math.random() * 0.5 + 0.4
        });
      }
    }
  }

  // Animation Loop Rendering All 19 Conditions
  function animate() {
    if (!ctx || !canvas) return;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    if (currentMode === 'snow') {
      // 1. BLIZZARD
      ctx.fillStyle = '#ffffff';
      particles.forEach(p => {
        p.swingCount += p.swing;
        p.y += p.speedY;
        p.x += p.speedX + Math.sin(p.swingCount) * 0.8;
        if (p.y > h) { p.y = -5; p.x = Math.random() * w; }
        if (p.x > w) p.x = 0;
        if (p.x < 0) p.x = w;

        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });

    } else if (currentMode === 'vortex') {
      // 2. POLAR VORTEX
      const frostBorder = ctx.createRadialGradient(w/2, h/2, h*0.3, w/2, h/2, w*0.7);
      frostBorder.addColorStop(0, 'rgba(255, 255, 255, 0)');
      frostBorder.addColorStop(0.8, 'rgba(186, 230, 253, 0.25)');
      frostBorder.addColorStop(1, 'rgba(255, 255, 255, 0.55)');
      ctx.fillStyle = frostBorder;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#e0f2fe';
      particles.forEach(p => {
        p.y += p.speedY; p.x += p.speedX; p.rot += p.rotSpeed;
        if (p.y > h) { p.y = -10; p.x = Math.random() * w; }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.opacity;
        ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
        ctx.restore();
      });

    } else if (currentMode === 'sleet') {
      // 3. SLEET & SLUSH
      ctx.fillStyle = '#bae6fd';
      particles.forEach(p => {
        p.y += p.speedY; p.x += p.speedX;
        if (p.y > h) { p.y = -5; p.x = Math.random() * w; }
        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });

    } else if (currentMode === 'hail') {
      // 4. HAIL & ICE PELLETS (BOUNCE PHYSICS)
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 1;
      particles.forEach(p => {
        p.y += p.speedY;
        p.x += p.speedX;

        // Bounce near bottom
        if (p.y > h - 15 && p.bounced === 0) {
          p.speedY = -p.speedY * 0.28;
          p.bounced = 1;
        }

        if (p.bounced > 0) p.bounced++;
        if (p.bounced > 6 || p.y > h) {
          p.y = -10;
          p.x = Math.random() * (w + 100);
          p.speedY = Math.random() * 12 + 14;
          p.bounced = 0;
        }

        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // High-velocity motion streak
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.speedX * 0.5, p.y - p.speedY * 0.5);
        ctx.stroke();
      });

    } else if (currentMode === 'wind') {
      // 5. WIND GALES
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.3;
      particles.forEach(p => {
        p.x += p.speedX; p.y += p.speedY;
        if (p.x > w) { p.x = -p.length; p.y = Math.random() * h; }
        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.length, p.y + p.speedY * 5);
        ctx.stroke();
      });

    } else if (currentMode === 'springrain') {
      // 6. SPRING DRIZZLE
      ctx.strokeStyle = '#6ee7b7';
      ctx.lineWidth = 1.2;
      particles.forEach(p => {
        p.y += p.speedY; p.x += p.speedX;
        if (p.y > h) { p.y = -15; p.x = Math.random() * (w + 100); }
        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.speedX * 1.2, p.y + p.length);
        ctx.stroke();
      });

    } else if (currentMode === 'storm') {
      // 7. SPRING SQUALL & THUNDER
      if (Math.random() < 0.008 && lightningOpacity <= 0) lightningOpacity = 0.35;
      if (lightningOpacity > 0) {
        ctx.fillStyle = `rgba(215, 235, 255, ${lightningOpacity})`;
        ctx.fillRect(0, 0, w, h);
        lightningOpacity -= 0.025;
      }
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 1.5;
      particles.forEach(p => {
        p.y += p.speedY; p.x += p.speedX;
        if (p.y > h) { p.y = -20; p.x = Math.random() * (w + 200); }
        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.speedX * 1.5, p.y + p.length);
        ctx.stroke();
      });

    } else if (currentMode === 'fog') {
      // 8. FOG
      particles.forEach(p => {
        p.x += p.speedX;
        if (p.x + p.radius < 0) { p.x = w + p.radius; p.y = Math.random() * h; }
        const grad = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, p.radius);
        grad.addColorStop(0, `rgba(226, 232, 240, ${p.opacity})`);
        grad.addColorStop(0.7, `rgba(203, 213, 225, ${p.opacity * 0.4})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });

    } else if (currentMode === 'sun') {
      // 9. CRISP SPRING SUN
      sunPulse += 0.02;
      const glowAlpha = 0.22 + Math.sin(sunPulse) * 0.06;
      const sunGrad = ctx.createRadialGradient(w * 0.85, 0, 10, w * 0.85, 0, w * 0.7);
      sunGrad.addColorStop(0, `rgba(255, 235, 170, ${glowAlpha})`);
      sunGrad.addColorStop(0.5, `rgba(65, 182, 230, ${glowAlpha * 0.4})`);
      sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fef08a';
      particles.forEach(p => {
        p.y += p.speedY; p.x += p.speedX;
        if (p.y < 0) { p.y = h; p.x = Math.random() * w; }
        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });

    } else if (currentMode === 'rainbow') {
      // 10. DOUBLE RAINBOW
      const rainbow = ctx.createLinearGradient(0, 0, w, 0);
      rainbow.addColorStop(0.1, 'rgba(239, 68, 68, 0.18)');
      rainbow.addColorStop(0.25, 'rgba(249, 115, 22, 0.18)');
      rainbow.addColorStop(0.4, 'rgba(234, 179, 8, 0.18)');
      rainbow.addColorStop(0.55, 'rgba(34, 197, 94, 0.18)');
      rainbow.addColorStop(0.7, 'rgba(59, 130, 246, 0.18)');
      rainbow.addColorStop(0.85, 'rgba(168, 85, 247, 0.18)');
      ctx.fillStyle = rainbow;
      ctx.fillRect(0, 0, w, h * 0.45);

      particles.forEach(p => {
        p.y += p.speedY; p.x += p.speedX;
        if (p.y < 0) { p.y = h; p.x = Math.random() * w; }
        ctx.fillStyle = `hsl(${p.hue}, 90%, 75%)`;
        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });

    } else if (currentMode === 'summerrain') {
      // 11. SUMMER RAIN
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 1.4;
      particles.forEach(p => {
        p.y += p.speedY; p.x += p.speedX;
        if (p.y > h) { p.y = -15; p.x = Math.random() * (w + 100); }
        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.speedX * 1.3, p.y + p.length);
        ctx.stroke();
      });

    } else if (currentMode === 'heat') {
      // 12. HEATWAVE
      heatWaveTime += 0.03;
      const heatGrad = ctx.createLinearGradient(0, h, 0, h * 0.4);
      heatGrad.addColorStop(0, 'rgba(234, 88, 12, 0.22)');
      heatGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = heatGrad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fbbf24';
      particles.forEach(p => {
        p.y += p.speedY;
        p.x += Math.sin(heatWaveTime + p.y * 0.05) * 1.2;
        if (p.y < 0) { p.y = h; p.x = Math.random() * w; }
        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });

    } else if (currentMode === 'summersun') {
      // 13. BEACH SUNSHINE
      sunPulse += 0.025;
      const glowAlpha = 0.28 + Math.sin(sunPulse) * 0.08;
      const sunGrad = ctx.createRadialGradient(w * 0.88, 0, 20, w * 0.88, 0, w * 0.8);
      sunGrad.addColorStop(0, `rgba(253, 224, 71, ${glowAlpha})`);
      sunGrad.addColorStop(0.4, `rgba(249, 115, 22, ${glowAlpha * 0.5})`);
      sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fde047';
      particles.forEach(p => {
        p.y += p.speedY; p.x += p.speedX;
        if (p.y < 0) { p.y = h; p.x = Math.random() * w; }
        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });

    } else if (currentMode === 'tornado') {
      // 14. TORNADO VORTEX
      tornadoAngle += 0.08;
      const vortexCenterX = w * 0.65;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#cbd5e1';
      particles.forEach(p => {
        p.angle += p.orbitSpeed;
        p.y += p.speedY;
        if (p.y < 0) p.y = h;
        const funnelWidth = (p.y / h) * 140 + 40;
        const orbitX = vortexCenterX + Math.cos(p.angle + tornadoAngle) * funnelWidth;
        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.arc(orbitX, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

    } else if (currentMode === 'leaves' || currentMode === 'autumn') {
      // 15. CAMPUS LEAF FALL
      particles.forEach(p => {
        p.y += p.speedY;
        p.x += p.speedX + Math.sin(p.y * 0.02) * 1.5;
        p.rot += p.rotSpeed;
        if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w; }
        if (p.x > w + 20) p.x = -20;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.5, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

    } else if (currentMode === 'fallrain') {
      // 16. CHILLY AUTUMN DRIZZLE
      ctx.fillStyle = 'rgba(15, 23, 42, 0.15)';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.3;
      particles.forEach(p => {
        p.y += p.speedY; p.x += p.speedX;
        if (p.y > h) { p.y = -15; p.x = Math.random() * (w + 100); }
        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.speedX * 1.3, p.y + p.length);
        ctx.stroke();
      });

    } else if (currentMode === 'overcast') {
      // 17. OVERCAST
      ctx.fillStyle = 'rgba(30, 41, 59, 0.2)';
      ctx.fillRect(0, 0, w, h);
      particles.forEach(p => {
        p.x += p.speedX;
        if (p.x + p.radius < 0) { p.x = w + p.radius; p.y = Math.random() * h; }
        const grad = ctx.createRadialGradient(p.x, p.y, 15, p.x, p.y, p.radius);
        grad.addColorStop(0, `rgba(148, 163, 184, ${p.opacity})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });

    } else if (currentMode === 'autumnstorm') {
      // 18. AUTUMN COLD FRONT SQUALL
      if (Math.random() < 0.009 && lightningOpacity <= 0) lightningOpacity = 0.38;
      if (lightningOpacity > 0) {
        ctx.fillStyle = `rgba(192, 132, 252, ${lightningOpacity})`;
        ctx.fillRect(0, 0, w, h);
        lightningOpacity -= 0.025;
      }
      ctx.strokeStyle = '#a5b4fc';
      ctx.lineWidth = 1.5;
      particles.forEach(p => {
        p.y += p.speedY; p.x += p.speedX;
        if (p.y > h) { p.y = -20; p.x = Math.random() * (w + 200); }
        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.speedX * 1.5, p.y + p.length);
        ctx.stroke();
      });

    } else if (currentMode === 'midnight') {
      // 19. MIDNIGHT STARS
      ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f8fafc';
      particles.forEach(p => {
        p.twinkleCount += p.twinkleSpeed;
        const alpha = p.baseAlpha + Math.sin(p.twinkleCount) * 0.35;
        ctx.globalAlpha = Math.max(0.1, alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    ctx.globalAlpha = 1.0;
    animId = requestAnimationFrame(animate);
  }

  // Switch Season & Display Appropriate Weather Controls
  function setSeason(seasonKey, shouldTriggerWeather = true) {
    if (!SEASONS[seasonKey]) seasonKey = 'fall';
    currentSeason = seasonKey;

    // Update Season Tabs Active State
    document.querySelectorAll('.season-tab-btn').forEach(btn => {
      const isTarget = btn.getAttribute('data-season') === seasonKey;
      btn.classList.toggle('active', isTarget);
      btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });

    // Toggle Weather Groups
    document.querySelectorAll('.season-weather-group').forEach(group => {
      if (group.getAttribute('data-season-group') === seasonKey) {
        group.classList.add('active');
        group.style.display = 'flex';
      } else {
        group.classList.remove('active');
        group.style.display = 'none';
      }
    });

    if (shouldTriggerWeather) {
      // If currently active weather is already in this season, keep it; otherwise switch to season default
      if (!SEASONS[seasonKey].modes.includes(currentMode)) {
        setMode(SEASONS[seasonKey].defaultMode);
      }
    }
  }

  // Set Specific Weather Mode Function
  window.setWeatherMode = function (mode) {
    setMode(mode);
  };

  window.setSeasonMode = function (season) {
    setSeason(season, true);
  };

  function setMode(mode) {
    if (!WEATHER_COPY[mode]) mode = 'leaves';
    currentMode = mode;

    // Synchronize season tab if mode belongs to another season
    const targetSeason = getSeasonForMode(mode);
    if (targetSeason !== currentSeason) {
      setSeason(targetSeason, false);
    }

    createParticles();

    // Update active pill styling across all groups
    document.querySelectorAll('.weather-pill-btn').forEach(btn => {
      if (btn.getAttribute('data-weather') === mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update message text, temp & Dynamic Hero Copy
    const copy = WEATHER_COPY[mode];
    const statusEl = document.getElementById('weather-status-text');
    const tempEl = document.getElementById('weather-temp-display');

    if (tempEl) tempEl.textContent = copy.temp;
    if (statusEl) statusEl.textContent = copy.status;

    const tagEl = document.getElementById('hero-tag');
    const titleEl = document.getElementById('hero-title');
    const descEl = document.getElementById('hero-desc');
    const ctaEl = document.getElementById('hero-cta-jackets');

    if (tagEl) tagEl.textContent = copy.tag;
    if (titleEl) titleEl.innerHTML = copy.h1;
    if (descEl) descEl.textContent = copy.desc;
    if (ctaEl) ctaEl.textContent = copy.cta;

    if (!animId) {
      animate();
    }
  }

  function setupWeatherControls() {
    // Season Tab Clicks
    document.querySelectorAll('.season-tab-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const season = this.getAttribute('data-season');
        setSeason(season, true);
      });
    });

    // Weather Pill Clicks
    document.querySelectorAll('.weather-pill-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const mode = this.getAttribute('data-weather');
        setMode(mode);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
