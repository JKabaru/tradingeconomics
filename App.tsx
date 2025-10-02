

import React, { useState, useCallback, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { SetupWizard } from './components/SetupWizard';
import { ResultsView } from './components/ResultsView';
import { CommunityView } from './components/CommunityView';
import { ConfirmModal } from './components/ConfirmModal';
import type { Configuration, Run, Tick, BacktestResults } from './types';
import { Page } from './types';
import { runBacktest } from './services/backtestService';

const Toast: React.FC<{ message: string; type: 'success' | 'error' }> = ({ message, type }) => (
  <div className={`fixed bottom-5 right-5 ${type === 'success' ? 'bg-theme-success' : 'bg-theme-destructive'} text-white py-2 px-4 rounded-lg shadow-lg z-50 animate-fade-in-out border border-theme-border`}>
    {message}
    <style>{`
      @keyframes fade-in-out {
        0% { opacity: 0; transform: translateY(20px); }
        10% { opacity: 1; transform: translateY(0); }
        90% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(20px); }
      }
      .animate-fade-in-out {
        animation: fade-in-out 3s ease-in-out forwards;
      }
    `}</style>
  </div>
);

const emptyResults: BacktestResults = {
    compositeScore: 0,
    overallDirectionalAccuracy: 0,
    overallMagnitudeRmse: 0,
    overallAvgConfidence: 0,
    topPerformers: [],
    excludedModels: [],
};

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.SETUP);
  const [configurations, setConfigurations] = useState<Configuration[]>([]);
  const [activeRun, setActiveRun] = useState<Run | null>(null);
  const [pastRuns, setPastRuns] = useState<Run[]>([]);
  const [wizardKey, setWizardKey] = useState(Date.now());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    confirmText: 'Confirm',
    cancelText: 'Cancel',
  });
  
  const [wizardValidationStatus, setWizardValidationStatus] = useState<{ [key: number]: boolean }>({});

  useEffect(() => {
    try {
        const savedRuns = localStorage.getItem('nakly-past-runs');
        if (savedRuns) {
            const parsedRuns: Run[] = JSON.parse(savedRuns).map((run: any) => ({
                ...run,
                timestamp: new Date(run.timestamp),
                config: {
                    ...run.config,
                    timeframe: {
                        start: new Date(run.config.timeframe.start),
                        end: new Date(run.config.timeframe.end)
                    }
                }
            }));
            setPastRuns(parsedRuns);
        }
    } catch (error) {
        console.error("Failed to load past runs from localStorage", error);
        setToast({ message: "Could not load run history.", type: 'error' });
    }
  }, []);

  useEffect(() => {
    if (toast) {
        const timer = setTimeout(() => {
            setToast(null);
        }, 3000);
        return () => clearTimeout(timer);
    }
  }, [toast]);

  // Lifted state for SetupWizard
  const getInitialWizardState = () => {
    try {
      const saved = localStorage.getItem('nakly-wizard-state');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          started: parsed.wizardStarted || false,
          step: parsed.step || 1,
        };
      }
    } catch {
      // ignore parsing errors
    }
    return { started: false, step: 1 };
  };

  const [wizardStarted, setWizardStarted] = useState<boolean>(getInitialWizardState().started);
  const [wizardStep, setWizardStep] = useState<number>(getInitialWizardState().step);

  const handleWizardNavigation = (step: number) => {
    setWizardStarted(step !== 0);
    if (step === 0) {
      // Allow returning to the start screen without resetting the step progress
      // This keeps the context of where the user was.
      return; 
    }
    setWizardStep(step);
  };
  
  const startNewWizardSession = useCallback(() => {
    console.log('Starting a new, clean wizard session.');
    setIsResetting(true);
    try {
      localStorage.removeItem('nakly-wizard-state');
      
      setWizardKey(Date.now()); 
      setWizardStep(1); 
      setWizardStarted(true);
      
      setToast({ message: "New configuration started.", type: 'success' });
    } catch (error) {
        console.error("Failed to start new session:", error);
        setToast({ message: "Error: Could not start new session.", type: 'error' });
    } finally {
        setIsResetting(false);
    }
  }, []);

  const handleStartFreshSession = useCallback(() => {
    startNewWizardSession();
  }, [startNewWizardSession]);

  const discardUnsavedSessionLogic = useCallback(() => {
    console.log('User confirmed discard. Proceeding with session reset.');
    setIsResetting(true);
    try {
      console.log('Clearing session progress and data cache from localStorage...');
      localStorage.removeItem('nakly-wizard-state');
      localStorage.removeItem('nakly-data-cache');
      console.log('localStorage for session cleared.');

      console.log('Resetting application state...');
      setConfigurations([]);
      setActiveRun(null);
      
      setWizardKey(Date.now()); 
      setWizardStep(1); 
      setWizardStarted(true);
      console.log('Wizard state reset and started.');

      setToast({ message: "Session has been discarded.", type: 'success' });
    } catch (error) {
        console.error("Failed to reset session:", error);
        setToast({ message: "Error: Could not reset session.", type: 'error' });
    } finally {
        console.log('Reset process finished.');
        setIsResetting(false);
    }
  }, []);

  const handleDiscardAndStartNewSession = useCallback((isEditingSavedConfig: boolean) => {
    console.log(`"Start New" button clicked. Is editing a saved config: ${isEditingSavedConfig}`);
    if (isResetting) {
        console.log('Action already in progress. Aborting.');
        return;
    }

    if (isEditingSavedConfig) {
      console.log('Abandoning edits on a saved config to start a new one.');
      startNewWizardSession();
    } else {
      console.log('Unsaved progress detected. Opening confirmation modal.');
      setModalState({
          isOpen: true,
          title: 'Discard Progress?',
          message: 'Starting a new configuration will clear your current unsaved progress. This action cannot be undone.',
          onConfirm: discardUnsavedSessionLogic,
          confirmText: "Discard & Continue",
          cancelText: "Keep Editing",
      });
    }
  }, [isResetting, discardUnsavedSessionLogic, startNewWizardSession]);


  const handleConfigSave = useCallback(async (config: Configuration, apiKeys: Record<string, string>) => {
    const newConfig = { ...config, id: `config-${Date.now()}` };
    setConfigurations(prev => [...prev, newConfig]);
    
    const allTicks: Tick[] = [];
    if (newConfig.verificationData) {
        Object.values(newConfig.verificationData).forEach(result => {
            if (result.status === 'success' && result.tickData) {
                allTicks.push(...result.tickData);
            }
        });
    }
    allTicks.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (allTicks.length < 2) {
        setToast({ message: "Not enough data to run a backtest. At least 2 data points are required.", type: 'error' });
        return;
    }

    // Create a run object with 'running' state to show loading screen
    const runningRun: Run = {
      id: `run-${Date.now()}`,
      configId: newConfig.id,
      config: newConfig,
      timestamp: new Date(),
      state: 'running',
      results: emptyResults,
    };
    setActiveRun(runningRun);
    setCurrentPage(Page.RESULTS);
    
    // Reset wizard state and clear cache for the next run
    setWizardStarted(false);
    setWizardStep(1);
    localStorage.removeItem('nakly-wizard-state');
    setWizardKey(Date.now());
    
    // Run the backtest asynchronously
    try {
      const { results, tickResults } = await runBacktest(newConfig, allTicks, apiKeys);
      
      const completedRun = {
        ...runningRun,
        state: 'completed' as const,
        results: results,
        tickResults: tickResults,
      };
      setActiveRun(completedRun);
      setToast({ message: "Backtest completed!", type: 'success' });

      setPastRuns(prevRuns => {
          const updatedRuns = [completedRun, ...prevRuns];
          try {
              localStorage.setItem('nakly-past-runs', JSON.stringify(updatedRuns));
          } catch (error) {
              console.error("Failed to save run to localStorage", error);
              setToast({ message: "Could not save run to history.", type: 'error' });
          }
          return updatedRuns;
      });

    } catch (error) {
        console.error("Backtest failed:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        setToast({ message: `Backtest failed: ${errorMessage}`, type: 'error' });
        
        // Set run to a completed state with zeroed results to stop loading and show it failed
        setActiveRun(prev => prev ? { 
            ...prev, 
            state: 'completed', 
            results: emptyResults,
            tickResults: [],
            errors: { 'System Error': errorMessage },
        } : null);
    }
  }, []);

  const handleViewPastRun = useCallback((runId: string) => {
    const runToView = pastRuns.find(run => run.id === runId);
    if (runToView) {
        setActiveRun(runToView);
        setCurrentPage(Page.RESULTS);
    } else {
        setToast({ message: 'Could not find the selected run.', type: 'error' });
    }
  }, [pastRuns]);

  const handleDeleteRun = useCallback((runId: string) => {
    setModalState({
        isOpen: true,
        title: 'Delete Run?',
        message: 'Are you sure you want to delete this backtest result? This action cannot be undone.',
        onConfirm: () => {
            setPastRuns(prevRuns => {
                const updatedRuns = prevRuns.filter(run => run.id !== runId);
                try {
                    localStorage.setItem('nakly-past-runs', JSON.stringify(updatedRuns));
                    setToast({ message: 'Run deleted from history.', type: 'success' });
                    if (activeRun?.id === runId) {
                        setActiveRun(null);
                    }
                } catch (error) {
                    console.error("Failed to delete run from localStorage", error);
                    setToast({ message: 'Failed to delete run.', type: 'error' });
                }
                return updatedRuns;
            });
        },
        confirmText: 'Delete',
        cancelText: 'Cancel',
    });
  }, [activeRun?.id]);

  const renderPage = () => {
    switch (currentPage) {
      case Page.SETUP:
        return (
          <div className="p-4 sm:p-6 lg:p-8">
            <SetupWizard
              key={wizardKey}
              onSave={handleConfigSave}
              step={wizardStep}
              setStep={setWizardStep}
              started={wizardStarted}
              setStarted={setWizardStarted}
              onStartFreshSession={handleStartFreshSession}
              onDiscardAndStartNewSession={handleDiscardAndStartNewSession}
              isResetting={isResetting}
              onValidationChange={setWizardValidationStatus}
              setToast={setToast}
              setModalState={setModalState}
            />
          </div>
        );
      case Page.RESULTS:
        return (
          <div className="p-4 sm:p-6 lg:p-8">
            {activeRun ? <ResultsView run={activeRun} /> : <div className="text-center text-theme-text-secondary">No active run. Please create a configuration first.</div>}
          </div>
        );
      case Page.HISTORY:
        return (
          <div className="p-4 sm:p-6 lg:p-8">
            <CommunityView runs={pastRuns} onViewRun={handleViewPastRun} onDeleteRun={handleDeleteRun} />
          </div>
        );
      default:
        return (
          <div className="p-4 sm:p-6 lg:p-8">
            <SetupWizard
              key={wizardKey}
              onSave={handleConfigSave}
              step={wizardStep}
              setStep={setWizardStep}
              started={wizardStarted}
              setStarted={setWizardStarted}
              onStartFreshSession={handleStartFreshSession}
              onDiscardAndStartNewSession={handleDiscardAndStartNewSession}
              isResetting={isResetting}
              onValidationChange={setWizardValidationStatus}
              setToast={setToast}
              setModalState={setModalState}
            />
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-theme-background font-sans">
      <Sidebar 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage} 
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          currentPage={currentPage}
          onMenuClick={() => setSidebarOpen(true)}
          wizard={{
            started: wizardStarted,
            step: wizardStep,
            setStep: handleWizardNavigation,
            validationStatus: wizardValidationStatus,
          }}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-theme-background">
          {renderPage()}
        </main>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} />}
      <ConfirmModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        onConfirm={modalState.onConfirm}
        title={modalState.title}
        message={modalState.message}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
      />
    </div>
  );
};

export default App;