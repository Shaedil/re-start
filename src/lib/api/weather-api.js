import descriptions from '../../assets/descriptions.json'

/**
 * OpenMeteo Weather API client with data processing utilities
 */
class WeatherAPI {
    constructor() {
        this.baseUrl = 'https://api.open-meteo.com/v1/forecast'
        this.cacheKey = 'weather_data'
        this.cacheExpiry = 15 * 60 * 1000
        this.fetchTimeout = 8 * 1000
    }

    /**
     * Get weather data from API and cache it
     */
    async getWeather(
        latitude,
        longitude,
        tempUnit,
        speedUnit,
        timeFormat = '12hr',
        forecastMode = 'hourly'
    ) {
        const rawData = await this._fetchWeatherData(
            latitude,
            longitude,
            tempUnit,
            speedUnit,
            forecastMode
        )
        this._cacheWeather(rawData, latitude, longitude)

        const forecast =
            forecastMode === 'daily'
                ? this._processDailyForecast(rawData.daily, timeFormat)
                : this._processHourlyForecast(
                      rawData.hourly,
                      rawData.current.time,
                      timeFormat
                  )

        return {
            current: this._processCurrentWeather(rawData.current, rawData.daily),
            forecast,
        }
    }

    /**
     * Get cached weather data with staleness info
     */
    getCachedWeather(
        timeFormat = '12hr',
        latitude = null,
        longitude = null,
        forecastMode = 'hourly'
    ) {
        const cached = this._getCachedData(latitude, longitude)

        if (!cached.data) {
            return { data: null, isStale: false }
        }

        const forecast =
            forecastMode === 'daily'
                ? this._processDailyForecast(cached.data.daily, timeFormat)
                : this._processHourlyForecast(
                      cached.data.hourly,
                      cached.data.current.time,
                      timeFormat
                  )

        const processedData = {
            current: this._processCurrentWeather(cached.data.current, cached.data.daily),
            forecast,
        }

        return {
            data: processedData,
            isStale: cached.isStale,
        }
    }

    /**
     * Get cached data with expiration status
     */
    _getCachedData(latitude = null, longitude = null) {
        try {
            const cached = localStorage.getItem(this.cacheKey)
            if (!cached) return { data: null, isStale: false }

            const {
                data,
                timestamp,
                latitude: cachedLat,
                longitude: cachedLon,
            } = JSON.parse(cached)

            // Check if coordinates have changed significantly
            if (
                latitude != null &&
                longitude != null &&
                cachedLat != null &&
                cachedLon != null &&
                this._coordinatesChanged(
                    cachedLat,
                    cachedLon,
                    latitude,
                    longitude
                )
            ) {
                this.clearCache()
                return { data: null, isStale: false }
            }

            const isStale = Date.now() - timestamp >= this.cacheExpiry
            return { data, isStale }
        } catch (error) {
            console.error('failed to get cached weather data:', error)
            localStorage.removeItem(this.cacheKey)
            return { data: null, isStale: false }
        }
    }

    /**
     * Clear the weather cache
     */
    clearCache() {
        localStorage.removeItem(this.cacheKey)
    }

    /**
     * Check if coordinates have changed significantly (more than ~0.5 degrees / ~30 miles)
     */
    _coordinatesChanged(oldLat, oldLon, newLat, newLon) {
        const threshold = 0.1
        return (
            Math.abs(oldLat - newLat) > threshold ||
            Math.abs(oldLon - newLon) > threshold
        )
    }

