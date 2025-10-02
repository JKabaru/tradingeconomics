import React, { useRef, useEffect } from 'react';
import { Page } from '../types';
import { 
    Bars3Icon, ChevronLeftIcon, TableCellsIcon, 
    CpuChipIcon, GlobeAltIcon, CalendarIcon, CogIcon, DocumentTextIcon, 
    CloudArrowDownIcon, CheckCircleIcon 
} from './IconComponents';

interface HeaderProps {
  currentPage: Page;
  onMenuClick: () => void;
  wizard?: {
    started: boolean;
    step: number;
    setStep: (step: number) => void;
    validationStatus: { [key: number]: boolean };
  };
}

const wizardSteps = [
  { name: 'Data Sources', icon: <TableCellsIcon className="w-6 h-6" /> },
  { name: 'LLMs', icon: <CpuChipIcon className="w-6 h-6" /> },
  { name: 'Scope', icon: <GlobeAltIcon className="w-6 h-6" /> },
  { name: 'Timeframe', icon: <CalendarIcon className="w-6 h-6" /> },
  { name: 'Loop Settings', icon: <CogIcon className="w-6 h-6" /> },
  { name: 'Review', icon: <DocumentTextIcon className="w-6 h-6" /> },
  { name: 'Verify Data', icon: <CloudArrowDownIcon className="w-6 h-6" /> }
];

const WizardStepper: React.FC<{ wizard: NonNullable<HeaderProps['wizard']> }> = ({ wizard }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      const activeStepElement = scrollContainerRef.current.querySelector(`[data-step-index='${wizard.step}']`);
      if (activeStepElement) {
        activeStepElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
  }, [wizard.step]);

  return (
    <div className="flex-1 flex items-center min-w-0">
      <button
        onClick={() => wizard.setStep(0)}
        aria-label="Back to configuration start"
        className="flex items-center text-theme-text-secondary hover:text-white transition-colors mr-2 pr-2 lg:mr-4 lg:pr-4 border-r border-theme-border"
      >
        <ChevronLeftIcon className="w-5 h-5" />
        <span className="hidden sm:inline ml-1 font-semibold text-sm">Exit Setup</span>
      </button>
      <div ref={scrollContainerRef} className="flex-1 overflow-x-auto no-scrollbar">
        <div className="flex items-center p-2 min-w-max">
          {wizardSteps.map((step, index) => {
            const stepIndex = index + 1;
            const isCompleted = stepIndex < wizard.step && wizard.validationStatus[stepIndex];
            const isActive = stepIndex === wizard.step;
            const isPrevStepComplete = (stepIndex - 1) < wizard.step && wizard.validationStatus[stepIndex - 1];

            return (
              <React.Fragment key={step.name}>
                {index > 0 && (
                  <div
                    className={`flex-grow h-1 transition-colors duration-500 rounded mx-1 sm:mx-2 w-8 sm:w-12 md:w-16 ${
                      isPrevStepComplete ? 'bg-theme-accent' : 'bg-gray-700'
                    }`}
                  />
                )}
                <div 
                  className="flex flex-col items-center flex-shrink-0" 
                  style={{ perspective: '1000px' }}
                  data-step-index={stepIndex}
                >
                  <button
                    onClick={() => wizard.setStep(stepIndex)}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 transform ${
                      isActive ? 'bg-theme-accent scale-110 shadow-lg' : isCompleted ? 'bg-theme-success' : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                    aria-current={isActive ? 'step' : undefined}
                  >
                    {isCompleted ? <CheckCircleIcon className="w-7 h-7 text-white" /> : React.cloneElement(step.icon, { className: 'w-6 h-6 text-white' })}
                  </button>
                  <span className={`mt-2 text-xs text-center font-medium transition-colors duration-300 w-20 ${
                    isActive ? 'text-theme-accent' : isCompleted ? 'text-white' : 'text-theme-text-secondary'
                  }`}>
                    {step.name}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};


export const Header: React.FC<HeaderProps> = ({ currentPage, onMenuClick, wizard }) => {
  return (
    <header className="h-20 bg-theme-surface flex items-center justify-between px-4 sm:px-8 border-b border-theme-border flex-shrink-0">
      <div className="flex items-center flex-1 min-w-0">
        <button 
          onClick={onMenuClick}
          className="lg:hidden text-theme-text-secondary hover:text-white mr-4"
          aria-label="Open menu"
        >
          <Bars3Icon className="w-6 h-6" />
        </button>
        {currentPage === Page.SETUP && wizard?.started ? (
          <WizardStepper wizard={wizard} />
        ) : (
          <h2 className="text-2xl font-semibold text-white truncate">{currentPage}</h2>
        )}
      </div>
    </header>
  );
};