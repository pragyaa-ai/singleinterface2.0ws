'use client';

import React from 'react';

export default function TelephonyConfig() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Telephony Configuration</h1>
          <p className="text-gray-600">WebSocket and vendor settings management</p>
        </div>
        <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700">
          Add New Vendor
        </button>
      </div>

      {/* Coming Soon Notice */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-purple-800">
              Phase 3: Telephony Management
            </h3>
            <div className="mt-2 text-sm text-purple-700">
              <p>This page will include:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Current Ozonetel configuration display</li>
                <li>Add new telephony vendor configurations</li>
                <li>WebSocket URL and SIP settings management</li>
                <li>Connection testing and validation</li>
                <li>Configuration backup and restore</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Current Configuration */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Current Configuration</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Telephony Provider
              </label>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-900">Ozonetel</span>
                <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                  Active
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                WebSocket URL
              </label>
              <p className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded">
                wss://ws-singleinterfacws.pragyaa.ai/ws
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SIP ID
              </label>
              <p className="text-sm text-gray-900">UNKNOWN</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Port
              </label>
              <p className="text-sm text-gray-900">8080</p>
            </div>
          </div>
          <div className="mt-6 flex space-x-3">
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
              Test Connection
            </button>
            <button className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100">
              Edit Configuration
            </button>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Connection Status</h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">WebSocket Connection</span>
              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                Connected
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Telephony Service</span>
              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                Online
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Last Health Check</span>
              <span className="text-sm text-gray-500">2 minutes ago</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


