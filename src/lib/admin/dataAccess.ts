import fs from 'fs';
import path from 'path';

export interface SystemConfig {
  telephony: {
    provider: string;
    websocket_url: string;
    sip_id: string;
    port: number;
    host: string;
  };
  models: {
    active_model: 'VoiceAgent_Mini' | 'VoiceAgent_Full';
    mini_model: string;
    full_model: string;
  };
  greetings: {
    [key: string]: {
      message: string;
      language: string;
      agent_type: string;
      is_active: boolean;
    };
  };
  webhooks: {
    enabled: boolean;
    telephony_url?: string;
    singleinterface_url?: string;
  };
}

export interface CallRecord {
  id: string;
  call_ref_id: string;
  timestamp: string;
  duration: number;
  status: 'complete' | 'partial' | 'failed' | 'no_data';
  customer_data: {
    full_name?: string;
    car_model?: string;
    email_id?: string;
  };
  analytics: {
    total_exchanges?: number;
    parameters_attempted?: string[];
    parameters_captured?: string[];
    question_answer_pairs?: any[];
  };
  model_used?: string;
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

export class AdminDataAccess {
  private dataDir: string;
  private configFile: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.configFile = path.join(process.cwd(), 'admin-config.json');
    this.ensureDirectories();
  }

  private ensureDirectories() {
    const requiredDirs = [
      this.dataDir,
      path.join(this.dataDir, 'calls'),
      path.join(this.dataDir, 'transcripts'),
      path.join(this.dataDir, 'results'),
      path.join(this.dataDir, 'processing')
    ];

    requiredDirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // Configuration Management
  async getConfiguration(): Promise<SystemConfig> {
    try {
      if (fs.existsSync(this.configFile)) {
        const configData = fs.readFileSync(this.configFile, 'utf8');
        return JSON.parse(configData);
      }
    } catch (error) {
      console.error('Error reading configuration:', error);
    }

    // Return default configuration
    return this.getDefaultConfiguration();
  }

  async updateConfiguration(config: Partial<SystemConfig>): Promise<void> {
    try {
      const currentConfig = await this.getConfiguration();
      const updatedConfig = { ...currentConfig, ...config };
      
      fs.writeFileSync(this.configFile, JSON.stringify(updatedConfig, null, 2));
    } catch (error) {
      console.error('Error updating configuration:', error);
      throw error;
    }
  }

  private getDefaultConfiguration(): SystemConfig {
    return {
      telephony: {
        provider: 'Ozonetel',
        websocket_url: process.env.TELEPHONY_WS_URL || 'wss://ws-singleinterfacews.pragyaa.ai/ws',
        sip_id: process.env.TELEPHONY_SIP_ID || 'UNKNOWN',
        port: Number(process.env.TELEPHONY_WS_PORT || 8080),
        host: process.env.TELEPHONY_WS_HOST || '0.0.0.0'
      },
      models: {
        active_model: 'VoiceAgent_Full',
        mini_model: 'gpt-4o-mini-realtime-preview-2024-12-17',
        full_model: 'gpt-realtime'
      },
      greetings: {
        default: {
          message: 'Namaskar... Welcome to Dee Emm Mahindra dealer. How may I help you today?',
          language: 'english',
          agent_type: 'spotlight',
          is_active: true
        }
      },
      webhooks: {
        enabled: process.env.WEBHOOKS_ENABLED === 'true',
        telephony_url: process.env.TELEPHONY_WEBHOOK_URL,
        singleinterface_url: process.env.SINGLEINTERFACE_WEBHOOK_URL
      }
    };
  }

  // Call Data Access
  async getCallResults(dateRange?: { start: Date; end: Date }): Promise<CallRecord[]> {
    const calls: CallRecord[] = [];
    const callsDir = path.join(this.dataDir, 'calls');

    try {
      if (fs.existsSync(callsDir)) {
        const callFiles = fs.readdirSync(callsDir)
          .filter(file => file.startsWith('call_') && file.endsWith('.json'))
          .sort((a, b) => b.localeCompare(a)); // Sort by newest first

        for (const file of callFiles) {
          try {
            const filePath = path.join(callsDir, file);
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const callData = JSON.parse(fileContent);

            // Filter by date range if provided
            if (dateRange) {
              const callDate = new Date(callData.timestamp);
              if (callDate < dateRange.start || callDate > dateRange.end) {
                continue;
              }
            }

            calls.push(this.transformCallData(callData));
          } catch (fileError) {
            console.error(`Error reading call file ${file}:`, fileError);
          }
        }
      }
    } catch (error) {
      console.error('Error reading calls directory:', error);
    }

    return calls;
  }

  private transformCallData(rawData: any): CallRecord {
    return {
      id: rawData.ucid || rawData.id || 'unknown',
      call_ref_id: rawData.ucid?.substring(0, 8) || 'unknown',
      timestamp: rawData.timestamp || new Date().toISOString(),
      duration: Math.round((rawData.callAnalytics?.callDuration || rawData.call_duration || 0) / 1000),
      status: this.mapStatus(rawData.salesData?.status),
      customer_data: {
        full_name: rawData.salesData?.full_name,
        car_model: rawData.salesData?.car_model,
        email_id: rawData.salesData?.email_id
      },
      analytics: {
        total_exchanges: rawData.callAnalytics?.totalQuestions,
        parameters_attempted: rawData.callAnalytics?.parametersAttempted,
        parameters_captured: rawData.callAnalytics?.parametersCaptured,
        question_answer_pairs: rawData.callAnalytics?.questionAnswerPairs
      },
      model_used: 'VoiceAgent Full' // Default for now
    };
  }

  private mapStatus(status?: string): CallRecord['status'] {
    switch (status?.toLowerCase()) {
      case 'complete':
        return 'complete';
      case 'partial':
        return 'partial';
      case 'failed':
        return 'failed';
      default:
        return 'no_data';
    }
  }

  // System Health Monitoring
  async getSystemHealth(): Promise<SystemHealth> {
    const health: SystemHealth = {
      overall_status: 'healthy',
      services: {
        telephony: 'online',
        queue_processor: 'running',
        webhook_service: 'active',
        openai_api: 'connected'
      },
      disk_usage: {
        total: 0,
        used: 0,
        available: 0
      },
      last_updated: new Date().toISOString()
    };

    try {
      // Check directory existence and permissions
      const requiredDirs = ['calls', 'transcripts', 'results', 'processing'];
      for (const dir of requiredDirs) {
        const dirPath = path.join(this.dataDir, dir);
        if (!fs.existsSync(dirPath)) {
          health.overall_status = 'warning';
        }
      }

      // Check OpenAI API key
      if (!process.env.OPENAI_API_KEY) {
        health.services.openai_api = 'error';
        health.overall_status = 'error';
      }

      // Get disk usage
      try {
        const stats = fs.statSync(this.dataDir);
        // This is a simplified disk usage check
        health.disk_usage = {
          total: 1000000000, // 1GB placeholder
          used: 500000000,   // 500MB placeholder
          available: 500000000 // 500MB placeholder
        };
      } catch (diskError) {
        console.error('Error checking disk usage:', diskError);
      }

    } catch (error) {
      console.error('Error checking system health:', error);
      health.overall_status = 'error';
    }

    return health;
  }

  // Analytics and Aggregation
  async getCallAnalytics(days: number = 7) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const calls = await this.getCallResults({ start: startDate, end: endDate });
    
    // Group calls by date
    const dailyStats = new Map<string, {
      total: number;
      successful: number;
      partial: number;
      failed: number;
    }>();

    calls.forEach(call => {
      const date = new Date(call.timestamp).toISOString().split('T')[0];
      const stats = dailyStats.get(date) || { total: 0, successful: 0, partial: 0, failed: 0 };
      
      stats.total++;
      switch (call.status) {
        case 'complete':
          stats.successful++;
          break;
        case 'partial':
          stats.partial++;
          break;
        default:
          stats.failed++;
          break;
      }
      
      dailyStats.set(date, stats);
    });

    return Array.from(dailyStats.entries()).map(([date, stats]) => ({
      date,
      ...stats
    }));
  }
}

