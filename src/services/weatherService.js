const CACHE_TTL = 15 * 60 * 1000;
const cache = new Map();

const weatherCodes = {
  0: ['晴朗', '☀'],
  1: ['大致晴朗', '☀'],
  2: ['局部多云', '⛅'],
  3: ['阴天', '☁'],
  45: ['有雾', '≋'],
  48: ['雾凇', '≋'],
  51: ['毛毛雨', '☂'],
  53: ['毛毛雨', '☂'],
  55: ['毛毛雨', '☂'],
  61: ['小雨', '☂'],
  63: ['中雨', '☂'],
  65: ['大雨', '☂'],
  71: ['小雪', '✦'],
  73: ['中雪', '✦'],
  75: ['大雪', '✦'],
  80: ['阵雨', '☂'],
  81: ['阵雨', '☂'],
  82: ['强阵雨', '☂'],
  95: ['雷雨', 'ϟ'],
  96: ['雷雨', 'ϟ'],
  99: ['强雷雨', 'ϟ']
};

export async function searchWeatherCity(name, fetcher = fetch) {
  const query = String(name || '').trim();
  if (query.length < 2) {
    throw new Error('请输入至少两个字的城市名。');
  }
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.search = new URLSearchParams({
    name: query,
    count: '1',
    language: 'zh',
    format: 'json'
  }).toString();
  const response = await fetcher(url);
  if (!response.ok) throw new Error('城市搜索失败，请稍后重试。');
  const data = await response.json();
  const location = data.results?.[0];
  if (!location) throw new Error('没有找到这个城市，请换一个名称。');
  return {
    city: [location.name, location.admin1].filter(Boolean).join(' · '),
    latitude: Number(location.latitude),
    longitude: Number(location.longitude)
  };
}

function readWeatherCode(code) {
  return weatherCodes[Number(code)] || ['天气变化中', '☁'];
}

export async function getWeatherForecast(widget = {}) {
  const latitude = Number(widget.latitude ?? 31.2304);
  const longitude = Number(widget.longitude ?? 121.4737);
  const key = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.value;

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
    forecast_days: '1'
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) throw new Error(`天气接口返回 ${response.status}`);
  const data = await response.json();
  const [condition, icon] = readWeatherCode(data.current?.weather_code);
  const value = {
    temperature: `${Math.round(data.current?.temperature_2m ?? 0)}°`,
    condition,
    icon,
    high: Math.round(data.daily?.temperature_2m_max?.[0] ?? 0),
    low: Math.round(data.daily?.temperature_2m_min?.[0] ?? 0)
  };
  cache.set(key, { time: Date.now(), value });
  return value;
}

export async function bindLiveWeather(container, config) {
  const widget = config.theme?.widgets?.weather;
  const root = container.querySelector('[data-weather-live]');
  if (!widget?.enabled || !root) return;

  try {
    const weather = await getWeatherForecast(widget);
    root.querySelector('[data-weather-temperature]').textContent = weather.temperature;
    root.querySelector('[data-weather-condition]').textContent = `${weather.condition} · ${weather.low}° / ${weather.high}°`;
    root.querySelector('[data-weather-icon]').textContent = weather.icon;
    root.classList.add('is-live');
  } catch {
    root.classList.add('is-fallback');
  }
}
