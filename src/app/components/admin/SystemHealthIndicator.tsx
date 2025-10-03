'use client';

import React from 'react';

interface SystemHealthIndicatorProps {
  status: 'healthy' | 'warning' | 'error';
}

export default function SystemHealthIndicator({ status }: SystemHealthIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'healthy':
        return {
          color: 'green',
          text: 'All Systems Operational',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        };
      case 'warning':
        return {
          color: 'yellow',
          text: 'Minor Issues Detected',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          )
        };
      case 'error':
        return {
          color: 'red',
          text: 'System Issues',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        };
      default:
        return {
          color: 'gray',
          text: 'Unknown Status',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`
      flex items-center space-x-2 px-3 py-2 rounded-lg
      bg-${config.color}-50 text-${config.color}-700 border border-${config.color}-200
    `}>
      <div className={`text-${config.color}-600`}>
        {config.icon}
      </div>
      <span className="text-sm font-medium">
        {config.text}
      </span>
      <div className={`w-2 h-2 bg-${config.color}-500 rounded-full animate-pulse`}></div>
    </div>
  );
}

