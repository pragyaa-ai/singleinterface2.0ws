'use client';

import React from 'react';

export default function GreetingMessages() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Greeting Messages</h1>
          <p className="text-gray-600">Customize agent greetings and welcome messages</p>
        </div>
        <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700">
          Add New Greeting
        </button>
      </div>

      {/* Coming Soon Notice */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-orange-800">
              Phase 3: Greeting Management
            </h3>
            <div className="mt-2 text-sm text-orange-700">
              <p>This page will include:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Rich text editor for greeting messages</li>
                <li>Multi-language support (English/Hindi)</li>
                <li>Agent-specific greetings (Authentication/Spotlight/Car Dealer)</li>
                <li>Audio preview and testing capabilities</li>
                <li>A/B testing and performance analytics</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Current Greetings */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Current Greeting Messages</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {[
            {
              name: 'Default Welcome',
              message: 'Namaskar... Welcome to Dee Emm Mahindra dealer. How may I help you today?',
              language: 'English',
              agent: 'Spotlight',
              active: true
            },
            {
              name: 'Hindi Welcome',
              message: 'नमस्कार... डी एम महिंद्रा डीलर में आपका स्वागत है। आज मैं आपकी कैसे सहायता कर सकता हूं?',
              language: 'Hindi',
              agent: 'Spotlight',
              active: false
            },
            {
              name: 'Authentication Greeting',
              message: 'Hello! I need to verify some business information for your Google Business Profile. This will only take a few minutes.',
              language: 'English',
              agent: 'Authentication',
              active: true
            }
          ].map((greeting, index) => (
            <div key={index} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h4 className="text-lg font-medium text-gray-900">{greeting.name}</h4>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      greeting.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {greeting.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3 max-w-2xl">
                    {greeting.message}
                  </p>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>Language: {greeting.language}</span>
                    <span>Agent: {greeting.agent}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m2-10v18a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2h8l4 4z" />
                    </svg>
                  </button>
                  <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Total Greetings</h4>
          <p className="text-2xl font-bold text-gray-900">3</p>
          <p className="text-sm text-gray-600">Across all agents</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Languages</h4>
          <p className="text-2xl font-bold text-gray-900">2</p>
          <p className="text-sm text-gray-600">English & Hindi</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Active Greetings</h4>
          <p className="text-2xl font-bold text-gray-900">2</p>
          <p className="text-sm text-gray-600">Currently in use</p>
        </div>
      </div>
    </div>
  );
}


