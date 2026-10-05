/* Homepage rail: today's Chicago weather picks a jacket.
   Reads the current temperature, wind and rain for Chicago from Open-Meteo (free, no key, nothing
   about the visitor is sent), writes one sentence under the rail and lifts that jacket on the rail.
   If the request fails or is slow, the default line stays and every jacket stays equal. */
(() => {
  const rail = document.querySelector('.rail');
  const line = document.querySelector('[data-today]');
  if (!rail || !line || !('fetch' in window)) return;

  const URL = 'https://api.open-meteo.com/v1/forecast?latitude=41.88&longitude=-87.63'
    + '&current=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation'
    + '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FChicago';

  // Which jacket for which weather. Rain first, then cold, then wind.
  function pick(t, wind, rain) {
    if (rain > 0.1) return t < 40 ? 'clark-shell' : 'ohio-rain-coat';
    if (t < 15) return 'lakeview-parka';
    if (t < 32) return 'halsted-down-jacket';
    if (t < 45) return wind >= 12 ? 'clark-shell' : 'racine-fleece';
    if (t < 62) return wind >= 12 ? 'clark-shell' : 'kinzie-overshirt';
    return 'kinzie-overshirt';
  }
  // Wind direction is where it blows FROM. Lake Michigan is east of the city.
  function windWords(speed, deg) {
    if (speed < 8) return '';
    const s = Math.round(speed);
    if (deg >= 30 && deg <= 150) return `, with ${s} mph wind off the lake`;
    const names = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
    return `, with ${s} mph wind from the ${names[Math.round(deg / 45) % 8]}`;
  }

  const ctrl = 'AbortController' in window ? new AbortController() : null;
  const timer = setTimeout(() => ctrl && ctrl.abort(), 4000);
  fetch(URL, ctrl ? { signal: ctrl.signal } : {})
    .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
    .then(({ current: c }) => {
      clearTimeout(timer);
      if (!c || typeof c.temperature_2m !== 'number') return;
      const t = Math.round(c.temperature_2m);
      const id = pick(t, c.wind_speed_10m || 0, c.precipitation || 0);
      const item = rail.querySelector(`[data-id="${id}"]`);
      if (!item) return;
      const name = item.querySelector('.tag span').textContent;
      const rain = (c.precipitation || 0) > 0.1 ? ' and rain' : '';
      line.innerHTML = '';
      line.append(`It's ${t}°F in Chicago${windWords(c.wind_speed_10m || 0, c.wind_direction_10m || 0)}${rain}. Today's jacket: `);
      const a = document.createElement('a');
      a.href = item.getAttribute('href'); a.textContent = name;
      line.append(a, '.');
      rail.dataset.pick = id;
      item.classList.add('is-pick');
    })
    .catch(() => clearTimeout(timer));
})();
