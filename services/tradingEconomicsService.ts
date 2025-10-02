// Trading Economics API Client for Nakly MVP
// Production-ready client with rate limiting, retries, and error handling.
// NOTE: This service uses 'fetch' instead of 'axios' to avoid adding new dependencies.

import { 
  TradingEconomicsIndicator, 
  TradingEconomicsHistoricalData, 
  TradingEconomicsForecast,
  TradingEconomicsPeer,
  Country,
  DataPoint 
} from '../types';

interface TradingEconomicsConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export class TradingEconomicsClient {
  private config: Required<TradingEconomicsConfig>;
  private lastRequestTime: number = 0;

  constructor(config: TradingEconomicsConfig) {
    this.config = {
      baseUrl: 'https://api.tradingeconomics.com',
      timeout: 30000,
      maxRetries: 3,
      ...config,
    };
  }
  
  private async request<T>(endpoint: string, params: Record<string, any> = {}, retryCount = 0): Promise<T> {
    const url = new URL(`${this.config.baseUrl}${endpoint}`);
    // Add API key and format to all requests
    params.c = this.config.apiKey;
    params.f = 'json';
    
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    // Simple rate limiting: ensure at least 1 second between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < 1000) {
      await this.sleep(1000 - timeSinceLastRequest);
    }
    this.lastRequestTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
        const response = await fetch(url.toString(), {
            signal: controller.signal,
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Nakly-MVP/1.0',
            }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            // Handle retries for server errors
            if (response.status >= 500 && retryCount < this.config.maxRetries) {
                await this.sleep(Math.pow(2, retryCount) * 1000);
                return this.request<T>(endpoint, params, retryCount + 1);
            }
            // Throw a structured error for client errors
            const errorBody = await response.json().catch(() => ({ message: response.statusText }));
            
            let apiMessage = errorBody.message || '';
            if (typeof apiMessage !== 'string' || apiMessage.trim() === '') {
                apiMessage = '';
            }

            // If the API gives a specific, useful message, we use it directly.
            // Otherwise, we provide our own context based on the status code.
            if (apiMessage) {
                throw new Error(apiMessage);
            }

            let userFriendlyMessage;
            switch (response.status) {
                case 401:
                case 403:
                    userFriendlyMessage = "Invalid API Key. Please check your credentials.";
                    break;
                case 404:
                    userFriendlyMessage = "This indicator may not be available for the selected country, or your API plan doesn't cover it.";
                    break;
                case 429:
                    userFriendlyMessage = "API rate limit exceeded. Please wait a moment before trying again.";
                    break;
                default:
                    userFriendlyMessage = `Request failed with status: ${response.statusText}`;
            }
            
            if (response.status >= 500) {
                 userFriendlyMessage = "The data provider is experiencing technical difficulties. Please try again later.";
            }

            throw new Error(userFriendlyMessage);
        }

        return await response.json() as T;

    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                 throw new Error('Request timeout. Trading Economics API might be slow.');
            }
             // Re-throw API errors
            if (error.message.startsWith('API Error')) {
                throw error;
            }
        }
        // Handle network errors with retries
        if (retryCount < this.config.maxRetries) {
            await this.sleep(Math.pow(2, retryCount) * 1000);
            return this.request<T>(endpoint, params, retryCount + 1);
        }

        throw new Error(`Network Error: ${error instanceof Error ? error.message : 'Failed to fetch'}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get historical data for a specific indicator
   */
  async getHistoricalData(
    country: string,
    indicator: string,
    startDate?: string,
    endDate?: string
  ): Promise<TradingEconomicsHistoricalData[]> {
    try {
      let endpoint = `/historical/country/${encodeURIComponent(country)}/indicator/${encodeURIComponent(indicator)}`;
      
      // The Trading Economics API requires dates to be part of the URL path, not query parameters.
      if (startDate && endDate) {
        endpoint += `/${startDate}/${endDate}`;
      } else if (startDate) {
        // If only start date is provided, the API documentation implies it can be appended.
        endpoint += `/${startDate}`;
      }

      // Pass an empty params object as dates are now in the path. 
      // The `request` method will add the mandatory 'c' and 'f' parameters.
      return await this.request<TradingEconomicsHistoricalData[]>(endpoint, {});
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch historical data for ${country}/${indicator}: ${errorMessage}`);
    }
  }

  /**
   * Get peer indicators for a given country and indicator.
   */
  async getPeers(country: string, indicator: string): Promise<TradingEconomicsPeer[]> {
    try {
      // The TE API uses the indicator name in the URL, not a category slug.
      const endpoint = `/peers/country/${encodeURIComponent(country)}/${encodeURIComponent(indicator)}`;
      return await this.request<TradingEconomicsPeer[]>(endpoint);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch peer indicators for ${country}/${indicator}: ${errorMessage}`);
    }
  }


  /**
   * Validate API key by making a lightweight test request
   */
  async validateApiKey(): Promise<boolean> {
    try {
      // The `/country` endpoint is a simple, lightweight call to verify API key validity.
      // It should be accessible on most subscription tiers and serves as a reliable ping,
      // avoiding 401/403 errors for valid keys that have restricted data access.
      await this.request<any[]>(
        '/country'
      );
      return true;
    } catch (error) {
      console.error("API Key validation failed:", error);
      throw error;
    }
  }
}