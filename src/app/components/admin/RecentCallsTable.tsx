'use client';

import React, { useState, useEffect } from 'react';

interface CallRecord {
  id: string;
  call_ref_id: string;
  date_time: string;
  duration: number;
  status: 'complete' | 'partial' | 'failed' | 'no_data';
  customer_name?: string;
  car_model?: string;
  email?: string;
  model_used: 'VoiceAgent Mini' | 'VoiceAgent Full';
}

export default function RecentCallsTable() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentCalls();
  }, []);

  const fetchRecentCalls = async () => {
    try {
      const response = await fetch('/api/admin/calls/recent');
      if (response.ok) {
        const data = await response.json();
        setCalls(data);
      }
    } catch (error) {
      console.error('Failed to fetch recent calls:', error);
      // Mock data for development
      setCalls(generateMockCalls());
    } finally {
      setLoading(false);
    }
  };

  const generateMockCalls = (): CallRecord[] => {
    const mockCalls: CallRecord[] = [];
    const statuses: CallRecord['status'][] = ['complete', 'partial', 'failed', 'no_data'];
    const names = ['John Smith', 'Priya Sharma', 'Raj Patel', 'Sarah Johnson', 'Amit Kumar'];
    const cars = ['XUV700', 'Scorpio', 'Thar', 'Bolero', 'XUV300'];
    
    for (let i = 0; i < 10; i++) {
      const date = new Date();
      date.setHours(date.getHours() - i);
      
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const hasData = status === 'complete' || status === 'partial';
      
      mockCalls.push({
        id: `call_${Date.now() - i * 1000}`,
        call_ref_id: `REF${1000 + i}`,
        date_time: date.toISOString(),
        duration: Math.floor(Math.random() * 300) + 60, // 60-360 seconds
        status,
        customer_name: hasData ? names[Math.floor(Math.random() * names.length)] : undefined,
        car_model: hasData && Math.random() > 0.3 ? cars[Math.floor(Math.random() * cars.length)] : undefined,
        email: hasData && Math.random() > 0.4 ? 'customer@example.com' : undefined,
        model_used: Math.random() > 0.5 ? 'VoiceAgent Full' : 'VoiceAgent Mini'
      });
    }
    
    return mockCalls;
  };

  const getStatusBadge = (status: CallRecord['status']) => {
    const baseClasses = "px-2 py-1 text-xs font-medium rounded-full";
    
    switch (status) {
      case 'complete':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'partial':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'failed':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'no_data':
        return `${baseClasses} bg-gray-100 text-gray-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Call Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer Info
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Model
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {calls.map((call) => {
              const { date, time } = formatDateTime(call.date_time);
              
              return (
                <tr key={call.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {call.call_ref_id}
                      </div>
                      <div className="text-sm text-gray-500">
                        {date} at {time}
                      </div>
                      <div className="text-xs text-gray-400">
                        Duration: {formatDuration(call.duration)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm text-gray-900">
                        {call.customer_name || 'Not captured'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {call.car_model || 'No car model'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {call.email || 'No email'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={getStatusBadge(call.status)}>
                      {call.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{call.model_used}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      className="text-blue-600 hover:text-blue-900 mr-3"
                      onClick={() => {/* TODO: Open call details modal */}}
                    >
                      View
                    </button>
                    <button
                      className="text-gray-600 hover:text-gray-900"
                      onClick={() => {/* TODO: Download call data */}}
                    >
                      Export
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {calls.length === 0 && (
        <div className="text-center py-8">
          <div className="text-gray-500">No recent calls found</div>
        </div>
      )}
      
      {calls.length > 0 && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {calls.length} recent calls
            </div>
            <a
              href="/admin/calls"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View all calls →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

