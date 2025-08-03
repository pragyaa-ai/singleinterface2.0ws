'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Consultation data point interface
export interface ConsultationDataPoint {
  id: string;
  name: string;
  label: string;
  value: string;
  status: 'pending' | 'captured' | 'verified' | 'not_available';
  timestamp?: Date;
}

// Context value interface
export interface ConsultationDataContextValue {
  consultationData: ConsultationDataPoint[];
  captureConsultationData: (dataType: string, value: string) => void;
  verifyConsultationData: (dataType: string, confirmed: boolean) => void;
  getConsultationProgress: () => { completed: number; total: number; percentage: number };
  exportConsultationData: () => ConsultationDataPoint[];
  downloadConsultationData: (format: 'json' | 'csv' | 'pdf') => void;
  resetConsultationData: () => void;
}

const ConsultationDataContext = createContext<ConsultationDataContextValue | undefined>(undefined);

const initialConsultationData: ConsultationDataPoint[] = [
  { id: 'budget_range', name: 'Budget Range', label: 'Budget Range', value: '', status: 'pending' },
  { id: 'timeline', name: 'Purchase Timeline', label: 'Timeline', value: '', status: 'pending' },
  { id: 'usage_type', name: 'Usage Type', label: 'Vehicle Usage', value: '', status: 'pending' },
  { id: 'financing_preference', name: 'Financing Preference', label: 'Financing', value: '', status: 'pending' },
  { id: 'test_drive_interest', name: 'Test Drive Interest', label: 'Test Drive', value: '', status: 'pending' },
  { id: 'preferred_features', name: 'Preferred Features', label: 'Features', value: '', status: 'pending' },
  { id: 'contact_preference', name: 'Contact Preference', label: 'Contact', value: '', status: 'pending' },
];

export function ConsultationDataProvider({ children }: { children: ReactNode }) {
  const [consultationData, setConsultationData] = useState<ConsultationDataPoint[]>(initialConsultationData);

  const captureConsultationData = (dataType: string, value: string) => {
    console.log('[ConsultationData] Capturing:', dataType, value);
    setConsultationData(prev => 
      prev.map(item => 
        item.id === dataType 
          ? { ...item, value, status: 'captured', timestamp: new Date() }
          : item
      )
    );
  };

  const verifyConsultationData = (dataType: string, confirmed: boolean) => {
    console.log('[ConsultationData] Verifying:', dataType, confirmed);
    setConsultationData(prev => 
      prev.map(item => 
        item.id === dataType 
          ? { ...item, status: confirmed ? 'verified' : 'pending' }
          : item
      )
    );
  };

  const getConsultationProgress = () => {
    const completed = consultationData.filter(item => 
      item.status === 'captured' || item.status === 'verified'
    ).length;
    const total = consultationData.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { completed, total, percentage };
  };

  const exportConsultationData = () => {
    return consultationData.filter(item => 
      item.status === 'captured' || item.status === 'verified'
    );
  };

  const downloadConsultationData = (format: 'json' | 'csv' | 'pdf') => {
    const data = exportConsultationData();
    
    if (format === 'json') {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `consultation-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    // Add CSV and PDF support later if needed
  };

  const resetConsultationData = () => {
    setConsultationData(initialConsultationData);
  };

  const value: ConsultationDataContextValue = {
    consultationData,
    captureConsultationData,
    verifyConsultationData,
    getConsultationProgress,
    exportConsultationData,
    downloadConsultationData,
    resetConsultationData
  };

  return (
    <ConsultationDataContext.Provider value={value}>
      {children}
    </ConsultationDataContext.Provider>
  );
}

export function useConsultationData(): ConsultationDataContextValue {
  const context = useContext(ConsultationDataContext);
  if (context === undefined) {
    throw new Error('useConsultationData must be used within a ConsultationDataProvider');
  }
  return context;
}