# 10 Best Free Weather APIs in 2026 (Tested & Compared)

Building a weather app, dashboard, or IoT project? You'll need a reliable weather API. We tested the most popular free weather APIs available in 2026 to help you choose.

## Why Use a Weather API?

Weather data powers everything from travel apps to agricultural systems. A good weather API provides:

- **Current conditions** — temperature, humidity, wind, pressure
- **Forecasts** — hourly, daily, and extended predictions
- **Historical data** — past weather records for analysis
- **Severe alerts** — warnings for storms, hurricanes, and other hazards

## The Top 10 Free Weather APIs

### 1. Open-Meteo

**Free tier:** No API key required, no strict rate limits
**Best for:** Hobby projects and prototypes
**Features:** Current weather, hourly forecasts, 16-day forecasts, historical data

Open-Meteo is our top pick for beginners. No sign-up needed, completely free, and surprisingly comprehensive.

```
GET https://api.open-meteo.com/v1/forecast?latitude=40.71&longitude=-74.01&current_weather=true
```

### 2. OpenWeatherMap

**Free tier:** 60 calls/minute, 1,000 calls/day
**Best for:** Production apps with moderate traffic
**Features:** Current weather, 5-day forecast, air pollution, geocoding

One of the most established weather APIs. Requires a free API key but the free tier is generous.

### 3. WeatherAPI.com

**Free tier:** 1,000,000 calls/month
**Best for:** High-volume applications
**Features:** Current weather, forecasts, astronomy, sports

Offers an impressive free quota and includes astronomy data like sunrise/sunset times.

### 4. National Weather Service (NWS)

**Free tier:** Completely free, no key needed
**Best for:** US-based applications
**Features:** Forecasts, alerts, observations

The official US government weather API. Free and reliable but only covers the United States.

### 5. AccuWeather

**Free tier:** 50 calls/day
**Best for:** Premium weather data
**Features:** Minute-cast, hourly, daily forecasts, lifestyle indices

Known for highly accurate forecasts, though the free tier is limited.

### 6. Weatherbit

**Free tier:** 50 calls/day
**Best for:** Data-rich applications
**Features:** Current weather, forecasts, historical data, air quality

Provides detailed air quality and pollen data alongside standard weather metrics.

### 7. Climacell (Tomorrow.io)

**Free tier:** 500 calls/day
**Best for:** Hyperlocal forecasts
**Features:** Minute-by-minute forecasts, air quality, fire index

Specializes in hyperlocal, minute-accurate weather predictions.

### 8. Visual Crossing

**Free tier:** 1,000 records/day
**Best for:** Historical weather analysis
**Features:** Forecasts, historical data, weather statistics

Excellent for historical weather data and statistical analysis.

### 9. Meteosource

**Free tier:** 100 calls/day
**Best for:** European weather data
**Features:** Forecasts, current weather, alerts

Strong coverage for Europe with a clean API design.

### 10. 7Timer!

**Free tier:** Completely free, no key required
**Best for:** Astronomy and simple forecasts
**Features:** Civil, weather, and astronomy forecasts

A lightweight, no-signup option great for astronomy apps and simple weather needs.

## Comparison Table

| API | Free Calls | API Key Required | Global Coverage | Historical Data |
|-----|-----------|------------------|-----------------|-----------------|
| Open-Meteo | Unlimited* | No | Yes | Yes |
| OpenWeatherMap | 1,000/day | Yes | Yes | Yes |
| WeatherAPI | 1M/month | Yes | Yes | Limited |
| NWS | Unlimited | No | US only | Limited |
| AccuWeather | 50/day | Yes | Yes | No |

## How to Choose the Right Weather API

1. **Check rate limits** — Make sure the free tier covers your expected traffic.
2. **Verify coverage** — Some APIs are regional (like NWS for the US).
3. **Test data accuracy** — Compare forecasts against known conditions in your area.
4. **Review documentation** — Good docs save you hours of debugging.
5. **Check health status** — Use [apis.sendafun.com](https://apis.sendafun.com) to verify the API is currently online before integrating.

## Quick Start Example

Here's a simple JavaScript example using Open-Meteo:

```javascript
async function getWeather(lat, lon) {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
  );
  const data = await res.json();
  console.log(`Temperature: ${data.current_weather.temperature}°C`);
}
getWeather(40.71, -74.01); // New York
```

## Conclusion

For most projects, **Open-Meteo** is the best starting point — it's free, requires no API key, and offers comprehensive data. As your needs grow, consider **OpenWeatherMap** or **WeatherAPI** for their robust free tiers.

Want to explore more weather APIs? Browse and test all available weather APIs at **[apis.sendafun.com](https://apis.sendafun.com)**.
