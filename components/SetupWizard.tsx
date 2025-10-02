

import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { Configuration, TradingEconomicsHistoricalData, TradingEconomicsPeer, VerificationResult, VerificationStatus, Tick, NormalizedModel } from '../types';
import { DATA_SOURCES, LLM_PROVIDERS, INDICATORS_CATEGORIZED, COUNTRIES, STATIC_NORMALIZED_MODELS, DEFAULT_FORECAST_PROMPT, DEFAULT_JUDGE_PROMPT, LLM_PROVIDERS_NO_KEY } from '../constants';
import { TradingEconomicsClient } from '../services/tradingEconomicsService';
import { validateLlmProvider } from '../services/llmService';
import { ChevronLeftIcon, ChevronRightIcon, CheckCircleIcon, XCircleIcon, KeyIcon, ChevronDownIcon, GlobeAltIcon, ChartBarIcon, CpuChipIcon, CalendarIcon, CloudArrowDownIcon, DocumentTextIcon, ArrowPathIcon, CogIcon, PencilIcon, EllipsisHorizontalIcon, TableCellsIcon, ScaleIcon, TrashIcon, DocumentMagnifyingGlassIcon, CreditCardIcon, InformationCircleIcon, WarningIcon } from './IconComponents';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SetupWizardProps {
  onSave: (config: Configuration, apiKeys: Record<string, string>) => void;
  step: number;
  setStep: (step: number) => void;
  started: boolean;
  setStarted: (started: boolean) => void;
  onStartFreshSession: () => void;
  onDiscardAndStartNewSession: (isEditingSaved: boolean) => void;
  isResetting?: boolean;
  onValidationChange: (status: { [key: number]: boolean }) => void;
  setToast: (toast: { message: string; type: 'success' | 'error' } | null) => void;
  setModalState: (modalState: {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
  }) => void;
}

const WIZARD_CACHE_KEY = 'nakly-wizard-state';
const SAVED_CONFIGS_KEY = 'nakly-saved-configs';
const NAKLY_DATA_CACHE_KEY = 'nakly-data-cache';

const initialConfigState: Omit<Configuration, 'id' | 'verificationData'> = {
  dataSources: [],
  llmSelections: {},
  indicators: [],
  countries: [],
  timeframe: {
    start: new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
    end: new Date(),
  },
  judgeModel: '',
  forecastPrompt: DEFAULT_FORECAST_PROMPT,
  judgePrompt: DEFAULT_JUDGE_PROMPT,
  feedbackLimit: 10,
  simulationOptions: {
    maxPredictions: 100,
    skipPredictedTicks: true,
  },
};

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';
type PriceFilter = 'all' | 'free' | 'paid';

const ModelTag: React.FC<{ icon: React.ReactNode; text: string; colorClass: string; }> = ({ icon, text, colorClass }) => (
    <div className={`flex items-center text-xs px-2 py-1 rounded-full ${colorClass}`}>
        {icon}
        <span className="ml-1.5 font-medium">{text}</span>
    </div>
);

