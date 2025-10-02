

import { NormalizedModel } from './types';

export const DATA_SOURCES = ['Trading Economics'];
export const LLM_PROVIDERS = [
    'OpenRouter',
    'Google Gemini'
];

export const LLM_PROVIDERS_NO_KEY: string[] = [];

// Static models for providers that don't support dynamic discovery or as a fallback.
export const STATIC_NORMALIZED_MODELS: Record<string, Omit<NormalizedModel, 'provider' | 'compatibility'>[]> = {
    'Google Gemini': [
        {
            id: 'gemini-2.5-flash',
            name: 'Gemini 2.5 Flash',
            sourceProvider: 'Google',
            context: 1048576,
            modality: 'multimodal',
            pricing: {
                free: false,
                inputCost: 0.35, // Price per 1M tokens
                outputCost: 0.70, // Price per 1M tokens
            },
        }
    ]
};


export const DEFAULT_FORECAST_PROMPT = `You are a deterministic macroeconomic forecaster for backtesting. Use ONLY the provided data and feedback below. Do NOT use external knowledge, training data, or guesses. Your task is to predict the next period’s value for the target indicator.
Data:

Country: [COUNTRY]
Target Indicator: [INDICATOR]
Current Period: [CURRENT_DATE]
Current Value: [CURRENT_VALUE] ([CURRENT_UNIT])
Related Indicators (Peers):
[PEER_DATA]
Past Feedback (for this model, up to [FEEDBACK_LIMIT] ticks):
[PAST_FEEDBACK or "None (first tick)"]

Task:

Predict the next period’s ([NEXT_DATE]) value for [INDICATOR].
Provide a rationale (50–120 words) explaining your prediction, grounded in the provided data and feedback.
Output a JSON object with:

prediction: Numeric value for the next period.
unit: Unit of the prediction (e.g., percent).
rationale: Explanation of the prediction.
confidence: Confidence score (0.0–1.0).

Output Format:
json{
  "prediction": <number>,
  "unit": "<string>",
  "rationale": "<string, 50–120 words>",
  "confidence": <number, 0.0–1.0>
}`;

export const DEFAULT_JUDGE_PROMPT = `You are an unbiased judge for a macroeconomic forecasting backtest. Use ONLY the provided data below. Do NOT use external knowledge or guesses. Your task is to evaluate a prediction, calculate its accuracy and error, and provide model-specific feedback.
Data:

Model: [MODEL_NAME]
Tick Index: [TICK_INDEX]
Indicator: [INDICATOR]
Country: [COUNTRY]
Period: [NEXT_DATE]
Prediction: [PREDICTION] ([UNIT])
Actual Value: [ACTUAL_VALUE] ([UNIT])
Confidence Reported: [CONFIDENCE]
Past Performance (for this model, up to [FEEDBACK_LIMIT] ticks):
[PAST_PERFORMANCE]

Task:

Calculate the error (absolute difference between prediction and actual value).
Assign an accuracy score (0.0–1.0, where 1.0 is perfect).
Provide unambiguous feedback (50–150 words) for this model, identifying patterns (e.g., consistent overprediction) and suggesting improvements based on data.
Output a JSON object with:

accuracy: Score (0.0–1.0).
error: Absolute difference.
feedback: Constructive feedback for the model.

Output Format:
json{
  "accuracy": <number, 0.0–1.0>,
  "error": <number>,
  "feedback": "<string, 50–150 words>"
}`;

export const INDICATORS_CATEGORIZED: Record<string, string[]> = {
  'Growth & Production': ['GDP Growth Rate', 'Industrial Production', 'Manufacturing PMI', 'Services PMI'],
  'Labor Market': ['Unemployment Rate', 'Labor Force Participation Rate', 'Wage Growth'],
  'Prices & Inflation': ['Inflation Rate', 'Producer Price Index (PPI)', 'Core Inflation Rate'],
  'Financial Markets': ['Interest Rate', 'Stock Market Index', 'Government Bond Yield', 'Corporate Bond Spread'],
  'Consumer Activity': ['Consumer Confidence', 'Retail Sales', 'Household Savings Rate'],
  'Trade & External Sector': ['Balance of Trade', 'Current Account Balance', 'Foreign Direct Investment (FDI)'],
};

export const INDICATORS = Object.values(INDICATORS_CATEGORIZED).flat();

export const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan',
  'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi',
  'Cabo Verde', 'Cambodia', 'Cameroon', 'Canada', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo, Democratic Republic of the', 'Congo, Republic of the', 'Costa Rica', "Cote d'Ivoire", 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic',
  'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic',
  'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia',
  'Fiji', 'Finland', 'France',
  'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana',
  'Haiti', 'Honduras', 'Hungary',
  'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy',
  'Jamaica', 'Japan', 'Jordan',
  'Kazakhstan', 'Kenya', 'Kiribati', 'Kuwait', 'Kyrgyzstan',
  "Laos", 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg',
  'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar',
  'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway',
  'Oman',
  'Pakistan', 'Palau', 'Palestine State', 'Panama', 'Papua new Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal',
  'Qatar',
  'Romania', 'Russia', 'Rwanda',
  'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria',
  'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu',
  'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan',
  'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam',
  'Yemen',
  'Zambia', 'Zimbabwe'
];

export const INDICATOR_TO_CATEGORY_MAP: Record<string, string> = {
  // Growth & Production
  'GDP Growth Rate': 'gdp',
  'Industrial Production': 'gdp',
  'Manufacturing PMI': 'business',
  'Services PMI': 'business',
  // Labor Market
  'Unemployment Rate': 'labour',
  'Labor Force Participation Rate': 'labour',
  'Wage Growth': 'labour',
  // Prices & Inflation
  'Inflation Rate': 'inflation',
  'Producer Price Index (PPI)': 'inflation',
  'Core Inflation Rate': 'inflation',
  // Financial Markets
  'Interest Rate': 'money',
  'Stock Market Index': 'markets',
  'Government Bond Yield': 'government',
  'Corporate Bond Spread': 'markets',
  // Consumer Activity
  'Consumer Confidence': 'consumer',
  'Retail Sales': 'consumer',
  'Household Savings Rate': 'consumer',
  // Trade & External Sector
  'Balance of Trade': 'trade',
  'Current Account Balance': 'trade',
  'Foreign Direct Investment (FDI)': 'trade',
};

// The minimum percentage of ticks a model must successfully predict to be included in the final results.
export const PARTICIPATION_THRESHOLD = 80;