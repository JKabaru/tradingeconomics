import React from 'react';
import type { Run } from '../types';
import { ClockIcon, TrashIcon } from './IconComponents';

interface PastResultsViewProps {
    runs: Run[];
    onViewRun: (runId: string) => void;
    onDeleteRun: (runId: string) => void;
}

const RunCard: React.FC<{ run: Run; onViewRun: (id: string) => void; onDeleteRun: (id: string) => void; }> = ({ run, onViewRun, onDeleteRun }) => {
    const { config, results, timestamp } = run;

    const configSummary = `${config.countries.join(', ')} / ${config.indicators.join(', ')}`;

    return (
        <div className="bg-theme-background p-5 rounded-lg border border-theme-border flex flex-col justify-between hover:border-theme-accent transition-colors duration-300 shadow-lg">
            <div>
                <p className="text-xs text-theme-text-secondary mb-2">
                    {new Date(timestamp).toLocaleString()}
                </p>
                <p className="text-sm font-medium text-white truncate" title={configSummary}>
                    {configSummary}
                </p>
                <div className="my-4 text-center">
                    <p className="text-xs text-theme-text-secondary">Composite Score</p>
                    <p className="text-4xl font-bold text-theme-accent">{results.compositeScore.toFixed(2)}</p>
                </div>
            </div>
            <div className="flex items-center justify-between mt-4 border-t border-theme-border pt-4">
                <button 
                    onClick={() => onViewRun(run.id)} 
                    className="px-4 py-2 bg-gray-700 text-white text-sm font-semibold rounded-lg hover:bg-gray-600 transition-colors w-full mr-2"
                >
                    View Details
                </button>
                <button 
                    onClick={() => onDeleteRun(run.id)} 
                    className="p-2 bg-theme-destructive/20 text-theme-destructive rounded-lg hover:bg-theme-destructive/40 transition-colors"
                    aria-label="Delete run"
                >
                    <TrashIcon className="w-5 h-5"/>
                </button>
            </div>
        </div>
    );
};

export const CommunityView: React.FC<PastResultsViewProps> = ({ runs, onViewRun, onDeleteRun }) => {
  return (
    <div className="bg-theme-surface p-6 sm:p-8 rounded-xl shadow-2xl border border-theme-border">
      <h2 className="text-3xl font-bold text-white mb-6">Run History</h2>
      {runs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {runs.map(run => (
                <RunCard key={run.id} run={run} onViewRun={onViewRun} onDeleteRun={onDeleteRun} />
            ))}
        </div>
      ) : (
        <div className="text-center py-16 border-2 border-dashed border-theme-border rounded-lg">
            <ClockIcon className="w-16 h-16 mx-auto text-theme-text-secondary" />
            <h3 className="mt-4 text-xl font-semibold text-white">No Past Runs Found</h3>
            <p className="mt-2 text-theme-text-secondary">Complete a backtest in the Setup tab to see your results here.</p>
        </div>
      )}
    </div>
  );
};