'use client';

import React from 'react';

export default function CallAnalytics() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Call Analytics</h1>
          <p className="text-gray-600">Detailed call volume and performance metrics</p>
        </div>
      </div>

      {/* Coming Soon Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-blue-800">
              Phase 2: Advanced Analytics
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>This page will include:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Interactive charts with date range selection</li>
                <li>Call volume trends and patterns</li>
                <li>Success rate analysis over time</li>
                <li>Performance metrics by model type</li>
                <li>Export capabilities for reports</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Volume Trend (Preview)</h3>
        <div className="h-64 flex items-end justify-between space-x-2">
          {[15, 23, 18, 31, 19, 12, 8, 14, 22, 17, 25, 19, 13, 9].map((height, index) => (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div 
                className="w-full max-w-4 bg-gradient-to-t from-blue-500 to-blue-300 rounded-t"
                style={{ height: `${(height / 31) * 200}px` }}
                title={`${height} calls`}
              ></div>
              <div className="mt-2 text-xs text-gray-500">
                {index + 1}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500">Last 14 days call volume</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Peak Call Time</h4>
          <p className="text-2xl font-bold text-gray-900">2:00 PM</p>
          <p className="text-sm text-gray-600">Average daily peak</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Avg Call Length</h4>
          <p className="text-2xl font-bold text-gray-900">1:35</p>
          <p className="text-sm text-gray-600">Minutes per call</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Completion Rate</h4>
          <p className="text-2xl font-bold text-gray-900">73%</p>
          <p className="text-sm text-gray-600">Successful data capture</p>
        </div>
      </div>
    </div>
  );
}