    /**
     * Private method to fetch raw weather data from API
     */
    async _fetchWeatherData(
        latitude,
        longitude,
        tempUnit,
        speedUnit,
        forecastMode = 'hourly'
    ) {
        const baseParams = {
            latitude: latitude.toString(),
            longitude: longitude.toString(),
            current:
                'temperature_2m,weather_code,relative_humidity_2m,precipitation_probability,wind_speed_10m,apparent_temperature,is_day',
            timezone: 'auto',
            temperature_unit: tempUnit,
            wind_speed_unit: speedUnit,
        }

        // Always fetch today's precipitation data
        baseParams.daily = 'weather_code,temperature_2m_max,temperature_2m_min,rain_sum,snowfall_sum'

        if (forecastMode === 'daily') {
            baseParams.forecast_days = '7'
        } else {
            baseParams.hourly = 'temperature_2m,weather_code,is_day'
            baseParams.forecast_hours = '24'
            baseParams.forecast_days = '1'
        }

        const params = new URLSearchParams(baseParams)

        try {
            const response = await fetch(`${this.baseUrl}?${params}`, {
                signal: AbortSignal.timeout(this.fetchTimeout),
            })
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`)
            }
            return await response.json()
        } catch (error) {
            if (error.name === 'TimeoutError') {
                throw new Error(`weather request timed out after ${this.fetchTimeout}ms`)
            }
            throw error
        }
    }

    /**
     * Process current weather data with descriptions
     */
    _processCurrentWeather(currentData, dailyData = null) {
        const isDay = currentData.is_day === 1
        const processed = {
            ...currentData,
            temperature_2m: currentData.temperature_2m.toFixed(0),
            wind_speed_10m: currentData.wind_speed_10m.toFixed(0),
            apparent_temperature: currentData.apparent_temperature.toFixed(0),
            description: this._getWeatherDescription(currentData.weather_code, isDay),
            icon: this._getWeatherIcon(currentData.weather_code, isDay),
        }

        // Add today's precipitation data if available
        if (dailyData && dailyData.rain_sum && dailyData.snowfall_sum) {
            const rainMm = dailyData.rain_sum[0] || 0
            const snowCm = dailyData.snowfall_sum[0] || 0
            // Convert mm to inches (1 mm = 0.0393701 in)
            processed.rain_inches = (rainMm * 0.0393701).toFixed(2)
            // Convert cm to inches (1 cm = 0.393701 in)
            processed.snow_inches = (snowCm * 0.393701).toFixed(1)
        }

        return processed
    }

    /**
     * Process hourly forecast to get every 3rd hour starting 3 hours from current hour
     */
    _processHourlyForecast(hourlyData, currentTime, timeFormat = '12hr') {
        const forecasts = []

        // Find the current or next hour in the forecast
        let currentIndex = 0
        for (let i = 0; i < hourlyData.time.length; i++) {
            const forecastTime = new Date(hourlyData.time[i])
            const now = new Date(currentTime)
            if (forecastTime >= now) {
                currentIndex = i
                break
            }
        }

        // Get forecasts every 3 hours starting from 3 hours after current, up to 5 forecasts
        for (
            let i = 0;
            i < 5 && currentIndex + (i + 1) * 3 < hourlyData.time.length;
            i++
        ) {
            const index = currentIndex + (i + 1) * 3
            const isDay = hourlyData.is_day[index] === 1
            forecasts.push({
                time: hourlyData.time[index],
                temperature: hourlyData.temperature_2m[index].toFixed(0),
                weatherCode: hourlyData.weather_code[index],
                description: this._getWeatherDescription(hourlyData.weather_code[index], isDay),
                icon: this._getWeatherIcon(hourlyData.weather_code[index], isDay),
                formattedTime: this._formatTime(hourlyData.time[index], timeFormat),
            })
        }

        return forecasts
    }

    /**
     * Process daily forecast to get next 5 days
     */
    _processDailyForecast(dailyData, timeFormat = '12hr') {
        const forecasts = []

        // Get forecasts for the next 5 days (skip today, get days 1-5)
        for (let i = 1; i <= 5 && i < dailyData.time.length; i++) {
            forecasts.push({
                time: dailyData.time[i],
                temperatureMax: dailyData.temperature_2m_max[i].toFixed(0),
                temperatureMin: dailyData.temperature_2m_min[i].toFixed(0),
                weatherCode: dailyData.weather_code[i],
                description: this._getWeatherDescription(dailyData.weather_code[i], true),
                icon: this._getWeatherIcon(dailyData.weather_code[i], true),
                formattedTime: this._formatDate(dailyData.time[i]),
            })
        }

        return forecasts
    }

    /**
     * Get weather description from code
     */
    _getWeatherDescription(weatherCode, isDay = true) {
        const timeOfDay = isDay ? 'day' : 'night'
        return (
            descriptions[weatherCode]?.[
                timeOfDay
            ]?.description?.toLowerCase() || 'unknown'
        )
    }

    /**
     * Get weather emoji icon from code
     */
    _getWeatherIcon(weatherCode, isDay = true) {
        const icons = {
            0: isDay ? '☀️' : '🌙',   // Clear
            1: isDay ? '🌤️' : '🌙',  // Mainly clear
            2: '⛅',                   // Partly cloudy
            3: '☁️',                   // Overcast
            45: '🌫️',                 // Fog
            48: '🌫️',                 // Rime fog
            51: '🌧️',                 // Light drizzle
            53: '🌧️',                 // Drizzle
            55: '🌧️',                 // Heavy drizzle
            56: '🌧️',                 // Light freezing drizzle
            57: '🌧️',                 // Freezing drizzle
            61: '🌧️',                 // Light rain
            63: '🌧️',                 // Rain
            65: '🌧️',                 // Heavy rain
            66: '🌧️',                 // Light freezing rain
            67: '🌧️',                 // Freezing rain
            71: '🌨️',                 // Light snow
            73: '🌨️',                 // Snow
            75: '🌨️',                 // Heavy snow
            77: '🌨️',                 // Snow grains
            80: '🌦️',                 // Light showers
            81: '🌦️',                 // Showers
            82: '🌦️',                 // Heavy showers
            85: '🌨️',                 // Light snow showers
            86: '🌨️',                 // Snow showers
            95: '⛈️',                 // Thunderstorm
            96: '⛈️',                 // Thunderstorm with hail
            99: '⛈️',                 // Thunderstorm with heavy hail
        }
        return icons[weatherCode] || '❓'
    }

    /**
     * Format time to display (e.g., "12pm" for 12hr, "12:00" for 24hr)
     */
    _formatTime(timeString, timeFormat = '12hr') {
        const date = new Date(timeString)

        if (timeFormat === '12hr') {
            return date
                .toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    hour12: true,
                })
                .toLowerCase()
        } else {
            return date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: false,
            })
        }
    }

    /**
     * Format date to display day name (e.g., "Mon", "Tue")
     */
    _formatDate(dateString) {
        const date = new Date(dateString + 'T00:00:00')
        return date
            .toLocaleDateString('en-US', { weekday: 'short' })
            .toLowerCase()
    }

    /**
     * Cache weather data with timestamp and coordinates
     */
    _cacheWeather(data, latitude, longitude) {
        const cacheData = {
            data,
            timestamp: Date.now(),
            latitude,
            longitude,
        }
        localStorage.setItem(this.cacheKey, JSON.stringify(cacheData))
    }
}

export default WeatherAPI
