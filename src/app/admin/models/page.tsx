'use client';

import React, { useState, useEffect } from 'react';

export default function AIModels() {
  const [selectedModel, setSelectedModel] = useState<'full' | 'mini'>('full');
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Fetch current model selection on mount
  useEffect(() => {
    fetchModelConfig();
  }, []);

  async function fetchModelConfig() {
    try {
      const response = await fetch('/api/admin/model-config');
      const data = await response.json();
      
      if (data.success) {
        setSelectedModel(data.config.selectedModel);
      }
    } catch (error) {
      console.error('Error fetching model config:', error);
    } finally {
      setLoading(false);
    }
  }

  async function switchModel(model: 'full' | 'mini') {
    if (switching || model === selectedModel) return;
    
    setSwitching(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/admin/model-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedModel: model,
          updatedBy: 'admin'
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSelectedModel(model);
        setMessage({
          type: 'success',
          text: `Successfully switched to ${model === 'full' ? 'VoiceAgent Full' : 'VoiceAgent Mini'}. New calls will use this model.`
        });
        
        // Clear message after 5 seconds
        setTimeout(() => setMessage(null), 5000);
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to switch model'
        });
      }
    } catch (error) {
      console.error('Error switching model:', error);
      setMessage({
        type: 'error',
        text: 'Network error while switching model'
      });
    } finally {
      setSwitching(false);
    }
  }
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Models</h1>
          <p className="text-gray-600">Model selection and configuration management</p>
        </div>
      </div>

      {/* Success/Error Message */}
      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {message.type === 'success' ? (
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className={`text-sm font-medium ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                {message.text}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Coming Soon Notice */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-indigo-800">
              Phase 3: AI Model Management
            </h3>
            <div className="mt-2 text-sm text-indigo-700">
              <p>This page will include:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>VoiceAgent Mini and VoiceAgent Full selection</li>
                <li>Performance metrics and cost analysis</li>
                <li>Model switching and fallback configuration</li>
                <li>Usage analytics and optimization recommendations</li>
                <li>Custom model parameters and fine-tuning</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Current Model Selection */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Active Model Configuration</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* VoiceAgent Full */}
            <div className={`border-2 rounded-lg p-4 ${selectedModel === 'full' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-gray-900">VoiceAgent Full</h4>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${selectedModel === 'full' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                  {selectedModel === 'full' ? 'Active' : 'Available'}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Advanced AI with enhanced capabilities for complex conversations and better accuracy.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Performance:</span>
                  <span className="text-gray-900">Premium</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Cost Tier:</span>
                  <span className="text-gray-900">High</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Best For:</span>
                  <span className="text-gray-900">Complex queries</span>
                </div>
              </div>
              {selectedModel !== 'full' && (
                <button 
                  onClick={() => switchModel('full')}
                  disabled={switching}
                  className="mt-4 w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {switching ? 'Switching...' : 'Switch to Full'}
                </button>
              )}
            </div>

            {/* VoiceAgent Mini */}
            <div className={`border-2 rounded-lg p-4 ${selectedModel === 'mini' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-gray-900">VoiceAgent Mini</h4>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${selectedModel === 'mini' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                  {selectedModel === 'mini' ? 'Active' : 'Available'}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Fast, efficient voice processing optimized for high-volume, basic interactions.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Performance:</span>
                  <span className="text-gray-900">Standard</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Cost Tier:</span>
                  <span className="text-gray-900">Low</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Best For:</span>
                  <span className="text-gray-900">High-volume calls</span>
                </div>
              </div>
              {selectedModel !== 'mini' && (
                <button 
                  onClick={() => switchModel('mini')}
                  disabled={switching}
                  className="mt-4 w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {switching ? 'Switching...' : 'Switch to Mini'}
                </button>
              )}
            </div>
          </div>

          {/* Cost Savings Info */}
          {selectedModel === 'mini' && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="ml-2 text-sm font-medium text-green-800">
                  Cost savings: ~75% compared to Full model (~$450/year)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Model Performance Metrics */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Performance Metrics</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">1.2s</div>
              <div className="text-sm text-gray-500">Avg Response Time</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">94%</div>
              <div className="text-sm text-gray-500">Accuracy Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">127</div>
              <div className="text-sm text-gray-500">Calls Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">$12.50</div>
              <div className="text-sm text-gray-500">Daily Cost</div>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Options */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Advanced Configuration</h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="flex items-center">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50" defaultChecked />
                <span className="ml-2 text-sm text-gray-700">Enable automatic fallback to Mini model on high load</span>
              </label>
            </div>
            <div>
              <label className="flex items-center">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50" />
                <span className="ml-2 text-sm text-gray-700">Use Mini model for calls under 30 seconds</span>
              </label>
            </div>
            <div>
              <label className="flex items-center">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50" defaultChecked />
                <span className="ml-2 text-sm text-gray-700">Enable performance monitoring and alerts</span>
              </label>
            </div>
          </div>
          <div className="mt-6">
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700">
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


