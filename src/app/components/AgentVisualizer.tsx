import React from 'react';
import {
  UserCircleIcon,
  ShieldCheckIcon,
  ClipboardDocumentListIcon,
  ArrowsRightLeftIcon,
  UsersIcon,
  ClockIcon,
  CheckCircleIcon,
  ShareIcon,
  HomeIcon,
  ReceiptRefundIcon,
  TagIcon,
  UserGroupIcon
} from '@heroicons/react/24/solid';

const AgentVisualizer = ({ isExpanded }: { isExpanded: boolean }) => {
  if (!isExpanded) {
    return null;
  }

  // Static data based on the SingleInterface scenario
  const currentAgent = {
    name: 'Authentication',
    description: 'Greets users and verifies their identity.',
    status: 'Active',
  };

  const capabilities = [
    { name: 'Verify Identity', icon: ShieldCheckIcon },
    { name: 'Manage Address', icon: HomeIcon },
    { name: 'Process Returns', icon: ReceiptRefundIcon },
    { name: 'Promotional Offers', icon: TagIcon },
  ];

  const handoffAgents = [
    { name: 'Returns' },
    { name: 'Sales' },
    { name: 'Human Agent' },
  ];

  const metrics = [
    { name: 'Availability', value: '99.8%', icon: CheckCircleIcon },
    { name: 'Avg. Response Time', value: '1.2s', icon: ClockIcon },
  ];

  return (
    <div className="flex-1 bg-gray-100 rounded-lg overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-500 text-white p-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Agent Control Center</h2>
          <p className="text-sm text-purple-200">Live Agent Monitoring</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span className="text-sm font-medium">LIVE</span>
        </div>
      </div>

      <div className="p-4 overflow-y-auto space-y-6">
        {/* Current Agent */}
        <div className="bg-blue-500 text-white p-4 rounded-lg shadow-lg flex items-center justify-between">
          <div className="flex items-center">
            <UserCircleIcon className="h-10 w-10 mr-4" />
            <div>
              <h3 className="text-lg font-bold">{currentAgent.name}</h3>
              <p className="text-sm text-blue-100">{currentAgent.description}</p>
            </div>
          </div>
          <div className="text-center">
            <p className="text-xs text-blue-200">STATUS</p>
            <p className="font-bold text-md">{currentAgent.status}</p>
          </div>
        </div>

        {/* Key Capabilities */}
        <div>
          <h3 className="text-md font-semibold text-gray-700 mb-2 flex items-center">
            <ShieldCheckIcon className="h-5 w-5 mr-2 text-gray-500" />
            Key Capabilities
          </h3>
          <div className="bg-white rounded-lg p-3 space-y-2 shadow-sm">
            {capabilities.map((cap) => (
              <div key={cap.name} className="flex items-center text-gray-600 border-b border-gray-100 pb-1 last:border-b-0">
                <cap.icon className="h-5 w-5 mr-3 text-blue-500" />
                <span>{cap.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Network */}
        <div>
          <h3 className="text-md font-semibold text-gray-700 mb-2 flex items-center">
            <ShareIcon className="h-5 w-5 mr-2 text-gray-500" />
            Agent Network
          </h3>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-sm text-gray-500 mb-2">Can handoff to:</p>
            <div className="flex flex-wrap gap-2">
              {handoffAgents.map((agent) => (
                <span key={agent.name} className="px-3 py-1 bg-gray-200 text-gray-800 rounded-full text-sm font-medium">
                  {agent.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Live Metrics */}
        <div>
          <h3 className="text-md font-semibold text-gray-700 mb-2 flex items-center">
            <ClockIcon className="h-5 w-5 mr-2 text-gray-500" />
            Live Metrics
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {metrics.map((metric) => (
              <div key={metric.name} className="bg-white rounded-lg p-3 shadow-sm flex items-center">
                <metric.icon className="h-6 w-6 mr-3 text-green-500" />
                <div>
                  <p className="text-sm text-gray-500">{metric.name}</p>
                  <p className="font-bold text-lg text-gray-800">{metric.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentVisualizer; 