# 🎨 Rich Interactive UI Dashboard Plan
## Single Interface Voice Agent Management System

---

## 📋 **Project Overview**

Create a comprehensive dashboard that provides complete oversight of the voice agent system without impacting underlying functionality. The UI will be built as a separate admin interface alongside the existing voice agent UI.

---

## 🏗️ **Architecture Strategy**

### **Non-Intrusive Approach**
- **Separate Route Structure**: Create `/admin` routes alongside existing functionality
- **Data Layer Isolation**: Read-only access to existing data files and logs
- **Service Independence**: Dashboard operates independently of voice agent services
- **Backward Compatibility**: Existing `/` routes remain unchanged

### **Technology Stack**
- **Frontend**: Next.js 14 with TypeScript (existing stack)
- **UI Components**: Tailwind CSS + Headless UI components
- **Charts**: Chart.js or Recharts for data visualization
- **State Management**: React Context (existing pattern)
- **Data Access**: File system APIs + REST endpoints

---

## 🎯 **Core Features & Components**

### **1. Telephony Configuration Panel** 📞

#### **Current Telephony Settings Display**
```typescript
interface TelephonyConfig {
  provider: 'Ozonetel' | 'Custom';
  websocket_url: string;
  sip_id: string;
  port: number;
  host: string;
  status: 'active' | 'inactive';
}
```

#### **Multi-Vendor Support**
- **Ozonetel Configuration** (current)
- **Add New Vendor** modal with fields:
  - Vendor Name
  - WebSocket URL pattern
  - SIP Configuration
  - Authentication method
  - Test connection button

#### **Configuration Management**
- **Live Status Indicators**: Green/Red for active connections
- **Test Connection**: Validate WebSocket connectivity
- **Configuration History**: Track changes with timestamps
- **Import/Export**: JSON configuration backup/restore

---

### **2. Greeting Message Configuration** 💬

#### **Message Management Interface**
```typescript
interface GreetingConfig {
  id: string;
  name: string;
  message: string;
  language: 'english' | 'hindi' | 'multilingual';
  agent_type: 'authentication' | 'spotlight' | 'car_dealer';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

#### **Features**
- **Rich Text Editor**: Format greeting messages with emphasis
- **Multi-Language Support**: Separate greetings for different languages
- **Agent-Specific Messages**: Different greetings per agent type
- **Preview & Test**: Audio preview of greeting messages
- **Version History**: Track greeting message changes
- **A/B Testing**: Compare greeting effectiveness

---

### **3. AI Model Configuration** 🤖

#### **Model Selection Interface**
```typescript
interface ModelConfig {
  display_name: 'VoiceAgent Mini' | 'VoiceAgent Full';
  internal_model: 'gpt-4o-realtime-preview' | 'gpt-realtime';
  description: string;
  capabilities: string[];
  performance_tier: 'standard' | 'premium';
  cost_tier: 'low' | 'high';
  is_active: boolean;
}
```

#### **Model Management**
- **VoiceAgent Mini**: 
  - Internal: `gpt-4o-mini-realtime-preview-2024-12-17`
  - Description: "Fast, efficient voice processing"
  - Use case: High-volume, basic interactions
- **VoiceAgent Full**: 
  - Internal: `gpt-realtime` or latest model
  - Description: "Advanced AI with enhanced capabilities"
  - Use case: Complex conversations, better accuracy

#### **Configuration Options**
- **Model Selection**: Radio buttons for Mini/Full
- **Performance Metrics**: Response time, accuracy rates
- **Usage Analytics**: Calls per model, success rates
- **Cost Analysis**: Usage costs per model
- **Fallback Configuration**: Auto-switch on model failure

---

### **4. Call Analytics Dashboard** 📊

#### **Date-Based Bar Chart**
```typescript
interface CallAnalytics {
  date: string; // YYYY-MM-DD
  total_calls: number;
  successful_calls: number;
  partial_data_calls: number;
  failed_calls: number;
  average_duration: number;
  total_duration: number;
}
```

#### **Chart Features**
- **Interactive Bar Chart**: Calls by date with drill-down
- **Date Range Selector**: Last 7/30/90 days, custom range
- **Multiple Metrics**: Total, successful, partial, failed calls
- **Hover Details**: Detailed stats on hover
- **Export Options**: PNG, PDF, CSV export

#### **Key Metrics Cards**
- **Today's Calls**: Real-time counter
- **Success Rate**: Percentage with trend indicator
- **Average Call Duration**: With comparison to previous period
- **Data Completion Rate**: Percentage of complete data captures

---

### **5. Call Details Table** 📋

#### **Comprehensive Call Log**
```typescript
interface CallRecord {
  id: string;
  call_ref_id: string;
  date_time: string;
  duration: number;
  status: 'complete' | 'partial' | 'failed' | 'no_data';
  data_points: {
    full_name: DataPointStatus;
    car_model: DataPointStatus;
    email_id: DataPointStatus;
  };
  model_used: 'VoiceAgent Mini' | 'VoiceAgent Full';
  telephony_vendor: string;
  recording_url?: string;
}

