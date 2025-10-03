// Admin Dashboard Types

export interface DashboardStats {
  totalCalls: number;
  todaysCalls: number;
  successRate: number;
  averageDuration: number;
  activeModel: string;
  systemHealth: 'healthy' | 'warning' | 'error';
}

export interface CallRecord {
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

export interface ChartDataPoint {
  date: string;
  total: number;
  successful: number;
  partial: number;
  failed: number;
}

export interface TelephonyConfig {
  provider: 'Ozonetel' | 'Custom';
  websocket_url: string;
  sip_id: string;
  port: number;
  host: string;
  status: 'active' | 'inactive';
}

export interface ModelConfig {
  display_name: 'VoiceAgent Mini' | 'VoiceAgent Full';
  internal_model: string;
  description: string;
  capabilities: string[];
  performance_tier: 'standard' | 'premium';
  cost_tier: 'low' | 'high';
  is_active: boolean;
}

export interface GreetingConfig {
  id: string;
  name: string;
  message: string;
  language: 'english' | 'hindi' | 'multilingual';
  agent_type: 'authentication' | 'spotlight' | 'car_dealer';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SystemHealth {
  overall_status: 'healthy' | 'warning' | 'error';
  services: {
    telephony: 'online' | 'offline' | 'error';
    queue_processor: 'running' | 'stopped' | 'error';
    webhook_service: 'active' | 'inactive' | 'error';
    openai_api: 'connected' | 'disconnected' | 'error';
  };
  disk_usage: {
    total: number;
    used: number;
    available: number;
  };
  last_updated: string;
}

export interface NavItem {
  name: string;
  href: string;
  icon: string;
  description: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

