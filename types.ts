

export interface Tick {
  date: string;
  country: string;
  indicator: string;
  primary: {
    title: string;
    value: number | null;
    unit: string;
  };
  peers: {
    title: string;
    value: number | null;
    unit: string;
    relationship: number;
  }[];
}

export type VerificationStatus = 'pending' | 'fetching_peers' | 'peers_discovered' | 'fetching_data' | 'success' | 'error';

export interface VerificationResult {
    primaryKey: string;
    status: VerificationStatus;
    message?: string;
    peers?: TradingEconomicsPeer[];
    primaryFrequency?: string;
    selectedPeers?: string[];
    consolidatedData?: Record<string, any>[];
    tickData?: Tick[];
}

export interface Configuration {
  id: string;
  dataSources: string[];
  llmSelections: Record<string, string[]>; // Forecaster models
  judgeModel: string; // e.g., "OpenRouter::google/gemini-2.5-flash"
  forecastPrompt: string;
  judgePrompt: string;
  feedbackLimit: number;
  simulationOptions: {
    maxPredictions: number;
    skipPredictedTicks: boolean;
  };
  indicators: string[];
  countries: string[];
  timeframe: {
    start: Date;
    end: Date;
  };
  verificationData?: Record<string, VerificationResult>;
}

export interface ForecastResult {
  prediction: number;
  unit: string;
  rationale: string;
  confidence: number;
}

export interface JudgeResult {
  accuracy: number;
  error: number;
  feedback: string;
}

export interface BacktestTickResult {
  tickIndex: number;
  tickData: Tick;
  forecasts: Record<string, ForecastResult>;
  evaluations: Record<string, JudgeResult>;
}

export interface ModelBenchmark {
  modelId: string;
  modelName: string;
  provider: string;
  completionRate: number;
  directionalAccuracy: number;
  rmse: number;
  brierScore: number;
  avgConfidence: number;
  compositeScore: number;
  predictions: number;
}

export interface ExcludedModel {
  modelId: string;
  modelName: string;
  provider: string;
  reason: 'Insufficient Coverage' | 'Failed';
  message?: string;
  predictions: number;
  totalTicks: number;
}

export interface BacktestResults {
  compositeScore: number;
  overallDirectionalAccuracy: number;
  overallMagnitudeRmse: number;
  overallAvgConfidence: number;
  topPerformers: ModelBenchmark[];
  excludedModels: ExcludedModel[];
}


export interface Run {
  id: string;
  configId: string;
  config: Configuration;
  timestamp: Date;
  state: 'running' | 'paused' | 'completed';
  results: BacktestResults;
  tickResults?: BacktestTickResult[];
  errors?: Record<string, string>;
}

export enum Page {
  SETUP = 'Setup',
  RESULTS = 'Results',
  HISTORY = 'History',
}

// Types for TradingEconomics API Client
export interface TradingEconomicsIndicator {
  Symbol: string;
  Country: string;
  Category: string;
  CategoryGroup: string;
  Frequency: string;
  Unit: string;
  Source: string;
  LastUpdate: string;
  LatestValue: number;
  LatestValueDate: string;
  PreviousValue?: number;
  PreviousValueDate?: string;
}

export interface TradingEconomicsHistoricalData {
  Symbol: string;
  Country: string;
  DateTime: string;
  Value: number;
  Frequency: string;
  LastUpdate: string;
}

export interface TradingEconomicsForecast {
  Country: string;
  Category: string;
  Symbol: string;
  LastUpdate: string;
  Year: number;
  Month?: number;
  Quarter?: number;
  Date: string;
  Value: number;
}

export interface TradingEconomicsPeer {
  Country: string;
  Peer: string; // This is the symbol for the peer indicator
  Category: string; // This is the indicator name for fetching historical data
  Title: string; // This is the descriptive name for display
  LatestValue: number;
  LatestValueDate: string;
  URL: string;
  Relationship: number; // e.g., 0 for peer, -1 for primary
  Unit: string;
  Frequency: string;
}

export interface Country {
  id: string;
  code: string;
  name: string;
  region: string;
  income_group: string;
  is_supported: boolean;
  created_at: string;
}

export interface DataPoint {
  id: string;
  country_code: string;
  indicator_id: string;
  date: string;
  value_raw: number;
  unit_raw: string;
  vintage_date: string;
  release_date: string;
  ingestion_ts: string;
  hash: string;
}

// New type for normalized LLM model data
export interface NormalizedModel {
  id: string; // e.g., "meta-llama/llama-3-70b-instruct"
  name: string; // e.g., "Llama 3 70B Instruct"
  provider: string; // The service provider, e.g., "OpenRouter"
  sourceProvider: string; // The original model creator, e.g., "Meta"
  context: number; // e.g., 8192
  modality: 'multimodal' | 'text' | 'image' | 'audio'; // Simplified modalities
  pricing: {
    free: boolean;
    inputCost: number; // per 1M tokens
    outputCost: number; // per 1M tokens
  };
  compatibility: {
    allowed: boolean;
    reasoning: boolean;
    reasonIfBlocked?: string;
  };
}