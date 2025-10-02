
import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ChartComponentProps {
  data: any[];
  lines: { dataKey: string; color: string }[];
}

export const ChartComponent: React.FC<ChartComponentProps> = ({ data, lines }) => {
  return (
    <div className="bg-theme-surface p-6 rounded-xl shadow-2xl h-96 w-full border border-theme-border">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#424242" />
          <XAxis dataKey="date" stroke="#B0B0B0" />
          <YAxis stroke="#B0B0B0" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e1e1e',
              border: '1px solid #424242',
              borderRadius: '0.5rem',
            }}
            labelStyle={{ color: '#E0E0E0' }}
          />
          <Legend wrapperStyle={{ color: '#B0B0B0' }} />
          {lines.map(line => (
             <Line 
                key={line.dataKey}
                type="monotone" 
                dataKey={line.dataKey} 
                stroke={line.color}
                strokeWidth={line.dataKey === 'Actual' ? 3 : 2}
                dot={false}
                activeDot={{ r: 6 }}
              />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
