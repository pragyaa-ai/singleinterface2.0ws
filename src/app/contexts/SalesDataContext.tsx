'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

// Sales data interface for Spotlight agent
interface SalesDataPoint {
  id: string;
  label: string;
  value: string;
  status: 'pending' | 'captured' | 'verified' | 'not_available';
  timestamp?: string;
  notes?: string;
}

interface SalesDataContextValue {
  salesData: SalesDataPoint[];
  captureSalesData: (type: string, value: string, notes?: string) => { success: boolean; message: string };
  verifySalesData: (type: string, confirmed: boolean) => { success: boolean; message: string };
  captureAllSalesData: (data: Record<string, string>) => { success: boolean; message: string };
  pushToLMS: (data: Record<string, string>) => { success: boolean; message: string };
  downloadSalesData: (format: string) => { success: boolean; message: string; downloadUrl?: string };
  resetSalesData: () => void;
  getSalesDataProgress: () => { completed: number; total: number; percentage: number };
  exportSalesData: () => Record<string, any>;
}

const SalesDataContext = createContext<SalesDataContextValue | undefined>(undefined);

// Initial sales data points for Spotlight agent
const initialSalesData: SalesDataPoint[] = [
  {
    id: 'full_name',
    label: 'Full Name',
    value: '',
    status: 'pending'
  },
  {
    id: 'car_model',
    label: 'Car Model',
    value: '',
    status: 'pending'
  },
  {
    id: 'email_id',
    label: 'Email ID',
    value: '',
    status: 'pending'
  }
];

export function SalesDataProvider({ children }: { children: React.ReactNode }) {
  const [salesData, setSalesData] = useState<SalesDataPoint[]>(initialSalesData);

  const captureSalesData = useCallback((type: string, value: string, notes?: string) => {
    setSalesData(prev => prev.map(item => {
      if (item.id === type) {
        return {
          ...item,
          value,
          status: 'captured' as const,
          timestamp: new Date().toISOString(),
          notes
        };
      }
      return item;
    }));
    
    return { 
      success: true, 
      message: `Sales data captured for ${type}: ${value}` 
    };
  }, []);

  const verifySalesData = useCallback((type: string, confirmed: boolean) => {
    setSalesData(prev => prev.map(item => {
      if (item.id === type) {
        return {
          ...item,
          status: confirmed ? 'verified' : 'pending'
        };
      }
      return item;
    }));
    
    return { 
      success: true, 
      message: `Sales data ${confirmed ? 'verified' : 'rejected'} for ${type}` 
    };
  }, []);

  const captureAllSalesData = useCallback((data: Record<string, string>) => {
    setSalesData(prev => prev.map(item => {
      const value = data[item.id];
      if (value !== undefined) {
        return {
          ...item,
          value: value === "Not Available" ? "" : value,
          status: value === "Not Available" ? 'not_available' : 'verified',
          timestamp: new Date().toISOString()
        };
      }
      return item;
    }));
    
    return { 
      success: true, 
      message: "All sales data captured successfully" 
    };
  }, []);

  const pushToLMS = useCallback((data: Record<string, string>) => {
    // TODO: Implement actual LMS API integration
    console.log('Pushing to SingleInterface LMS:', data);
    
    // Simulate API call
    const lmsPayload = {
      timestamp: new Date().toISOString(),
      source: 'spotlight_agent',
      customer_data: data
    };
    
    // Here you would make the actual API call to SingleInterface LMS
    // fetch('/api/lms/push', { method: 'POST', body: JSON.stringify(lmsPayload) })
    
    return { 
      success: true, 
      message: "Sales data successfully pushed to SingleInterface LMS" 
    };
  }, []);

  const downloadSalesData = useCallback((format: string) => {
    const exportData = exportSalesData();
    
    // Create download content based on format
    let content = '';
    let mimeType = '';
    let filename = '';
    
    switch (format) {
      case 'json':
        content = JSON.stringify(exportData, null, 2);
        mimeType = 'application/json';
        filename = `sales_data_${Date.now()}.json`;
        break;
      case 'csv':
        const headers = 'Full Name,Car Model,Email ID,Status,Timestamp\n';
        const rows = salesData.map(item => 
          `"${item.value}","${item.label}","${item.status}","${item.timestamp || ''}"`
        ).join('\n');
        content = headers + rows;
        mimeType = 'text/csv';
        filename = `sales_data_${Date.now()}.csv`;
        break;
      case 'pdf':
        // For PDF, we'd need a PDF library - for now return JSON
        content = JSON.stringify(exportData, null, 2);
        mimeType = 'application/json';
        filename = `sales_data_${Date.now()}.json`;
        break;
    }
    
    // Create download blob and URL
    const blob = new Blob([content], { type: mimeType });
    const downloadUrl = URL.createObjectURL(blob);
    
    // Trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
    
    return { 
      success: true, 
      message: `Sales data downloaded in ${format} format`,
      downloadUrl 
    };
  }, [salesData]);

  const resetSalesData = useCallback(() => {
    setSalesData(initialSalesData);
  }, []);

  const getSalesDataProgress = useCallback(() => {
    const completed = salesData.filter(item => 
      item.status === 'verified' || item.status === 'not_available'
    ).length;
    const total = salesData.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { completed, total, percentage };
  }, [salesData]);

  const exportSalesData = useCallback(() => {
    return {
      timestamp: new Date().toISOString(),
      source: 'spotlight_agent',
      data: salesData.reduce((acc, item) => {
        acc[item.id] = {
          value: item.value,
          status: item.status,
          timestamp: item.timestamp,
          notes: item.notes
        };
        return acc;
      }, {} as Record<string, any>),
      summary: getSalesDataProgress()
    };
  }, [salesData, getSalesDataProgress]);

  const value: SalesDataContextValue = {
    salesData,
    captureSalesData,
    verifySalesData,
    captureAllSalesData,
    pushToLMS,
    downloadSalesData,
    resetSalesData,
    getSalesDataProgress,
    exportSalesData
  };

  return (
    <SalesDataContext.Provider value={value}>
      {children}
    </SalesDataContext.Provider>
  );
}

export function useSalesData() {
  const context = useContext(SalesDataContext);
  if (context === undefined) {
    throw new Error('useSalesData must be used within a SalesDataProvider');
  }
  return context;
}