const ModelListItem: React.FC<{ model: NormalizedModel; isSelected: boolean; onSelect: () => void; }> = ({ model, isSelected, onSelect }) => {
    const formatContext = (context: number) => {
        if (context >= 1000000) return `${(context / 1000000).toFixed(1)}M`;
        if (context >= 1000) return `${Math.round(context / 1000)}k`;
        return context;
    };

    return (
        <div className={`group relative p-3 rounded-lg transition-all duration-200 border-2 ${isSelected ? 'bg-theme-accent/20 border-theme-accent' : 'bg-gray-800 border-transparent hover:border-theme-accent/50'} ${!model.compatibility.allowed ? 'opacity-50' : 'cursor-pointer'}`}>
            <label className={`flex items-center justify-between space-x-3 ${model.compatibility.allowed ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center">
                        <p className="text-white font-semibold truncate flex-shrink-0">{model.name}</p>
                        {!model.compatibility.allowed && (
                            <div className="relative ml-2">
                                <InformationCircleIcon className="w-5 h-5 text-yellow-400" />
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 p-2 bg-black text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                    {model.compatibility.reasonIfBlocked}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center space-x-2 mt-2">
                         <ModelTag icon={<DocumentTextIcon className="w-3 h-3" />} text={model.modality} colorClass="bg-blue-900/50 text-blue-300" />
                         <ModelTag icon={<DocumentMagnifyingGlassIcon className="w-3 h-3" />} text={`${formatContext(model.context)} Tokens`} colorClass="bg-purple-900/50 text-purple-300" />
                         <ModelTag icon={<CreditCardIcon className="w-3 h-3" />} text={model.pricing.free ? 'Free' : 'Paid'} colorClass={model.pricing.free ? "bg-green-900/50 text-green-300" : "bg-red-900/50 text-red-300"} />
                    </div>
                </div>
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={onSelect}
                    disabled={!model.compatibility.allowed}
                    className="form-checkbox h-5 w-5 bg-gray-700 border-gray-600 rounded text-theme-accent focus:ring-theme-accent disabled:cursor-not-allowed disabled:opacity-50"
                />
            </label>
        </div>
    );
};

const ConnectionStep = ({ title, description, options, onSelect, expandedOptions, apiKeys, onApiKeyChange, connectionStatuses, onConnect, onDisconnect, modelsByOption, selectedModels, onModelSelect, connectionErrorMessages, apiKeyRequiredProviders, priceFilter, onPriceFilterChange }: {
    title: string;
    description: string;
    options: string[];
    onSelect: (val: string) => void;
    expandedOptions: string[];
    apiKeys: Record<string, string>;
    onApiKeyChange: (source: string, key: string) => void;
    connectionStatuses: Record<string, ConnectionStatus>;
    onConnect: (source: string) => void;
    onDisconnect: (source: string) => void;
    modelsByOption?: Record<string, NormalizedModel[]>;
    selectedModels?: Record<string, string[]>;
    onModelSelect?: (option: string, modelId: string) => void;
    connectionErrorMessages: Record<string, string>;
    apiKeyRequiredProviders?: string[];
    priceFilter?: PriceFilter;
    onPriceFilterChange?: (filter: PriceFilter) => void;
}) => {
    const [modelSearch, setModelSearch] = useState('');

    return (
    <div>
        <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
        <p className="text-theme-text-secondary mb-6">{description}</p>
        <div className="space-y-4">
            {options.map(opt => {
                const isExpanded = expandedOptions.includes(opt);
                const status = connectionStatuses[opt];
                const currentSelectedModels = selectedModels ? selectedModels[opt] || [] : [];
                const errorMessage = connectionErrorMessages[opt];
                const isConnected = status === 'connected';
                const apiKeyRequired = !apiKeyRequiredProviders || apiKeyRequiredProviders.includes(opt);

                // FIX: Model grouping and filtering logic moved inside the map loop.
                // This ensures that we only process models for the *current* provider (`opt`),
                // preventing models from one provider (e.g., OpenRouter) from appearing under another (e.g., Google Gemini).
                const groupedAndFilteredModels = (() => {
                    if (!modelsByOption || !modelsByOption[opt]) return {};
                    
                    const grouped: Record<string, NormalizedModel[]> = {};
                    const modelsForThisProvider: NormalizedModel[] = modelsByOption[opt] || [];

                    modelsForThisProvider
                        .filter(model => {
                            if (!priceFilter || !onPriceFilterChange) return true;
                            if (priceFilter === 'free') return model.pricing.free;
                            if (priceFilter === 'paid') return !model.pricing.free;
                            return true; // 'all'
                        })
                        .filter(model => {
                            return model.name.toLowerCase().includes(modelSearch.toLowerCase()) || model.id.toLowerCase().includes(modelSearch.toLowerCase());
                        })
                        .forEach(model => {
                            if (!grouped[model.sourceProvider]) {
                                grouped[model.sourceProvider] = [];
                            }
                            grouped[model.sourceProvider].push(model);
                        });

                    Object.values(grouped).forEach(list => list.sort((a, b) => a.name.localeCompare(b.name)));

                    return grouped;
                })();


                return (
                    <div key={opt} className={`p-4 rounded-lg transition-all duration-300 border ${isExpanded ? 'bg-black/20 border-theme-border' : 'bg-theme-surface border-theme-border'}`}>
                        <button onClick={() => onSelect(opt)} className="w-full text-left flex justify-between items-center">
                            <span className="font-medium text-white text-lg">{opt}</span>
                            <div className="flex items-center space-x-2">
                                {status === 'connected' && <CheckCircleIcon className="w-6 h-6 text-theme-success" />}
                                {status === 'error' && <XCircleIcon className="w-6 h-6 text-theme-destructive" />}
                                {status === 'connecting' && <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>}
                                <ChevronDownIcon className={`w-5 h-5 text-theme-text-secondary transition-transform duration-200 ${isExpanded ? 'transform rotate-180' : ''}`} />
                            </div>
                        </button>

                        {isExpanded && (
                            <div className="mt-4 pt-4 border-t border-theme-border space-y-3 animate-fade-in">
                                {apiKeyRequired ? (
                                    <>
                                        <label className="flex items-center text-sm font-medium text-theme-text-secondary">
                                            <KeyIcon className="w-4 h-4 mr-2"/> API Key
                                        </label>
                                        {isConnected ? (
                                            <div className="flex items-center justify-between bg-gray-900/50 p-3 rounded-lg">
                                                <div className="flex items-center">
                                                    <CheckCircleIcon className="w-6 h-6 text-theme-success mr-3" />
                                                    <span className="font-medium text-white">Connection Established</span>
                                                </div>
                                                <button
                                                    onClick={() => onDisconnect(opt)}
                                                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors font-semibold flex items-center text-sm"
                                                >
                                                    <PencilIcon className="w-4 h-4 mr-2" /> Change
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3">
                                                <input
                                                    id={`${opt}-key`}
                                                    type="password"
                                                    placeholder="Enter your API key"
                                                    value={apiKeys[opt] || ''}
                                                    onChange={(e) => onApiKeyChange(opt, e.target.value)}
                                                    className="w-full sm:flex-grow bg-gray-800 text-white p-2 rounded-lg border border-theme-border focus:ring-2 focus:ring-theme-accent focus:border-theme-accent disabled:opacity-50"
                                                    disabled={status === 'connecting'}
                                                />
                                                <button
                                                    onClick={() => onConnect(opt)}
                                                    disabled={status === 'connecting' || !apiKeys[opt]}
                                                    className="w-full sm:w-auto px-4 py-2 bg-theme-accent text-white rounded-lg hover:bg-theme-accent-hover disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors font-semibold"
                                                >
                                                    {status === 'connecting' ? 'Connecting...' : 'Connect'}
                                                </button>
                                            </div>
                                        )}
                                        {status === 'error' && <p className="text-red-400 text-xs mt-1">{errorMessage || 'Connection failed. Please check your API key and try again.'}</p>}
                                    </>
                                ) : (
                                    <div className="flex items-center bg-gray-900/50 p-3 rounded-lg">
                                        <CheckCircleIcon className="w-6 h-6 text-theme-success mr-3" />
                                        <span className="font-medium text-white">No API Key Required</span>
                                    </div>
                                )}
                                
                                {isConnected && modelsByOption && onModelSelect && (
                                    <div className="mt-4 pt-4 border-t border-theme-border">
                                        <h4 className="text-md font-semibold text-white mb-3">Select Models</h4>
                                          <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
                                            <input
                                                type="text"
                                                placeholder="Search models..."
                                                value={modelSearch}
                                                onChange={(e) => setModelSearch(e.target.value)}
                                                className="w-full sm:w-1/2 bg-gray-800 text-white px-3 py-2 rounded-md border border-theme-border focus:outline-none focus:ring-1 focus:ring-theme-accent"
                                            />
                                            {priceFilter && onPriceFilterChange && (
                                              <div className="flex items-center space-x-1 p-1 bg-gray-900/50 rounded-lg">
                                                  {(['all', 'free', 'paid'] as PriceFilter[]).map(filter => (
                                                      <button 
                                                          key={filter}
                                                          onClick={() => onPriceFilterChange(filter)}
                                                          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${priceFilter === filter ? 'bg-theme-accent text-white' : 'text-theme-text-secondary hover:bg-gray-700'}`}
                                                      >
                                                          {filter.charAt(0).toUpperCase() + filter.slice(1)}
                                                      </button>
                                                  ))}
                                              </div>
                                            )}
                                          </div>
                                        <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                                            {Object.entries(groupedAndFilteredModels).length > 0 ? (
                                                Object.entries(groupedAndFilteredModels).sort(([a], [b]) => a.localeCompare(b)).map(([sourceProvider, modelList]) => (
                                                    <div key={sourceProvider}>
                                                        <h5 className="font-bold text-theme-text-secondary text-sm uppercase px-1 py-1">{sourceProvider}</h5>
                                                        <div className="space-y-2">
                                                            {Array.isArray(modelList) && modelList.map(model => (
                                                                <ModelListItem
                                                                    key={model.id}
                                                                    model={model}
                                                                    isSelected={currentSelectedModels.includes(model.id)}
                                                                    onSelect={() => onModelSelect(opt, model.id)}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-theme-text-secondary text-sm text-center py-4">No models found for this provider{modelSearch && ' matching your search'}.</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
        <style>{`.animate-fade-in { animation: fadeIn 0.5s ease-in-out; } @keyframes fadeIn { 0% { opacity: 0; transform: translateY(-10px); } 100% { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
)};

const DropdownMultiSelect = ({ title, options, selected, onSelect, categorized = false, searchable = false }: {
    title: string;
    options: string[] | Record<string, string[]>;
    selected: string[];
    onSelect: (value: string) => void;
    categorized?: boolean;
    searchable?: boolean;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const allOptions = useMemo(() => Array.isArray(options) ? options : Object.values(options).flat(), [options]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    
    const displayValue = () => {
        if (selected.length === 0) {
            return `Select ${title}...`;
        }
        if (selected.length <= 2) {
            return selected.join(', ');
        }
        return `${selected.slice(0, 2).join(', ')}, +${selected.length - 2} more`;
    };

    const renderOptions = () => {
        const renderItem = (item: string) => (
            <label key={item} className="flex items-center space-x-3 p-2 rounded-md hover:bg-white/10 cursor-pointer">
                <input
                    type="checkbox"
                    checked={selected.includes(item)}
                    onChange={() => onSelect(item)}
                    className="form-checkbox h-5 w-5 bg-gray-700 border-theme-border rounded text-theme-accent focus:ring-theme-accent"
                />
                <span className="text-theme-text-primary text-sm font-medium">{item}</span>
            </label>
        );
        
        const filteredSelectedItems = selected
            .filter(item => item.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort();

        const hasUnselectedMatches = allOptions.some(item => 
            !selected.includes(item) && item.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        const renderUnselected = () => {
            if (categorized && typeof options === 'object' && !Array.isArray(options)) {
                 const categoriesWithUnselectedItems = Object.entries(options)
                    .map(([category, items]) => {
                        const unselectedItems = items
                            .filter(item => !selected.includes(item))
                            .filter(item => item.toLowerCase().includes(searchTerm.toLowerCase()));
                        return { category, items: unselectedItems };
                    })
                    .filter(group => group.items.length > 0);

                return categoriesWithUnselectedItems.map(({ category, items }) => (
                    <div key={category} className="mb-2">
                        <h4 className="font-bold text-theme-text-secondary text-xs uppercase px-2 py-1">{category}</h4>
                        {items.sort().map(renderItem)}
                    </div>
                ));
            }

            if (Array.isArray(options)) {
                return options
                    .filter(item => !selected.includes(item))
                    .filter(item => item.toLowerCase().includes(searchTerm.toLowerCase()))
                    .sort()
                    .map(renderItem);
            }
            return null;
        };

        return (
             <>
                {filteredSelectedItems.length > 0 && (
                    <div className="space-y-1">
                        {filteredSelectedItems.map(renderItem)}
                    </div>
                )}
                {filteredSelectedItems.length > 0 && hasUnselectedMatches && (
                    <hr className="my-2 border-theme-border" />
                )}
                <div className="space-y-1">
                    {renderUnselected()}
                </div>
            </>
        );
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <label className="block text-sm font-medium text-theme-text-secondary mb-1">{title}</label>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center bg-gray-800 text-white p-3 rounded-lg border border-theme-border focus:outline-none focus:ring-2 focus:ring-theme-accent"
            >
                <span className={`truncate pr-2 ${selected.length > 0 ? 'text-theme-text-primary' : 'text-theme-text-secondary'}`}>
                    {displayValue()}
                </span>
                <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'transform rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-10 top-full mt-2 w-full bg-theme-surface border border-theme-border rounded-lg shadow-xl p-2 max-h-80 overflow-y-auto no-scrollbar">
                    {searchable && (
                         <input
                            type="text"
                            placeholder={`Search ${title}...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-800 text-white px-3 py-2 mb-2 rounded-md border border-theme-border focus:outline-none focus:ring-1 focus:ring-theme-accent"
                        />
                    )}
                    {renderOptions()}
                </div>
            )}
        </div>
    );
};


export const SetupWizard: React.FC<SetupWizardProps> = ({ onSave, step, setStep, started, setStarted, onStartFreshSession, onDiscardAndStartNewSession, isResetting = false, onValidationChange, setToast, setModalState }) => {
  const cachedState = useMemo(() => {
    try {
        const saved = localStorage.getItem(WIZARD_CACHE_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  }, []);

  const [config, setConfig] = useState<Omit<Configuration, 'id' | 'verificationData'>>(() => {
    if (cachedState?.config) {
        const parsed = cachedState.config;
        // Revive dates from string format
        parsed.timeframe.start = new Date(parsed.timeframe.start);
        parsed.timeframe.end = new Date(parsed.timeframe.end);
         // Ensure llmSelections is an object, preventing issues if cache is malformed
        if (!parsed.llmSelections) {
          parsed.llmSelections = {};
        }
        return { ...initialConfigState, ...parsed };
    }
    return initialConfigState;
  });
  
  const [expandedDataSources, setExpandedDataSources] = useState<string[]>([]);
  const [expandedLlmProviders, setExpandedLlmProviders] = useState<string[]>([]);

  const [dataSourceApiKeys, setDataSourceApiKeys] = useState<Record<string, string>>(() => {
    try {
        const savedKeys = localStorage.getItem('nakly-dataSourceApiKeys');
        return savedKeys ? JSON.parse(savedKeys) : {};
    } catch (error) {
        console.error("Failed to parse dataSourceApiKeys from localStorage", error);
        return {};
    }
  });

  const [dataSourceConnectionStatuses, setDataSourceConnectionStatuses] = useState<Record<string, ConnectionStatus>>(() => {
    if (cachedState?.dataSourceConnectionStatuses) {
        const statuses = cachedState.dataSourceConnectionStatuses;
        Object.keys(statuses).forEach(k => { if (statuses[k] === 'connecting') statuses[k] = 'idle'; });
        return statuses;
    }
    try {
        const savedKeys = JSON.parse(localStorage.getItem('nakly-dataSourceApiKeys') || '{}');
        const initialStatuses: Record<string, ConnectionStatus> = {};
        DATA_SOURCES.forEach(ds => {
            initialStatuses[ds] = savedKeys[ds] ? 'connected' : 'idle';
        });
        return initialStatuses;
    } catch {
        return Object.fromEntries(DATA_SOURCES.map(ds => [ds, 'idle']));
    }
  });
  
  const [llmApiKeys, setLlmApiKeys] = useState<Record<string, string>>(() => {
    try {
        const savedKeys = localStorage.getItem('nakly-llmApiKeys');
        return savedKeys ? JSON.parse(savedKeys) : {};
    } catch (error) {
        console.error("Failed to parse llmApiKeys from localStorage", error);
        return {};
    }
  });

  const [llmConnectionStatuses, setLlmConnectionStatuses] = useState<Record<string, ConnectionStatus>>(() => {
    if (cachedState?.llmConnectionStatuses) {
        const statuses = cachedState.llmConnectionStatuses;
        Object.keys(statuses).forEach(k => { if (statuses[k] === 'connecting') statuses[k] = 'idle'; });
        return statuses;
    }
    try {
        const savedKeys = JSON.parse(localStorage.getItem('nakly-llmApiKeys') || '{}');
        const initialStatuses: Record<string, ConnectionStatus> = {};
        LLM_PROVIDERS.forEach(provider => {
            initialStatuses[provider] = savedKeys[provider] ? 'connected' : 'idle';
        });
        return initialStatuses;
    } catch {
        return Object.fromEntries(LLM_PROVIDERS.map(p => [p, 'idle']));
    }
  });
  
  const [connectionErrorMessages, setConnectionErrorMessages] = useState<Record<string, string>>({});
  const [savedConfigs, setSavedConfigs] = useState<Record<string, Omit<Configuration, 'id' | 'userId'>>>({});
  const [activeConfigName, setActiveConfigName] = useState(() => cachedState?.activeConfigName || 'New Configuration');
  const [selectedConfigToLoad, setSelectedConfigToLoad] = useState('New Configuration');
  const [configSaveName, setConfigSaveName] = useState('');
  
  const [isDiscoveringPeers, setIsDiscoveringPeers] = useState(false);
  const [verificationResults, setVerificationResults] = useState<Record<string, VerificationResult>>({});
  
  const [dataCache, setDataCache] = useState<Record<string, VerificationResult>>({});
  const prevConfigScopeRef = useRef<string>();

  const [dynamicModels, setDynamicModels] = useState<Record<string, NormalizedModel[]>>({});
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');

  const allAvailableModels = useMemo(() => {
      const allModels: Record<string, NormalizedModel[]> = {};
       Object.entries(dynamicModels).forEach(([provider, models]) => {
           if (Array.isArray(models)) {
             allModels[provider] = models;
           }
       });
      return allModels;
  }, [dynamicModels]);
  
  const totalSteps = 7;

  useEffect(() => {
    try {
        const stored = localStorage.getItem(SAVED_CONFIGS_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Revive dates
            Object.values(parsed).forEach((c: any) => {
                c.timeframe.start = new Date(c.timeframe.start);
                c.timeframe.end = new Date(c.timeframe.end);
            });
            setSavedConfigs(parsed);
        }
    } catch (e) {
        console.error("Failed to load saved configurations", e);
    }

    try {
        const storedCache = localStorage.getItem(NAKLY_DATA_CACHE_KEY);
        if (storedCache) {
            setDataCache(JSON.parse(storedCache));
        }
    } catch(e) {
        console.error("Failed to load data cache", e);
    }
  }, []);

  useEffect(() => {
    try {
        localStorage.setItem('nakly-dataSourceApiKeys', JSON.stringify(dataSourceApiKeys));
    } catch (error) {
        console.error("Failed to save dataSourceApiKeys to localStorage", error);
    }
  }, [dataSourceApiKeys]);

  useEffect(() => {
    try {
        localStorage.setItem('nakly-llmApiKeys', JSON.stringify(llmApiKeys));
    } catch (error) {
        console.error("Failed to save llmApiKeys to localStorage", error);
    }
  }, [llmApiKeys]);

  // Effect to save the entire wizard state to cache
  useEffect(() => {
    // Only save state if the wizard has started to avoid overwriting with defaults
    if (started) {
        try {
            const stateToSave = {
                step,
                config,
                dataSourceConnectionStatuses,
                llmConnectionStatuses,
                wizardStarted: started,
                activeConfigName,
            };
            localStorage.setItem(WIZARD_CACHE_KEY, JSON.stringify(stateToSave));
        } catch (error) {
            console.error("Failed to save wizard state to cache:", error);
        }
    }
  }, [started, step, config, dataSourceConnectionStatuses, llmConnectionStatuses, activeConfigName]);

  useEffect(() => {
    if (activeConfigName !== 'New Configuration') {
        setConfigSaveName(activeConfigName);
    } else {
        setConfigSaveName('');
    }
  }, [activeConfigName]);

  // Effect to invalidate verification data if the scope (countries, indicators, timeframe) changes.
  useEffect(() => {
    const currentScope = JSON.stringify({
        countries: config.countries.sort(),
        indicators: config.indicators.sort(),
        timeframe: config.timeframe,
    });

    // If a previous scope existed and it's different from the current one,
    // it means the user has gone back and changed something. Invalidate prior verification results.
    if (prevConfigScopeRef.current && prevConfigScopeRef.current !== currentScope) {
        setVerificationResults({});
    }

    // Update the ref to the current scope for the next comparison.
    prevConfigScopeRef.current = currentScope;
  }, [config.countries, config.indicators, config.timeframe]);

  const finalConfig = useMemo(() => {
    const connectedDataSources = DATA_SOURCES.filter(ds => dataSourceConnectionStatuses[ds] === 'connected');
    
    const connectedAndSelectedLlms: Record<string, string[]> = {};
    Object.entries(config.llmSelections).forEach(([provider, models]) => {
        if (llmConnectionStatuses[provider] === 'connected' && Array.isArray(models) && models.length > 0) {
            connectedAndSelectedLlms[provider] = models;
        }
    });

    return {
        ...config,
        dataSources: connectedDataSources,
        llmSelections: connectedAndSelectedLlms,
    };
  }, [config, dataSourceConnectionStatuses, llmConnectionStatuses]);

  const handleConnectDataSource = async (dataSource: string) => {
    const apiKey = dataSourceApiKeys[dataSource];
    if (!apiKey) {
      setDataSourceConnectionStatuses(prev => ({ ...prev, [dataSource]: 'error' }));
      setConnectionErrorMessages(prev => ({ ...prev, [dataSource]: 'API Key cannot be empty.' }));
      return;
    }
    setDataSourceConnectionStatuses(prev => ({ ...prev, [dataSource]: 'connecting' }));
    setConnectionErrorMessages(prev => ({ ...prev, [dataSource]: '' }));

    try {
        const client = new TradingEconomicsClient({ apiKey });
        await client.validateApiKey(); // Throws on failure
        setDataSourceConnectionStatuses(prev => ({ ...prev, [dataSource]: 'connected' }));
    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred.';
        setDataSourceConnectionStatuses(prev => ({ ...prev, [dataSource]: 'error' }));
        setConnectionErrorMessages(prev => ({ ...prev, [dataSource]: message }));
    }
  };
  
  const handleDisconnectDataSource = (dataSource: string) => {
    setDataSourceConnectionStatuses(prev => ({ ...prev, [dataSource]: 'idle' }));
  };

  const handleConnectLlmProvider = async (provider: string) => {
    const apiKey = llmApiKeys[provider] || ''; // Use empty string for providers without keys
    
    if (!apiKey && !LLM_PROVIDERS_NO_KEY.includes(provider)) {
      setLlmConnectionStatuses(prev => ({ ...prev, [provider]: 'error' }));
      setConnectionErrorMessages(prev => ({ ...prev, [provider]: 'API Key cannot be empty.' }));
      return;
    }

    setLlmConnectionStatuses(prev => ({ ...prev, [provider]: 'connecting' }));
    setConnectionErrorMessages(prev => ({ ...prev, [provider]: '' }));

    const result = await validateLlmProvider(provider, apiKey);
    
    if (result.isValid) {
        setLlmConnectionStatuses(prev => ({ ...prev, [provider]: 'connected' }));
        // Ensure that an array is always passed for the models, defaulting to an empty array if the response is invalid or missing models.
        setDynamicModels(prev => ({ ...prev, [provider]: Array.isArray(result.models) ? result.models : [] }));
    } else {
        setLlmConnectionStatuses(prev => ({ ...prev, [provider]: 'error' }));
        setConnectionErrorMessages(prev => ({ ...prev, [provider]: result.error || 'Validation failed.' }));
    }
  };
  
  const handleDisconnectLlmProvider = (provider: string) => {
    setLlmConnectionStatuses(prev => ({ ...prev, [provider]: 'idle' }));
    setConfig(prev => {
        const newSelections = { ...prev.llmSelections };
        delete newSelections[provider];
        return { ...prev, llmSelections: newSelections };
    });
    setDynamicModels(prev => {
        const newModels = { ...prev };
        delete newModels[provider];
        return newModels;
    });
  };
  
  const isStep1Valid = Object.values(dataSourceConnectionStatuses).some(status => status === 'connected');
  const isStep2Valid = Object.values(llmConnectionStatuses).some(s => s === 'connected') && Object.values(config.llmSelections).some(models => Array.isArray(models) && models.length > 0);
  const isStep3Valid = config.indicators.length > 0 && config.countries.length > 0;
  const isStep5Valid = !!config.judgeModel;
  const isDataFetchCompleteAndValid = !isDiscoveringPeers && Object.values(verificationResults).some((f: VerificationResult) => f.status === 'success');
  
  const validationStatus = useMemo(() => ({
    1: isStep1Valid,
    2: isStep2Valid,
    3: isStep3Valid,
    4: true, // Timeframe is always "valid"
    5: isStep5Valid,
    6: true, // Review is always "valid"
  }), [isStep1Valid, isStep2Valid, isStep3Valid, isStep5Valid]);

  const isNextButtonDisabled = useMemo(() => {
    // To proceed from the current step, all steps up to and including the current one must be valid.
    for (let i = 1; i <= step; i++) {
      if (!validationStatus[i as keyof typeof validationStatus]) {
        return true; // Disable if any step up to current is invalid
      }
    }
    return false; // Enable if all are valid
  }, [step, validationStatus]);

  useEffect(() => {
    onValidationChange(validationStatus);
  }, [validationStatus, onValidationChange]);


  const handleNext = () => {
    if (step === 6 && Object.keys(verificationResults).length === 0) { 
        initializeVerificationStep();
    }
    setStep(Math.min(step + 1, totalSteps));
  }
  
  const handleBack = () => setStep(Math.max(step - 1, 1));
  
  const handleDataSourceSelect = (value: string) => {
    setExpandedDataSources(prev => prev.includes(value) ? prev.filter(item => item !== value) : [value]);
  };
  
  const handleLlmProviderSelect = (value: string) => {
    setExpandedLlmProviders(prev => prev.includes(value) ? prev.filter(item => item !== value) : [value]);
  };

  const handleLlmModelSelect = (provider: string, modelId: string) => {
    setConfig(prev => {
        const providerModels = prev.llmSelections[provider];
        const currentModels = Array.isArray(providerModels) ? providerModels : [];

        const newModels = currentModels.includes(modelId)
            ? currentModels.filter(m => m !== modelId)
            : [...currentModels, modelId];
        
        const newSelections = { ...prev.llmSelections, [provider]: newModels };

        // If the currently selected judge model is removed, reset it
        if (prev.judgeModel === `${provider}::${modelId}` && !newModels.includes(modelId)) {
            return {...prev, llmSelections: newSelections, judgeModel: ''};
        }

        return {...prev, llmSelections: newSelections};
    });
  };

  const handleMultiSelect = (field: 'indicators' | 'countries', value: string) => {
    setConfig(prev => {
        const currentSelection = field === 'indicators' ? prev.indicators : prev.countries;
        const newSelection = currentSelection.includes(value)
            ? currentSelection.filter(item => item !== value)
            : [...currentSelection, value];
        
        if (field === 'indicators') {
            return { ...prev, indicators: newSelection };
        } else { // countries
            return { ...prev, countries: newSelection };
        }
    });
  };

  const initializeVerificationStep = async () => {
    const keysToDiscover: string[] = [];
    const newResults: Record<string, VerificationResult> = {};

    for (const country of finalConfig.countries) {
      for (const indicator of finalConfig.indicators) {
        const primaryKey = `${country}---${indicator}`;
        const cacheKey = `${primaryKey}::${finalConfig.timeframe.start.toISOString()}::${finalConfig.timeframe.end.toISOString()}`;

        if (dataCache[cacheKey]) {
          newResults[primaryKey] = {
            ...dataCache[cacheKey],
            message: "Loaded from cache.",
          };
        } else {
          keysToDiscover.push(primaryKey);
          newResults[primaryKey] = { primaryKey, status: 'pending' };
        }
      }
    }
    setVerificationResults(newResults);

    if (keysToDiscover.length > 0) {
      await handleDiscoverPeers(keysToDiscover);
    }
  };

  // Effect to auto-initiate verification if we land on step 7 without data (e.g., after loading a config)
  useEffect(() => {
    // The `started` check prevents this from running on initial load before user interaction.
    if (started && step === 7 && Object.keys(verificationResults).length === 0 && (config.countries.length > 0 || config.indicators.length > 0)) {
        initializeVerificationStep();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, started]);


  const handleDiscoverPeers = async (keysToFetch?: string[]) => {
      if (!finalConfig.dataSources.includes('Trading Economics')) {
          setVerificationResults({ 'system-error': { primaryKey: 'system-error', status: 'error', message: "Data verification requires a connected 'Trading Economics' source." } });
          return;
      }

      setIsDiscoveringPeers(true);
      const client = new TradingEconomicsClient({ apiKey: dataSourceApiKeys['Trading Economics'] });
      
      const primaryKeysToProcess = keysToFetch ? keysToFetch : finalConfig.countries.flatMap(c => finalConfig.indicators.map(i => `${c}---${i}`));
      
      for (const primaryKey of primaryKeysToProcess) {
          const [country, indicator] = primaryKey.split('---');
          try {
              setVerificationResults(prev => ({ ...prev, [primaryKey]: { ...prev[primaryKey], status: 'fetching_peers', message: 'Discovering peers...' }}));
              const allPeers = await client.getPeers(country, indicator);
              
              const primaryIndicatorInfo = allPeers.find(p => p.Relationship === -1);
              if (!primaryIndicatorInfo) throw new Error("Primary indicator metadata not found.");

              const primaryFrequency = primaryIndicatorInfo.Frequency || 'Unknown';
              
              setVerificationResults(prev => ({ 
                  ...prev, 
                  [primaryKey]: { 
                      ...prev[primaryKey], 
                      status: 'peers_discovered', 
                      peers: allPeers,
                      primaryFrequency,
                      selectedPeers: [primaryIndicatorInfo.Peer],
                      message: 'Ready for peer selection.'
                  }
              }));

          } catch (error) {
              const message = error instanceof Error ? error.message : 'An unknown error occurred.';
              let finalMessage = message;
              if (message.toLowerCase().includes('api key') || message.toLowerCase().includes('subscription')) {
                  finalMessage = `${message} Please return to the 'Data Sources' step to update your API key.`;
              }
              setVerificationResults(prev => ({ ...prev, [primaryKey]: { ...prev[primaryKey], status: 'error', message: finalMessage }}));
          }
      }
      setIsDiscoveringPeers(false);
  };
  
  const handlePeerSelection = (primaryKey: string, peerSymbol: string) => {
      setVerificationResults(prev => {
          const currentResult = prev[primaryKey];
          if (!currentResult?.selectedPeers) return prev;
          
          const newSelected = currentResult.selectedPeers.includes(peerSymbol)
            ? currentResult.selectedPeers.filter(s => s !== peerSymbol)
            : [...currentResult.selectedPeers, peerSymbol];

          if (currentResult.status === 'success') {
              return {
                  ...prev,
                  [primaryKey]: {
                      ...currentResult,
                      selectedPeers: newSelected,
                      status: 'peers_discovered',
                      consolidatedData: undefined,
                      message: 'Peer selection updated. Refetch to visualize new data.'
                  }
              };
          }
            
          return { ...prev, [primaryKey]: { ...currentResult, selectedPeers: newSelected }};
      });
  };

  const handleFetchConsolidatedData = async (primaryKey: string) => {
      const result = verificationResults[primaryKey];
      if (!result?.peers || !result.selectedPeers) return;
      
      const [country] = primaryKey.split('---');

      setVerificationResults(prev => ({ ...prev, [primaryKey]: { ...prev[primaryKey], status: 'fetching_data', message: 'Fetching selected data...' }}));

      const client = new TradingEconomicsClient({ apiKey: dataSourceApiKeys['Trading Economics']! });
      const startDate = finalConfig.timeframe.start.toISOString().split('T')[0];
      const endDate = finalConfig.timeframe.end.toISOString().split('T')[0];

      try {
          const seriesToFetch = result.peers
              .filter(p => result.selectedPeers!.includes(p.Peer))
              .map(p => ({ title: p.Title, indicatorName: p.Category, symbol: p.Peer }));

          const dataPromises = seriesToFetch.map(s => 
              client.getHistoricalData(country, s.indicatorName, startDate, endDate)
                  .then(data => ({ title: s.title, data }))
                  .catch(() => ({ title: s.title, data: [] }))
          );
          
          const fetchedSeries = await Promise.all(dataPromises);

          const dateValueMap: { [date: string]: { [title: string]: number | null } } = {};
          const allIndicatorTitles = seriesToFetch.map(s => s.title);

          fetchedSeries.forEach(series => {
              if (series.data && series.data.length > 0) {
                  series.data.forEach(point => {
                      const date = new Date(point.DateTime).toISOString().split('T')[0];
                      if (!dateValueMap[date]) dateValueMap[date] = {};
                      dateValueMap[date][series.title] = point.Value;
                  });
              }
          });

          const sortedDates = Object.keys(dateValueMap).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

          const consolidatedData = sortedDates.map(date => {
              const row: Record<string, any> = { date };
              allIndicatorTitles.forEach(title => {
                  row[title] = dateValueMap[date]?.[title] ?? null;
              });
              return row;
          });

          const filteredConsolidatedData = consolidatedData.filter(row => {
              const indicatorValues = allIndicatorTitles.map(title => row[title]);
              return indicatorValues.some(value => value !== null && value !== 0);
          });

          if (filteredConsolidatedData.length === 0) {
              throw new Error("No valid data found. All fetched data points were either zero or null.");
          }
          
          // Prepare tick data for the simulation loop
          const [, indicator] = primaryKey.split('---');
          const primaryPeer = result.peers.find(p => p.Relationship === -1);
          const selectedPeerDetails = result.peers.filter(p => result.selectedPeers!.includes(p.Peer) && p.Relationship !== -1);
          
          const tickData: Tick[] = filteredConsolidatedData.map(row => {
              const primaryValue = row[primaryPeer!.Title] ?? null;
              const peerValues = selectedPeerDetails.map(peer => ({
                  title: peer.Title,
                  value: row[peer.Title] ?? null,
                  unit: peer.Unit,
                  relationship: peer.Relationship
              }));

              return {
                  date: row.date,
                  country: country,
                  indicator: indicator,
                  primary: {
                      title: primaryPeer!.Title,
                      value: primaryValue,
                      unit: primaryPeer!.Unit
                  },
                  peers: peerValues
              };
          });

          setVerificationResults(prev => {
              const successfulResult: VerificationResult = { 
                  ...prev[primaryKey], 
                  status: 'success', 
                  consolidatedData: filteredConsolidatedData,
                  tickData: tickData,
                  message: `Successfully fetched and consolidated data.` 
              };
              
              const cacheKey = `${primaryKey}::${finalConfig.timeframe.start.toISOString()}::${finalConfig.timeframe.end.toISOString()}`;
              const newCache = { ...dataCache, [cacheKey]: successfulResult };
              setDataCache(newCache);
              localStorage.setItem(NAKLY_DATA_CACHE_KEY, JSON.stringify(newCache));
              
              return { ...prev, [primaryKey]: successfulResult };
          });
      
      } catch (error) {
          const message = error instanceof Error ? error.message : 'An unknown error occurred.';
          setVerificationResults(prev => ({ ...prev, [primaryKey]: { ...prev[primaryKey], status: 'error', message }}));
      }
  };
  
  const handleRefetch = (primaryKey: string) => {
    const refetchLogic = () => {
        const cacheKey = `${primaryKey}::${finalConfig.timeframe.start.toISOString()}::${finalConfig.timeframe.end.toISOString()}`;
        const newCache = { ...dataCache };
        delete newCache[cacheKey];
        setDataCache(newCache);
        localStorage.setItem(NAKLY_DATA_CACHE_KEY, JSON.stringify(newCache));
        
        setVerificationResults(prev => ({
          ...prev,
          [primaryKey]: { primaryKey, status: 'pending', message: 'Re-fetching...' }
        }));
        
        handleDiscoverPeers([primaryKey]);
    };

    if (verificationResults[primaryKey]?.status !== 'error') {
      setModalState({
        isOpen: true,
        title: 'Re-fetch Data?',
        message: 'This will clear cached data for this item and re-fetch from the source. Continue?',
        onConfirm: refetchLogic,
        confirmText: 'Re-fetch',
        cancelText: 'Cancel'
      });
    } else {
        refetchLogic();
    }
  };

  const removeCountryFromConfig = (countryToRemove: string) => {
    // 1. Update config state
    setConfig(prev => ({
        ...prev,
        countries: prev.countries.filter(c => c !== countryToRemove)
    }));

    // 2. Update verification results state
    setVerificationResults(prev => {
        const newResults = { ...prev };
        Object.keys(newResults).forEach(key => {
            if (key.startsWith(`${countryToRemove}---`)) {
                delete newResults[key];
            }
        });
        return newResults;
    });

    // 3. Show toast
    setToast({ message: `Removed '${countryToRemove}' and its indicators from the configuration.`, type: 'success' });
    // 4. Reroute to review step
    setStep(6);
  };

  const removeIndicatorFromConfig = (indicatorToRemove: string) => {
    // 1. Update config state
    setConfig(prev => ({
        ...prev,
        indicators: prev.indicators.filter(i => i !== indicatorToRemove)
    }));

    // 2. Update verification results state
    setVerificationResults(prev => {
        const newResults = { ...prev };
        Object.keys(newResults).forEach(key => {
            if (key.endsWith(`---${indicatorToRemove}`)) {
                delete newResults[key];
            }
        });
        return newResults;
    });

    // 3. Show toast
    setToast({ message: `Removed indicator '${indicatorToRemove}' from the configuration.`, type: 'success' });
    // 4. Reroute to review step
    setStep(6);
  };
    
  const handleRemoveCountry = (primaryKey: string) => {
      const [country] = primaryKey.split('---');
      if (!country) return;

      setModalState({
          isOpen: true,
          title: `Remove Country?`,
          message: `This will remove '${country}' and all of its associated indicators from your current configuration scope. This is useful for removing countries not supported by your API plan.`,
          onConfirm: () => removeCountryFromConfig(country),
          confirmText: 'Remove Country',
          cancelText: 'Cancel'
      });
  };

  const handleRemoveIndicator = (primaryKey: string) => {
    const [, indicator] = primaryKey.split('---');
    if (!indicator) return;

    setModalState({
        isOpen: true,
        title: `Remove Indicator?`,
        message: `This will remove the '${indicator}' indicator from your configuration for all selected countries. This is useful if the indicator isn't supported for one of the countries in your scope.`,
        onConfirm: () => removeIndicatorFromConfig(indicator),
        confirmText: 'Remove Indicator',
        cancelText: 'Cancel'
    });
  };

  const handleSaveConfig = () => {
    const name = configSaveName.trim();
    if (!name) {
        setToast({ message: 'Configuration name cannot be empty.', type: 'error' });
        return;
    }

    const isUpdatingExisting = activeConfigName !== 'New Configuration' && name === activeConfigName;

    const saveLogic = () => {
        const configWithData: Omit<Configuration, 'id'> = {
            ...config,
            verificationData: verificationResults
        };
        const newSavedConfigs = { ...savedConfigs, [name]: configWithData };
        setSavedConfigs(newSavedConfigs);
        localStorage.setItem(SAVED_CONFIGS_KEY, JSON.stringify(newSavedConfigs));
        setActiveConfigName(name);

        setToast({
            message: `Configuration "${name}" ${isUpdatingExisting ? 'updated' : 'saved'} successfully.`,
            type: 'success'
        });
    };

    if (savedConfigs[name] && !isUpdatingExisting) {
        setModalState({
            isOpen: true,
            title: 'Overwrite Configuration?',
            message: `A configuration named "${name}" already exists. Do you want to overwrite it?`,
            onConfirm: saveLogic,
            confirmText: 'Overwrite',
            cancelText: 'Cancel',
        });
    } else {
        saveLogic();
    }
  };

  const handleStartWithLoadedConfig = () => {
    const name = selectedConfigToLoad;
    if (name !== 'New Configuration' && savedConfigs[name]) {
        const loadedConfig = savedConfigs[name] as Configuration;
        const { verificationData, ...restConfig } = loadedConfig;
        
        // Synchronize the scope ref BEFORE setting state. This prevents the useEffect 
        // that watches for scope changes from incorrectly invalidating the verification data 
        // that's about to be loaded.
        prevConfigScopeRef.current = JSON.stringify({
            countries: restConfig.countries.sort(),
            indicators: restConfig.indicators.sort(),
            timeframe: restConfig.timeframe,
        });

        setConfig(restConfig);
        if (verificationData) {
            setVerificationResults(verificationData);
        } else {
            setVerificationResults({});
        }
        
        setActiveConfigName(name);
        setStarted(true);
        setStep(7); // Start from the data verification step
        setToast({ message: `Configuration "${name}" loaded successfully.`, type: 'success' });
    }
  };

  const handleDeleteConfig = () => {
      const nameToDelete = selectedConfigToLoad;
      if (nameToDelete === 'New Configuration') return;

      const deleteLogic = () => {
          const newSavedConfigs = { ...savedConfigs };
          delete newSavedConfigs[nameToDelete];
          setSavedConfigs(newSavedConfigs);
          localStorage.setItem(SAVED_CONFIGS_KEY, JSON.stringify(newSavedConfigs));
          setSelectedConfigToLoad('New Configuration');

          // If the deleted configuration is the one currently active in the wizard,
          // reset the session to prevent continuing with stale data.
          if (nameToDelete === activeConfigName) {
              localStorage.removeItem(WIZARD_CACHE_KEY);
              setConfig(initialConfigState);
              setActiveConfigName('New Configuration');
              setVerificationResults({});
              setToast({ message: `Active configuration "${nameToDelete}" was deleted. Session has been reset.`, type: 'success' });
          } else {
              setToast({ message: `Configuration "${nameToDelete}" deleted.`, type: 'success' });
          }
      };

      setModalState({
          isOpen: true,
          title: 'Delete Configuration?',
          message: `Are you sure you want to delete the "${nameToDelete}" configuration? This action cannot be undone.`,
          onConfirm: deleteLogic,
          confirmText: 'Delete',
          cancelText: 'Cancel'
      });
  };

  const handleContinueEditing = () => {
    setStarted(true);
  };

  const renderStepContent = () => {
    switch(step) {
      case 1:
        return <ConnectionStep 
                    title="Select & Connect Data Sources"
                    description="Select a data source to enter its API key and establish a connection. Saved keys will automatically connect."
                    options={DATA_SOURCES}
                    onSelect={handleDataSourceSelect}
                    expandedOptions={expandedDataSources}
                    apiKeys={dataSourceApiKeys}
                    onApiKeyChange={(source, key) => setDataSourceApiKeys(prev => ({...prev, [source]: key}))}
                    connectionStatuses={dataSourceConnectionStatuses}
                    onConnect={handleConnectDataSource}
                    onDisconnect={handleDisconnectDataSource}
                    connectionErrorMessages={connectionErrorMessages}
                />;
      case 2:
        return <ConnectionStep 
                    title="Connect to LLM Providers"
                    description="Connect with your API keys to access models from providers like Google and OpenRouter."
                    options={LLM_PROVIDERS}
                    onSelect={handleLlmProviderSelect}
                    expandedOptions={expandedLlmProviders}
                    apiKeys={llmApiKeys}
                    onApiKeyChange={(provider, key) => setLlmApiKeys(prev => ({...prev, [provider]: key}))}
                    connectionStatuses={llmConnectionStatuses}
                    onConnect={handleConnectLlmProvider}
                    onDisconnect={handleDisconnectLlmProvider}
                    modelsByOption={allAvailableModels}
                    selectedModels={config.llmSelections}
                    onModelSelect={handleLlmModelSelect}
                    connectionErrorMessages={connectionErrorMessages}
                    apiKeyRequiredProviders={LLM_PROVIDERS.filter(p => !LLM_PROVIDERS_NO_KEY.includes(p))}
                    priceFilter={priceFilter}
                    onPriceFilterChange={setPriceFilter}
                />;
      case 3:
        return (
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">Define Analysis Scope</h3>
            <p className="text-theme-text-secondary mb-6">Choose the economic indicators and countries for your backtest. For each country, the system will also fetch data for its economic peers.</p>
            <div className="bg-yellow-900/30 border border-yellow-700 text-yellow-300 px-4 py-3 rounded-lg text-sm mb-6" role="alert">
                <p><strong className="font-semibold">Note for Trading Economics Users:</strong> Free API keys are limited to specific countries (e.g., Mexico, New Zealand, Sweden, Thailand). Selecting other countries may result in data fetching errors if your plan does not support them.</p>
            </div>
            <div className="space-y-6">
              <DropdownMultiSelect
                title="Economic Indicators"
                options={INDICATORS_CATEGORIZED}
                selected={config.indicators}
                onSelect={(val) => handleMultiSelect('indicators', val)}
                categorized={true}
                searchable={true}
              />
              <DropdownMultiSelect
                title="Countries"
                options={COUNTRIES}
                selected={config.countries}
                onSelect={(val) => handleMultiSelect('countries', val)}
                searchable={true}
              />
            </div>
          </div>
        );
      case 4:
        return <TimeframeStep timeframe={config.timeframe} setTimeframe={(tf) => setConfig(p => ({...p, timeframe: tf}))} />;
      case 5:
        return <LoopSettingsStep config={config} setConfig={setConfig} availableLlms={finalConfig.llmSelections} allModels={allAvailableModels} />;
      case 6:
        return <ReviewStep config={finalConfig} allModels={allAvailableModels} />;
      case 7:
        return <VerifyDataStep 
                    results={verificationResults} 
                    isFetching={isDiscoveringPeers} 
                    onPeerSelect={handlePeerSelection}
                    onFetchConsolidatedData={handleFetchConsolidatedData}
                    onRefetch={handleRefetch}
                    onRemoveCountry={handleRemoveCountry}
                    onRemoveIndicator={handleRemoveIndicator}
                    onGoToScope={() => setStep(3)}
                    configSaveName={configSaveName}
                    setConfigSaveName={setConfigSaveName}
                    onSaveClick={handleSaveConfig}
                    activeConfigName={activeConfigName}
                    config={finalConfig}
                />;
      default: return null;
    }
  }

  const handleFinish = () => {
    if (finalConfig.dataSources.length === 0 || Object.keys(finalConfig.llmSelections).length === 0) {
        setToast({ message: "Cannot create a run without at least one connected data source and one selected LLM model.", type: 'error' });
        return;
    }
     if (finalConfig.indicators.length === 0 || finalConfig.countries.length === 0) {
        setToast({ message: "Please select at least one indicator and one country before finishing.", type: 'error' });
        return;
    }
    if (!isDataFetchCompleteAndValid) {
        setToast({ message: "Please wait for data verification to complete, or ensure at least one data series was successfully fetched.", type: 'error' });
        return;
    }

    const configToSave: Configuration = {
      ...finalConfig,
      verificationData: verificationResults,
      id: '', // will be set in App.tsx
    };

    onSave(configToSave, { ...dataSourceApiKeys, ...llmApiKeys });
  };
  
  if (!started) {
    const hasActiveSession = config.dataSources.length > 0 || Object.keys(config.llmSelections).length > 0 || config.countries.length > 0 || config.indicators.length > 0;
    const isEditingSavedConfig = activeConfigName !== 'New Configuration';

    return (
        <div className="max-w-4xl mx-auto text-center animate-fade-in p-4">
            <h2 className="text-3xl font-bold text-white mb-2">Create New Backtest</h2>
            <p className="text-theme-text-secondary mb-8">Start from scratch, load a saved setup, or continue your last session.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {hasActiveSession ? (
                    <div className="bg-theme-surface border border-theme-border rounded-lg p-6 flex flex-col justify-between">
                         <div>
                            <h3 className="text-xl font-semibold text-white">Unsaved Session</h3>
                            <p className="text-theme-text-secondary mt-2 text-sm">You have unsaved progress. Continue where you left off or discard it to start over.</p>
                         </div>
                        <div className="mt-6">
                            <button
                                onClick={handleContinueEditing}
                                className="w-full mb-3 px-6 py-3 bg-theme-accent text-white font-bold rounded-lg hover:bg-theme-accent-hover transition-all duration-200 text-lg"
                            >
                                Continue Session
                            </button>
                            <button
                                onClick={() => onDiscardAndStartNewSession(isEditingSavedConfig)}
                                disabled={isResetting}
                                className="w-full px-6 py-2 bg-transparent text-theme-text-secondary font-medium rounded-lg hover:bg-white/10 hover:text-white transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-wait"
                            >
                                {isResetting ? 'Starting...' : (isEditingSavedConfig ? 'Start New Configuration' : 'Discard and Start New')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-theme-surface border border-theme-border rounded-lg p-6 flex flex-col justify-between">
                         <div>
                            <h3 className="text-xl font-semibold text-white">Start Fresh</h3>
                            <p className="text-theme-text-secondary mt-2 text-sm">Begin a brand new backtest configuration from the ground up.</p>
                        </div>
                        <button
                            onClick={onStartFreshSession}
                            className="w-full mt-6 px-6 py-3 bg-theme-accent text-white font-bold rounded-lg hover:bg-theme-accent-hover transition-all duration-200 text-lg"
                        >
                            Start a New Configuration
                        </button>
                    </div>
                )}

                <div className="bg-theme-surface border border-theme-border rounded-lg p-6 text-left">
                    <h3 className="text-xl font-semibold text-white mb-4">Load Existing</h3>
                    <p className="text-theme-text-secondary mt-2 mb-4 text-sm">Pick up a previously saved configuration to run or edit.</p>
                    <div className="flex flex-col space-y-4">
                        <select
                            id="config-select"
                            value={selectedConfigToLoad}
                            onChange={(e) => setSelectedConfigToLoad(e.target.value)}
                            className="flex-grow bg-gray-800 text-white p-3 rounded-lg border border-theme-border focus:ring-2 focus:ring-theme-accent"
                        >
                            <option value="New Configuration">-- Select a configuration --</option>
                            {Object.keys(savedConfigs).sort().map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                        <div className="flex space-x-2">
                            <button 
                                onClick={handleStartWithLoadedConfig}
                                disabled={selectedConfigToLoad === 'New Configuration'}
                                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap"
                            >
                                Load
                            </button>
                            <button 
                                onClick={handleDeleteConfig} 
                                disabled={selectedConfigToLoad === 'New Configuration'}
                                className="px-4 py-2 bg-theme-destructive/50 text-white rounded-lg hover:bg-theme-destructive disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                            >
                                <TrashIcon className="w-5 h-5"/>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="relative bg-theme-surface p-4 sm:p-8 rounded-xl shadow-2xl max-w-5xl mx-auto border border-theme-border">
      <div className="mb-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
              {activeConfigName !== 'New Configuration' ? `Editing: ${activeConfigName}` : 'Create New Backtest'}
          </h2>
      </div>

      <div className="min-h-[400px] mt-8">{renderStepContent()}</div>

      <div className="mt-8 flex justify-between items-center border-t border-theme-border pt-6">
        <button
          onClick={handleBack}
          disabled={step === 1}
          className="flex items-center px-4 sm:px-6 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold"
        >
          <ChevronLeftIcon className="w-5 h-5 mr-2" /> Back
        </button>

        {step < totalSteps ? (
          <button 
            onClick={handleNext} 
            disabled={isNextButtonDisabled}
            className="flex items-center px-4 sm:px-6 py-2 bg-theme-accent text-white rounded-lg hover:bg-theme-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold"
          >
            {step === 6 ? 'Verify Data' : 'Next'} <ChevronRightIcon className="w-5 h-5 ml-2" />
          </button>
        ) : (
          <button 
            onClick={handleFinish} 
            disabled={!isDataFetchCompleteAndValid}
            className="flex items-center px-4 sm:px-6 py-2 bg-theme-success rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold text-white"
          >
            <CheckCircleIcon className="w-5 h-5 mr-2" /> Finish & Run
          </button>
        )}
      </div>
    </div>
  );
};

const TimeframeStep = ({timeframe, setTimeframe}: {timeframe: {start: Date, end: Date}, setTimeframe: (tf: {start: Date, end: Date}) => void}) => {
    const handleDateChange = (field: 'start' | 'end', value: string) => {
        setTimeframe({ ...timeframe, [field]: new Date(value)});
    }
    return (
        <div>
            <h3 className="text-xl font-semibold text-white mb-2">Select Timeframe</h3>
            <p className="text-theme-text-secondary mb-6">Define the start and end dates for the historical data to be used in the backtest.</p>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <div className="flex-1">
                    <label htmlFor="start-date" className="block text-sm font-medium text-theme-text-secondary mb-1">Start Date</label>
                    <input type="date" id="start-date" value={timeframe.start.toISOString().split('T')[0]} onChange={e => handleDateChange('start', e.target.value)} className="w-full bg-gray-800 text-white p-2 rounded-lg border border-theme-border focus:ring-2 focus:ring-theme-accent focus:border-theme-accent"/>
                </div>
                <div className="flex-1">
                    <label htmlFor="end-date" className="block text-sm font-medium text-theme-text-secondary mb-1">End Date</label>
                    <input type="date" id="end-date" value={timeframe.end.toISOString().split('T')[0]} onChange={e => handleDateChange('end', e.target.value)} className="w-full bg-gray-800 text-white p-2 rounded-lg border border-theme-border focus:ring-2 focus:ring-theme-accent focus:border-theme-accent"/>
                </div>
            </div>
        </div>
    );
};

const LoopSettingsStep = ({ config, setConfig, availableLlms, allModels }: {
    config: Omit<Configuration, 'id' | 'verificationData'>;
    setConfig: React.Dispatch<React.SetStateAction<Omit<Configuration, 'id' | 'verificationData'>>>;
    availableLlms: Record<string, string[]>;
    allModels: Record<string, NormalizedModel[]>;
}) => {

    const judgeCandidateModels = useMemo(() => {
        const candidates: { provider: string; model: NormalizedModel }[] = [];
        Object.entries(availableLlms).forEach(([provider, modelIds]) => {
            const providerModels = allModels[provider] || [];
            modelIds.forEach(modelId => {
                const modelDetails = providerModels.find(m => m.id === modelId);
                // Only reasoning-capable models can be judges
                if (modelDetails && modelDetails.compatibility.reasoning) {
                    candidates.push({ provider, model: modelDetails });
                }
            });
        });
        return candidates;
    }, [availableLlms, allModels]);


    const handleGenericChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLTextAreaElement | HTMLInputElement>) => {
        const { name, value, type } = e.target;
        
        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            const keys = name.split('.');
            setConfig(prev => {
                const newConfig = {...prev};
                let current: any = newConfig;
                for (let i = 0; i < keys.length - 1; i++) {
                    current = current[keys[i]];
                }
                current[keys[keys.length - 1]] = checked;
                return newConfig;
            });
        } else {
            const keys = name.split('.');
            const parsedValue = type === 'number' ? parseInt(value, 10) || 0 : value;
            if (keys.length > 1) {
                 setConfig(prev => {
                    const newConfig = {...prev};
                    let current: any = newConfig;
                    for (let i = 0; i < keys.length - 1; i++) {
                        current = current[keys[i]];
                    }
                    current[keys[keys.length - 1]] = parsedValue;
                    return newConfig;
                });
            } else {
                setConfig(prev => ({ ...prev, [name]: parsedValue }));
            }
        }
    };

    return (
        <div>
            <h3 className="text-xl font-semibold text-white mb-2">Configure Backtest Loop</h3>
            <p className="text-theme-text-secondary mb-6">Define the models, prompts, and rules for the simulation loop.</p>
            <div className="space-y-6">
                <div>
                    <label htmlFor="judgeModel" className="block text-sm font-medium text-theme-text-secondary mb-1">Judge Model</label>
                    <p className="text-xs text-gray-400 mb-2">Select one of your chosen forecaster models to also act as the judge, providing feedback on all forecasts.</p>
                    <select id="judgeModel" name="judgeModel" value={config.judgeModel} onChange={handleGenericChange} className="w-full bg-gray-800 text-white p-3 rounded-lg border border-theme-border focus:ring-2 focus:ring-theme-accent focus:border-theme-accent">
                        <option value="">-- Select a Judge Model --</option>
                        {judgeCandidateModels.map(({ provider, model }) => (
                            <option key={model.id} value={`${provider}::${model.id}`}>{model.name} ({provider})</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="forecastPrompt" className="block text-sm font-medium text-theme-text-secondary mb-1">Forecast Prompt</label>
                     <p className="text-xs text-gray-400 mb-2">This prompt will be given to forecaster models. It must instruct the model to return a JSON object. Use placeholders like [COUNTRY], [INDICATOR], and [PAST_FEEDBACK] for dynamic data injection.</p>
                    <textarea id="forecastPrompt" name="forecastPrompt" value={config.forecastPrompt} onChange={handleGenericChange} rows={5} className="w-full bg-gray-800 text-white p-2 rounded-lg border border-theme-border focus:ring-2 focus:ring-theme-accent focus:border-theme-accent font-mono text-sm"></textarea>
                </div>
                 <div>
                    <label htmlFor="judgePrompt" className="block text-sm font-medium text-theme-text-secondary mb-1">Judge Prompt</label>
                    <p className="text-xs text-gray-400 mb-2">This prompt will be given to the judge model. It must instruct the model to return a JSON object. Use placeholders like [MODEL_NAME], [PREDICTION], and [ACTUAL_VALUE] for dynamic data injection.</p>
                    <textarea id="judgePrompt" name="judgePrompt" value={config.judgePrompt} onChange={handleGenericChange} rows={5} className="w-full bg-gray-800 text-white p-2 rounded-lg border border-theme-border focus:ring-2 focus:ring-theme-accent focus:border-theme-accent font-mono text-sm"></textarea>
                </div>
                <div>
                    <h4 className="text-lg font-semibold text-white mb-3">Simulation Options</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="feedbackLimit" className="block text-sm font-medium text-theme-text-secondary mb-1">Judge Feedback Lookback</label>
                            <p className="text-xs text-gray-400 mb-2">The number of previous predictions the judge will see.</p>
                            <input type="number" id="feedbackLimit" name="feedbackLimit" value={config.feedbackLimit} onChange={handleGenericChange} className="w-full bg-gray-800 text-white p-2 rounded-lg border border-theme-border focus:ring-2 focus:ring-theme-accent focus:border-theme-accent"/>
                        </div>
                        <div>
                            <label htmlFor="maxPredictions" className="block text-sm font-medium text-theme-text-secondary mb-1">Maximum Predictions</label>
                            <p className="text-xs text-gray-400 mb-2">Limit the total number of forecasts in the simulation.</p>
                            <input type="number" id="maxPredictions" name="simulationOptions.maxPredictions" value={config.simulationOptions.maxPredictions} onChange={handleGenericChange} className="w-full bg-gray-800 text-white p-2 rounded-lg border border-theme-border focus:ring-2 focus:ring-theme-accent focus:border-theme-accent"/>
                        </div>
                         <div className="md:col-span-2 flex items-center mt-2">
                            <input type="checkbox" id="skipPredictedTicks" name="simulationOptions.skipPredictedTicks" checked={config.simulationOptions.skipPredictedTicks} onChange={handleGenericChange} className="form-checkbox h-5 w-5 bg-gray-700 border-theme-border rounded text-theme-accent focus:ring-theme-accent" />
                            <label htmlFor="skipPredictedTicks" className="ml-3 text-sm font-medium text-white">Skip already-predicted ticks</label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


const ReviewListItem = ({ icon, label, children }: { icon: React.ReactNode, label: string, children?: React.ReactNode }) => (
    <div className="flex items-start py-4">
        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-gray-800 rounded-full mr-4">
            {icon}
        </div>
        <div>
            <dt className="text-sm font-medium text-theme-text-secondary">{label}</dt>
            <dd className="mt-1 text-md font-semibold text-white">{children}</dd>
        </div>
    </div>
);


const ReviewStep = ({ config, allModels }: { 
    config: Omit<Configuration, 'id' | 'verificationData'>;
    allModels: Record<string, NormalizedModel[]>;
}) => {
    const getModelNameById = (provider: string, modelId: string) => {
        const providerModels = allModels[provider] || [];
        const model = providerModels.find(m => m.id === modelId);
        return model ? model.name : modelId;
    };

    const llmSummary = Object.entries(config.llmSelections).map(([provider, models]) => (
        <div key={provider} className="mt-2">
            <strong className="font-semibold text-white">{provider}:</strong>
            <p className="text-sm text-theme-text-secondary pl-2">{models.map(id => getModelNameById(provider, id)).join(', ')}</p>
        </div>
    ));

    const renderList = (items: string[]) => {
        if (items.length === 0) return <span className="text-theme-text-secondary italic font-normal">None Selected</span>;
        if (items.length > 5) return `${items.slice(0, 5).join(', ')}, and ${items.length - 5} more...`;
        return items.join(', ');
    };
    
    const judgeModelName = () => {
        if (!config.judgeModel) return <span className="text-theme-text-secondary italic font-normal">Not Selected</span>;
        const [provider, modelId] = config.judgeModel.split('::');
        return getModelNameById(provider, modelId);
    };

    return (
        <div>
            <h3 className="text-2xl font-bold text-white mb-2">Review Configuration</h3>
            <p className="text-theme-text-secondary mb-6">Please confirm the details of your backtest below. Press 'Verify Data' to proceed to the final step.</p>
            <div className="bg-theme-background rounded-lg divide-y divide-theme-border border border-theme-border">
                <dl className="p-2 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8">
                    <ReviewListItem icon={<TableCellsIcon className="w-5 h-5 text-theme-text-secondary"/>} label="Data Sources">
                        {renderList(config.dataSources)}
                    </ReviewListItem>
                    <ReviewListItem icon={<CpuChipIcon className="w-5 h-5 text-theme-text-secondary"/>} label="Forecaster LLMs">
                        {llmSummary.length > 0 ? llmSummary : <span className="text-theme-text-secondary italic font-normal">None Selected</span>}
                    </ReviewListItem>
                     <ReviewListItem icon={<ScaleIcon className="w-5 h-5 text-theme-text-secondary"/>} label="Judge Model">
                        {judgeModelName()}
                    </ReviewListItem>
                    <ReviewListItem icon={<ChartBarIcon className="w-5 h-5 text-theme-text-secondary"/>} label="Indicators">
                        {renderList(config.indicators)}
                    </ReviewListItem>
                    <ReviewListItem icon={<GlobeAltIcon className="w-5 h-5 text-theme-text-secondary"/>} label="Countries">
                        {renderList(config.countries)}
                    </ReviewListItem>
                    <ReviewListItem icon={<CalendarIcon className="w-5 h-5 text-theme-text-secondary"/>} label="Timeframe">
                        {config.timeframe.start.toLocaleDateString()} - {config.timeframe.end.toLocaleDateString()}
                    </ReviewListItem>
                    <ReviewListItem icon={<CogIcon className="w-5 h-5 text-theme-text-secondary"/>} label="Simulation Settings">
                        <ul className="list-disc list-inside text-theme-text-secondary text-sm">
                            <li><span className="text-white font-semibold">Feedback Lookback:</span> {config.feedbackLimit} ticks</li>
                            <li><span className="text-white font-semibold">Max Predictions:</span> {config.simulationOptions.maxPredictions}</li>
                            <li><span className="text-white font-semibold">Skip Predicted Ticks:</span> {config.simulationOptions.skipPredictedTicks ? 'Yes' : 'No'}</li>
                        </ul>
                    </ReviewListItem>
                </dl>
            </div>
        </div>
    );
};

const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
        const value = (hash >> (i * 8)) & 0xFF;
        color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
};

// Custom Tooltip for Chart to show original (non-normalized) values
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="p-2 bg-theme-surface border border-theme-border rounded-lg shadow-lg text-sm">
                <p className="label text-white font-semibold mb-1">{label ? new Date(label).toLocaleDateString() : ''}</p>
                {payload.map((pld: any) => (
                    <div key={pld.dataKey} style={{ color: pld.color }}>
                        {`${pld.name}: ${pld.payload[pld.dataKey + '_original']?.toFixed(2) ?? 'N/A'}`}
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const VerificationResultItem: React.FC<{
    result: VerificationResult;
    onPeerSelect: (primaryKey: string, peerSymbol: string) => void;
    onFetchConsolidatedData: (primaryKey: string) => void;
    onRefetch: (primaryKey: string) => void;
    onRemoveCountry: (primaryKey: string) => void;
    onRemoveIndicator: (primaryKey: string) => void;
    onGoToScope: () => void;
}> = ({ result, onPeerSelect, onFetchConsolidatedData, onRefetch, onRemoveCountry, onRemoveIndicator, onGoToScope }) => {
    const { primaryKey, status, message, peers, primaryFrequency, selectedPeers, consolidatedData } = result;
    
    const primaryIndicator = peers?.find(p => p.Relationship === -1);
    const primaryIndicatorTitle = primaryIndicator?.Title;
    const availablePeers = peers?.filter(p => p.Relationship !== -1 && p.Frequency === primaryFrequency);
    
    const titleToUnitMap = useMemo(() => {
        const map = new Map<string, string>();
        if (peers) {
            peers.forEach(p => map.set(p.Title, p.Unit || ''));
        }
        return map;
    }, [peers]);

    const normalizedChartData = useMemo(() => {
        if (!consolidatedData || consolidatedData.length === 0) return [];
        
        const data = JSON.parse(JSON.stringify(consolidatedData)); // Deep copy to avoid mutating state
        const keys = Object.keys(data[0]).filter(k => k !== 'date');
        
        keys.forEach(key => {
            const values = data.map((d: any) => d[key]).filter((v: any) => v !== null && v !== undefined) as number[];
            if (values.length === 0) return;
            
            const min = Math.min(...values);
            const max = Math.max(...values);
            
            data.forEach((d: any) => {
                d[key + '_original'] = d[key]; // Preserve original value for tooltip
                if (d[key] !== null && d[key] !== undefined) {
                    if (max === min) {
                        d[key] = 50; // Place flat lines in the middle of the chart
                    } else {
                        d[key] = ((d[key] - min) / (max - min)) * 100;
                    }
                }
            });
        });
        return data;
    }, [consolidatedData]);

    const headers = consolidatedData && consolidatedData.length > 0 ? Object.keys(consolidatedData[0]) : [];

    const [country, indicator] = primaryKey.split('---');
    const isIndicatorSpecificError = message?.toLowerCase().includes('primary indicator metadata not found');
    
    return (
        <div className="bg-theme-surface p-4 rounded-lg border border-theme-border">
            <h4 className="font-semibold text-white">{primaryKey.replace('---', ' - ')}</h4>

            {status === 'error' ? (
                 <div className="mt-2 space-y-3">
                    <div className="flex items-start p-3 bg-red-900/30 border border-red-700 rounded-lg">
                        <XCircleIcon className="w-5 h-5 text-red-400 mr-3 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-red-300">Data Fetching Failed</p>
                            <p className="text-sm text-red-400 mt-1">{message}</p>
                        </div>
                    </div>
                    <p className="text-sm text-theme-text-secondary">
                        This often happens due to API plan limitations for the selected country or indicator. Please try an alternative action below.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                        <button onClick={onGoToScope} className="flex items-center px-3 py-1.5 text-sm bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-md transition-colors">
                            <PencilIcon className="w-4 h-4 mr-2" />
                            Change Scope
                        </button>
                        {isIndicatorSpecificError ? (
                             <button onClick={() => onRemoveIndicator(primaryKey)} title={`Remove ${indicator} from the configuration`} className="flex items-center px-3 py-1.5 text-sm bg-theme-destructive/80 hover:bg-theme-destructive text-white font-semibold rounded-md transition-colors">
                                <TrashIcon className="w-4 h-4 mr-2" />
                                Remove Indicator
                            </button>
                        ) : (
                            <button onClick={() => onRemoveCountry(primaryKey)} title={`Remove ${country} and all its indicators from the configuration`} className="flex items-center px-3 py-1.5 text-sm bg-theme-destructive/80 hover:bg-theme-destructive text-white font-semibold rounded-md transition-colors">
                                <TrashIcon className="w-4 h-4 mr-2" />
                                Remove Country
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex justify-between items-center mt-1 flex-wrap">
                    <span className="text-sm text-theme-text-secondary">{message}</span>
                     <div className="flex items-center space-x-2">
                        {status === 'success' && <CheckCircleIcon className="w-5 h-5 text-theme-success" />}
                        {(status === 'fetching_peers' || status === 'fetching_data') && <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>}
                        {status === 'success' && (
                            <button onClick={() => onRefetch(primaryKey)} title="Clear cache and re-fetch" className="text-gray-400 hover:text-white transition-colors">
                                <ArrowPathIcon className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
            )}
            
            {(status === 'peers_discovered' || status === 'success') && primaryIndicator && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                        <h5 className="font-semibold text-white mb-2">Your Selection ({primaryFrequency})</h5>
                        <div className="p-3 bg-gray-800 rounded-md">
                            <label className="flex items-center justify-between space-x-3 cursor-not-allowed">
                                <div className="flex items-center space-x-3">
                                    <input type="checkbox" checked readOnly className="form-checkbox h-5 w-5 bg-gray-600 border-gray-500 rounded text-theme-accent focus:ring-theme-accent" />
                                    <span className="text-white font-medium">{primaryIndicator.Title}</span>
                                    <span className="text-xs text-theme-accent font-bold">(Primary)</span>
                                </div>
                                <span className="text-xs text-theme-text-secondary">{primaryIndicator.Unit}</span>
                            </label>
                        </div>
                    </div>
                    <div>
                        <h5 className="font-semibold text-white mb-2">Available Peers ({primaryFrequency})</h5>
                        <div className="p-3 bg-gray-800 rounded-md max-h-40 overflow-y-auto">
                            {availablePeers?.length > 0 ? availablePeers.map(peer => (
                                <label key={peer.Peer} className="flex items-center justify-between p-1 rounded hover:bg-gray-700 cursor-pointer">
                                    <div className="flex items-center space-x-3">
                                    <input 
                                        type="checkbox" 
                                        className="form-checkbox h-5 w-5 bg-gray-600 border-gray-500 rounded text-theme-accent focus:ring-theme-accent"
                                        checked={selectedPeers?.includes(peer.Peer)}
                                        onChange={() => onPeerSelect(primaryKey, peer.Peer)}
                                    />
                                    <span className="text-white text-sm">{peer.Title}</span>
                                    </div>
                                    <span className="text-xs text-theme-text-secondary">{peer.Unit}</span>
                                </label>
                            )) : <p className="text-sm text-theme-text-secondary">No peers found with matching frequency.</p>}
                        </div>
                    </div>
                    {status === 'peers_discovered' && (
                        <div className="md:col-span-2 text-center mt-2">
                            <button onClick={() => onFetchConsolidatedData(primaryKey)} className="flex items-center justify-center w-full md:w-auto px-4 py-2 bg-theme-accent text-white font-semibold rounded-lg hover:bg-theme-accent-hover transition-colors">
                            <CloudArrowDownIcon className="w-5 h-5 mr-2" /> Fetch & Visualize Data
                            </button>
                        </div>
                    )}
                </div>
            )}

            {status === 'success' && consolidatedData && (
                <div className="mt-4 space-y-4">
                    <div>
                        <h5 className="font-semibold text-white mb-2">Curated Data</h5>
                        <div className="overflow-x-auto max-h-60 border border-theme-border rounded-lg">
                            <table className="w-full text-left text-xs whitespace-nowrap">
                                <thead className="bg-gray-800">
                                    <tr>
                                        {headers.map(h => (
                                            <th key={h} className={`p-2 border-b border-theme-border font-semibold text-theme-text-secondary sticky top-0 bg-gray-800/80 backdrop-blur-sm ${h === primaryIndicatorTitle ? 'text-white' : ''}`}>
                                                {h}{h !== 'date' && titleToUnitMap.get(h) ? ` (${titleToUnitMap.get(h)})` : ''}
                                                {h === primaryIndicatorTitle && <span className="text-xs text-theme-accent ml-1">(Primary)</span>}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="text-white">
                                    {consolidatedData.map((row) => (
                                        <tr key={row.date} className="hover:bg-white/5">
                                            {headers.map(h => (
                                                <td key={h} className={`p-2 border-t border-theme-border ${h === primaryIndicatorTitle ? 'font-semibold text-white bg-black/20' : ''}`}>
                                                    {h === 'date' ? new Date(row[h]).toLocaleDateString() : row[h]}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div>
                        <h5 className="font-semibold text-white mb-2">Visualization (Normalized)</h5>
                        <div className="h-64 w-full bg-gray-800 rounded-lg p-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={normalizedChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#424242" />
                                    <XAxis dataKey="date" stroke="#B0B0B0" tickFormatter={(tick) => new Date(tick).toLocaleDateString('en-US', { month: 'short' })} />
                                    <YAxis stroke="#B0B0B0" domain={[0, 100]} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    {headers.filter(h => h !== 'date').map(key => (
                                        <Line 
                                            key={key} 
                                            type="monotone" 
                                            dataKey={key} 
                                            name={key === primaryIndicatorTitle ? `${key} (Primary)` : key} 
                                            stroke={stringToColor(key)} 
                                            strokeWidth={key === primaryIndicatorTitle ? 3 : 2} 
                                            dot={false} />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

const VerifyDataStep = ({ results, isFetching, onPeerSelect, onFetchConsolidatedData, onRefetch, onRemoveCountry, onRemoveIndicator, onGoToScope, configSaveName, setConfigSaveName, onSaveClick, activeConfigName, config }: { 
    results: Record<string, VerificationResult>, 
    isFetching: boolean,
    onPeerSelect: (primaryKey: string, peerSymbol: string) => void,
    onFetchConsolidatedData: (primaryKey: string) => void,
    onRefetch: (primaryKey: string) => void,
    onRemoveCountry: (primaryKey: string) => void;
    onRemoveIndicator: (primaryKey: string) => void;
    onGoToScope: () => void;
    configSaveName: string;
    setConfigSaveName: (name: string) => void;
    onSaveClick: () => void;
    activeConfigName: string;
    config: Omit<Configuration, 'id' | 'verificationData'>;
}) => {
    const [filterSearchTerm, setFilterSearchTerm] = useState('');
    const [filterCountries, setFilterCountries] = useState<string[]>([]);
    const [filterIndicators, setFilterIndicators] = useState<string[]>([]);
    const [filterStatus, setFilterStatus] = useState('All');

    const resultEntries: VerificationResult[] = useMemo(() => Object.values(results), [results]);

    const filteredResultEntries = useMemo(() => {
        return resultEntries.filter(result => {
            if (filterSearchTerm && !result.primaryKey.toLowerCase().includes(filterSearchTerm.toLowerCase())) {
                return false;
            }

            const keyParts = result.primaryKey.split('---');
            if (keyParts.length === 2) {
                const [country, indicator] = keyParts;
                if (filterCountries.length > 0 && !filterCountries.includes(country)) {
                    return false;
                }
                if (filterIndicators.length > 0 && !filterIndicators.includes(indicator)) {
                    return false;
                }
            } else {
                // This is not a standard country---indicator key (e.g., 'system-error').
                // Hide it if country or indicator filters are active, as they won't match.
                if (filterCountries.length > 0 || filterIndicators.length > 0) {
                    return false;
                }
            }

            if (filterStatus !== 'All') {
                if (filterStatus === 'Success' && result.status !== 'success') return false;
                if (filterStatus === 'Error' && result.status !== 'error') return false;
                if (filterStatus === 'Action Required' && !['pending', 'fetching_peers', 'peers_discovered', 'fetching_data'].includes(result.status)) return false;
            }

            return true;
        });
    }, [resultEntries, filterSearchTerm, filterCountries, filterIndicators, filterStatus]);

    const clearFilters = () => {
        setFilterSearchTerm('');
        setFilterCountries([]);
        setFilterIndicators([]);
        setFilterStatus('All');
    };

    const areFiltersActive = filterSearchTerm || filterCountries.length > 0 || filterIndicators.length > 0 || filterStatus !== 'All';

    const total = resultEntries.length;
    const completed = resultEntries.filter((r: VerificationResult) => ['peers_discovered', 'success', 'error'].includes(r.status)).length;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    const isDataFetchCompleteAndValid = !isFetching && resultEntries.some(r => r.status === 'success');
    
    if (total === 0 && !isFetching) {
      return <p className="text-theme-text-secondary text-center py-4">Waiting to start peer discovery...</p>
    }
    
    const isEditing = activeConfigName !== 'New Configuration';

    return (
        <div>
            <h3 className="text-2xl font-bold text-white mb-2">Verify Data & Select Peers</h3>
            <p className="text-theme-text-secondary mb-6">
                {isFetching ? 'Discovering peer indicators for all selections...' : `Discovery complete. Configure each item below.`}
            </p>
            
            <div className="w-full bg-gray-800 rounded-full h-2.5 mb-4">
                <div className="bg-theme-accent h-2.5 rounded-full" style={{ width: `${progress}%`, transition: 'width 0.5s ease-in-out' }}></div>
            </div>

            <div className="bg-black/20 rounded-lg p-4 mb-4 border border-theme-border">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div className="lg:col-span-2">
                        <label htmlFor="filter-search" className="block text-sm font-medium text-theme-text-secondary mb-1">Search</label>
                        <input
                            id="filter-search"
                            type="text"
                            placeholder="e.g., United States GDP..."
                            value={filterSearchTerm}
                            onChange={(e) => setFilterSearchTerm(e.target.value)}
                            className="w-full bg-gray-800 text-white p-2 rounded-lg border border-theme-border focus:ring-2 focus:ring-theme-accent focus:border-theme-accent"
                        />
                    </div>
                    {/* These dropdowns are not styled correctly in the original code, using custom component instead */}
                    <div className="relative">
                        <DropdownMultiSelect
                            title="Countries"
                            options={config.countries.sort()}
                            selected={filterCountries}
                            onSelect={(val) => setFilterCountries(prev => prev.includes(val) ? prev.filter(c => c !== val) : [...prev, val])}
                            searchable={true}
                        />
                    </div>
                    <div className="relative">
                       <DropdownMultiSelect
                            title="Indicators"
                            options={config.indicators.sort()}
                            selected={filterIndicators}
                            onSelect={(val) => setFilterIndicators(prev => prev.includes(val) ? prev.filter(i => i !== val) : [...prev, val])}
                            searchable={true}
                        />
                    </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-theme-text-secondary mr-2">Status:</span>
                    {['All', 'Success', 'Error', 'Action Required'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                                filterStatus === status
                                    ? 'bg-theme-accent text-white'
                                    : 'bg-gray-700 text-theme-text-secondary hover:bg-gray-600'
                            }`}
                        >
                            {status}
                        </button>
                    ))}
                    {areFiltersActive && (
                        <button onClick={clearFilters} className="ml-auto text-sm text-theme-accent hover:underline">Clear Filters</button>
                    )}
                </div>
            </div>

            <div className="bg-black/20 rounded-lg p-4 max-h-[500px] overflow-y-auto space-y-4 border border-theme-border">
                {filteredResultEntries.length > 0 ? (
                    filteredResultEntries.map(result => (
                        <VerificationResultItem 
                            key={result.primaryKey}
                            result={result}
                            onPeerSelect={onPeerSelect}
                            onFetchConsolidatedData={onFetchConsolidatedData}
                            onRefetch={onRefetch}
                            onRemoveCountry={onRemoveCountry}
                            onRemoveIndicator={onRemoveIndicator}
                            onGoToScope={onGoToScope}
                        />
                    ))
                ) : (
                    <div className="text-center py-10">
                        <p className="text-lg font-semibold text-white">No Items Found</p>
                        <p className="text-theme-text-secondary mt-2">
                            {areFiltersActive
                                ? "No items match your current filter criteria."
                                : "There are no data items to verify for your current configuration."
                            }
                        </p>
                        {areFiltersActive && (
                            <button
                                onClick={clearFilters}
                                className="mt-4 px-4 py-2 bg-theme-accent rounded-lg hover:bg-theme-accent-hover transition-colors"
                            >
                                Clear All Filters
                            </button>
                        )}
                    </div>
                )}
            </div>
            {isDataFetchCompleteAndValid && (
                <div className="mt-8 pt-6 border-t border-theme-border">
                    <h4 className="text-lg font-semibold text-white mb-3">
                        {isEditing ? 'Update or Save as New' : 'Save for Later (Optional)'}
                    </h4>
                    <p className="text-theme-text-secondary text-sm mb-4">
                        {isEditing 
                            ? `You are editing "${activeConfigName}". To save changes (including fetched data), click "Update". To save as a new configuration, change the name below.`
                            : 'Save this entire setup, including the fetched data, to quickly load it again in the future.'
                        }
                    </p>
                    <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3">
                        <input
                            type="text"
                            placeholder="Configuration Name (e.g., 'Q1 GDP Test')"
                            value={configSaveName}
                            onChange={(e) => setConfigSaveName(e.target.value)}
                            className="w-full sm:flex-grow bg-gray-800 text-white p-2 rounded-lg border border-theme-border focus:ring-2 focus:ring-theme-accent focus:border-theme-accent"
                        />
                        <button
                            onClick={onSaveClick}
                            disabled={!configSaveName.trim()}
                            className="w-full sm:w-auto px-4 py-2 bg-theme-accent text-white rounded-lg hover:bg-theme-accent-hover disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors font-medium"
                        >
                            {isEditing && configSaveName === activeConfigName ? 'Update Configuration' : 'Save Configuration'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};