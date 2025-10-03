// Mock data for local development testing

export const mockCallData = [
  {
    ucid: "18882175871881831",
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
    salesData: {
      status: "Complete",
      full_name: "Gulshan Mehta",
      car_model: "Scorpio",
      email_id: "gulshan.mehta@gmail.com"
    },
    callAnalytics: {
      callDuration: 102000, // 102 seconds
      totalQuestions: 3,
      parametersAttempted: ["full_name", "car_model", "email_id"],
      parametersCaptured: ["full_name", "car_model", "email_id"]
    }
  },
  {
    ucid: "18882175871881832",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    salesData: {
      status: "Partial",
      full_name: "Priya Sharma",
      car_model: "XUV700",
      email_id: null
    },
    callAnalytics: {
      callDuration: 85000, // 85 seconds
      totalQuestions: 3,
      parametersAttempted: ["full_name", "car_model", "email_id"],
      parametersCaptured: ["full_name", "car_model"]
    }
  },
  {
    ucid: "18882175871881833",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
    salesData: {
      status: "Failed",
      full_name: null,
      car_model: null,
      email_id: null
    },
    callAnalytics: {
      callDuration: 25000, // 25 seconds
      totalQuestions: 1,
      parametersAttempted: ["full_name"],
      parametersCaptured: []
    }
  },
  {
    ucid: "18882175871881834",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
    salesData: {
      status: "Complete",
      full_name: "Raj Patel",
      car_model: "Thar",
      email_id: "raj.patel@example.com"
    },
    callAnalytics: {
      callDuration: 145000, // 145 seconds
      totalQuestions: 4,
      parametersAttempted: ["full_name", "car_model", "email_id", "phone_number"],
      parametersCaptured: ["full_name", "car_model", "email_id"]
    }
  },
  {
    ucid: "18882175871881835",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    salesData: {
      status: "Complete",
      full_name: "Sarah Johnson",
      car_model: "XUV300",
      email_id: "sarah.j@gmail.com"
    },
    callAnalytics: {
      callDuration: 98000, // 98 seconds
      totalQuestions: 3,
      parametersAttempted: ["full_name", "car_model", "email_id"],
      parametersCaptured: ["full_name", "car_model", "email_id"]
    }
  }
];

export const mockDashboardStats = {
  totalCalls: 127,
  todaysCalls: 8,
  successRate: 73,
  averageDuration: 95000, // 95 seconds
  activeModel: "VoiceAgent Full",
  systemHealth: "healthy" as const
};

export const mockChartData = [
  { date: "2025-01-01", total: 15, successful: 11, partial: 3, failed: 1 },
  { date: "2025-01-02", total: 23, successful: 17, partial: 4, failed: 2 },
  { date: "2025-01-03", total: 18, successful: 13, partial: 3, failed: 2 },
  { date: "2025-01-04", total: 31, successful: 22, partial: 6, failed: 3 },
  { date: "2025-01-05", total: 19, successful: 14, partial: 3, failed: 2 },
  { date: "2025-01-06", total: 12, successful: 9, partial: 2, failed: 1 },
  { date: "2025-01-07", total: 8, successful: 6, partial: 1, failed: 1 }
];