interface DataPointStatus {
  value: string | null;
  status: 'verified' | 'captured' | 'needs_validation' | 'not_captured';
  confidence: number;
  attempts: number;
}
```

#### **Table Features**
- **Sortable Columns**: Date, duration, status, etc.
- **Advanced Filtering**: 
  - Date range
  - Status (complete/partial/failed)
  - Model used
  - Telephony vendor
  - Data completeness
- **Search**: Call ID, customer name, email
- **Pagination**: Handle large datasets efficiently
- **Row Actions**: 
  - View full transcript
  - Listen to recording
  - Export call data
  - Resend to webhook

#### **Call Detail Modal**
- **Full Transcript**: Complete conversation flow
- **Data Points**: Detailed extraction results with confidence scores
- **Timeline**: Question-answer pairs with timestamps
- **Analytics**: Response times, reattempts, drop-off points
- **Webhook Status**: Delivery status to both endpoints

---

## 🎨 **UI/UX Design Specifications**

### **Layout Structure**
```
┌─────────────────────────────────────────────────────────────┐
│ Header: Logo | Navigation | User Profile | Settings         │
├─────────────────────────────────────────────────────────────┤
│ Sidebar Navigation:                                         │
│ • Dashboard Overview                                        │
│ • Call Analytics                                           │
│ • Telephony Config                                         │
│ • AI Models                                                │
│ • Greeting Messages                                        │
│ • System Health                                            │
│ • Settings                                                 │
├─────────────────────────────────────────────────────────────┤
│ Main Content Area:                                         │
│ [Dynamic content based on navigation selection]            │
└─────────────────────────────────────────────────────────────┘
```

### **Color Scheme & Branding**
- **Primary**: Pragyaa brand colors (existing)
- **Success**: Green (#10B981) for successful calls
- **Warning**: Yellow (#F59E0B) for partial data
- **Error**: Red (#EF4444) for failed calls
- **Neutral**: Gray scale for backgrounds and text

### **Responsive Design**
- **Desktop First**: Optimized for admin use
- **Tablet Support**: Collapsible sidebar
- **Mobile View**: Stack layout with bottom navigation

---

## 📁 **File Structure Plan**

```
src/
├── app/
│   ├── admin/                          # New admin dashboard
│   │   ├── layout.tsx                  # Admin layout wrapper
│   │   ├── page.tsx                    # Dashboard overview
│   │   ├── analytics/
│   │   │   └── page.tsx               # Call analytics page
│   │   ├── telephony/
│   │   │   ├── page.tsx               # Telephony config
│   │   │   └── components/
│   │   │       ├── VendorConfig.tsx
│   │   │       └── ConnectionTest.tsx
│   │   ├── models/
│   │   │   ├── page.tsx               # AI model config
│   │   │   └── components/
│   │   │       └── ModelSelector.tsx
│   │   ├── greetings/
│   │   │   ├── page.tsx               # Greeting management
│   │   │   └── components/
│   │   │       ├── GreetingEditor.tsx
│   │   │       └── MessagePreview.tsx
│   │   └── calls/
│   │       ├── page.tsx               # Call details table
│   │       └── components/
│   │           ├── CallsTable.tsx
│   │           ├── CallDetailModal.tsx
│   │           └── CallFilters.tsx
│   ├── api/
│   │   ├── admin/                      # Admin API endpoints
│   │   │   ├── calls/
│   │   │   │   └── route.ts           # Call data API
│   │   │   ├── analytics/
│   │   │   │   └── route.ts           # Analytics API
│   │   │   ├── config/
│   │   │   │   ├── telephony/
│   │   │   │   │   └── route.ts       # Telephony config API
│   │   │   │   ├── models/
│   │   │   │   │   └── route.ts       # Model config API
│   │   │   │   └── greetings/
│   │   │   │       └── route.ts       # Greeting config API
│   │   │   └── system/
│   │   │       └── health/
│   │   │           └── route.ts       # System health API
│   │   └── webhooks/                   # Existing webhook endpoints
│   └── components/
│       ├── admin/                      # Admin-specific components
│       │   ├── AdminLayout.tsx
│       │   ├── Sidebar.tsx
│       │   ├── DashboardCard.tsx
│       │   ├── CallsChart.tsx
│       │   ├── MetricsCard.tsx
│       │   └── StatusIndicator.tsx
│       └── ui/                         # Reusable UI components
│           ├── Button.tsx
│           ├── Modal.tsx
│           ├── Table.tsx
│           ├── Chart.tsx
│           └── Form.tsx
├── lib/
│   ├── admin/                          # Admin utilities
│   │   ├── dataAccess.ts              # File system data access
│   │   ├── analytics.ts               # Analytics calculations
│   │   ├── configManager.ts           # Configuration management
│   │   └── systemHealth.ts            # System monitoring
│   └── utils/                          # Existing utilities
└── types/
    ├── admin.ts                        # Admin interface types
    └── config.ts                       # Configuration types
