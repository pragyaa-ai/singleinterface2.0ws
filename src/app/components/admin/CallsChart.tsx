'use client';

import React, { useState, useEffect } from 'react';

interface CallData {
  date: string;
  total: number;
  successful: number;
  partial: number;
  failed: number;
}

export default function CallsChart() {
  const [data, setData] = useState<CallData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<'total' | 'successful' | 'partial' | 'failed'>('total');

  useEffect(() => {
    fetchChartData();
  }, []);

  const fetchChartData = async () => {
    try {
      const response = await fetch('/api/admin/analytics/chart');
      if (response.ok) {
        const chartData = await response.json();
        setData(chartData);
      }
    } catch (error) {
      console.error('Failed to fetch chart data:', error);
      // Mock data for development
      setData(generateMockData());
    } finally {
      setLoading(false);
    }
  };

  const generateMockData = (): CallData[] => {
    const today = new Date();
    const data: CallData[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      const total = Math.floor(Math.random() * 50) + 20;
      const successful = Math.floor(total * 0.7);
      const partial = Math.floor(total * 0.2);
      const failed = total - successful - partial;
      
      data.push({
        date: date.toISOString().split('T')[0],
        total,
        successful,
        partial,
        failed
      });
    }
    
    return data;
  };

  const getMaxValue = () => {
    return Math.max(...data.map(d => d[selectedMetric]));
  };

  const getBarColor = (metric: string) => {
    switch (metric) {
      case 'total':
        return 'bg-blue-500';
      case 'successful':
        return 'bg-green-500';
      case 'partial':
        return 'bg-yellow-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const maxValue = getMaxValue();

  return (
    <div className="space-y-4">
      {/* Metric Selector */}
      <div className="flex space-x-2">
        {[
          { key: 'total', label: 'Total', color: 'blue' },
          { key: 'successful', label: 'Successful', color: 'green' },
          { key: 'partial', label: 'Partial', color: 'yellow' },
          { key: 'failed', label: 'Failed', color: 'red' }
        ].map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setSelectedMetric(key as any)}
            className={`
              px-3 py-1 text-xs font-medium rounded-full transition-colors
              ${selectedMetric === key
                ? `bg-${color}-100 text-${color}-800 border border-${color}-200`
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }
            `}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="relative h-48">
        <div className="flex items-end justify-between h-full space-x-2">
          {data.map((item, index) => {
            const height = maxValue > 0 ? (item[selectedMetric] / maxValue) * 100 : 0;
            
            return (
              <div key={index} className="flex-1 flex flex-col items-center">
                {/* Bar */}
                <div className="relative w-full flex items-end justify-center" style={{ height: '160px' }}>
                  <div
                    className={`
                      w-full max-w-8 rounded-t transition-all duration-300 hover:opacity-80 cursor-pointer
                      ${getBarColor(selectedMetric)}
                    `}
                    style={{ height: `${height}%` }}
                    title={`${formatDate(item.date)}: ${item[selectedMetric]} calls`}
                  >
                    {/* Value label on hover */}
                    <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-600 opacity-0 hover:opacity-100 transition-opacity">
                      {item[selectedMetric]}
                    </div>
                  </div>
                </div>
                
                {/* Date label */}
                <div className="mt-2 text-xs text-gray-500 text-center">
                  {formatDate(item.date)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 pt-4 border-t border-gray-200">
        <div className="text-center">
          <div className="text-lg font-semibold text-blue-600">
            {data.reduce((sum, item) => sum + item.total, 0)}
          </div>
          <div className="text-xs text-gray-500">Total Calls</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-green-600">
            {data.reduce((sum, item) => sum + item.successful, 0)}
          </div>
          <div className="text-xs text-gray-500">Successful</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-yellow-600">
            {data.reduce((sum, item) => sum + item.partial, 0)}
          </div>
          <div className="text-xs text-gray-500">Partial</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-red-600">
            {data.reduce((sum, item) => sum + item.failed, 0)}
          </div>
          <div className="text-xs text-gray-500">Failed</div>
        </div>
      </div>
    </div>
  );
}