```

---

## 🔧 **Implementation Phases**

### **Phase 1: Foundation (Week 1)**
- [ ] Set up admin route structure
- [ ] Create basic layout and navigation
- [ ] Implement data access layer for existing files
- [ ] Build dashboard overview with key metrics

### **Phase 2: Call Analytics (Week 2)**
- [ ] Implement call data aggregation
- [ ] Build interactive bar chart component
- [ ] Create call details table with filtering
- [ ] Add call detail modal with transcript view

### **Phase 3: Configuration Management (Week 3)**
- [ ] Build telephony configuration interface
- [ ] Implement greeting message management
- [ ] Create AI model selection interface
- [ ] Add configuration validation and testing

### **Phase 4: Advanced Features (Week 4)**
- [ ] Add real-time system health monitoring
- [ ] Implement configuration backup/restore
- [ ] Build webhook management interface
- [ ] Add user management and permissions

### **Phase 5: Polish & Testing (Week 5)**
- [ ] Responsive design optimization
- [ ] Performance optimization
- [ ] Comprehensive testing
- [ ] Documentation and deployment

---

## 📊 **Data Access Strategy**

### **File System Integration**
```typescript
// Data access without modifying existing structure
class AdminDataAccess {
  // Read call results from data/results/
  async getCallResults(dateRange?: DateRange): Promise<CallRecord[]>
  
  // Read system logs for health monitoring
  async getSystemHealth(): Promise<SystemHealth>
  
  // Read configuration files
  async getConfiguration(): Promise<SystemConfig>
  
  // Update configuration (non-intrusive)
  async updateConfiguration(config: Partial<SystemConfig>): Promise<void>
}
```

### **Real-time Updates**
- **File Watchers**: Monitor data directories for new calls
- **WebSocket Connection**: Real-time updates to dashboard
- **Polling Fallback**: Regular data refresh for reliability

---

## 🚀 **Deployment Strategy**

### **Development Environment**
```bash
# Install additional dependencies
npm install recharts date-fns lucide-react @headlessui/react

# Start development with admin routes
npm run dev

# Access admin dashboard
http://localhost:3000/admin
```

### **Production Deployment**
- **Same Server**: Deploy alongside existing application
- **Separate Build**: Admin routes included in main build
- **Environment Variables**: Add admin-specific configurations
- **Access Control**: Optional authentication for admin routes

### **Configuration Management**
```bash
# Environment variables for admin features
ADMIN_ENABLED=true
ADMIN_AUTH_REQUIRED=false  # Optional authentication
ADMIN_DEFAULT_MODEL=VoiceAgent_Full
ADMIN_DATA_RETENTION_DAYS=90
```

---

## 🔒 **Security Considerations**

### **Access Control**
- **Optional Authentication**: Can be enabled via environment variable
- **Role-Based Access**: Admin vs. Read-only permissions
- **IP Restrictions**: Limit access to specific IP ranges
- **Session Management**: Secure admin sessions

### **Data Protection**
- **Read-Only by Default**: Admin interface doesn't modify call data
- **Configuration Validation**: Prevent invalid configurations
- **Audit Logging**: Track all configuration changes
- **Backup Integration**: Automatic configuration backups

---

## 📈 **Success Metrics**

### **Operational Efficiency**
- **Configuration Time**: Reduce setup time by 80%
- **Issue Resolution**: Faster problem identification
- **System Monitoring**: Real-time health visibility
- **Data Insights**: Better call performance understanding

### **User Experience**
- **Dashboard Load Time**: < 2 seconds
- **Chart Interactivity**: Smooth data visualization
- **Mobile Responsiveness**: Full functionality on tablets
- **Search Performance**: < 500ms for call searches

---

## 🎯 **Next Steps**

1. **Review & Approval**: Confirm approach and feature priorities
2. **Environment Setup**: Prepare development environment
3. **Phase 1 Implementation**: Start with foundation and basic dashboard
4. **Iterative Development**: Build and test each phase incrementally
5. **User Testing**: Gather feedback and refine interface

---

**This comprehensive UI dashboard will provide complete visibility and control over the voice agent system while maintaining the robust underlying functionality! 🎉**
