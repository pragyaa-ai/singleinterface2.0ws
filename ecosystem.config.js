module.exports = {
  apps: [
    {
      name: 'voiceagent-telephony',
      script: 'npm',
      args: 'run telephony',
      cwd: '/opt/voiceagent',
      env: {
        NODE_ENV: 'production'
        // OPENAI_API_KEY will be loaded from .env file or system environment
      },
      env_production: {
        NODE_ENV: 'production'
        // OPENAI_API_KEY will be loaded from .env file or system environment
      }
    },
    {
      name: 'voiceagent-queue-processor',
      script: 'src/server/agents/queueProcessor.js',
      cwd: '/opt/voiceagent',
      env: {
        NODE_ENV: 'production'
        // OPENAI_API_KEY will be loaded from .env file or system environment
      },
      env_production: {
        NODE_ENV: 'production'
        // OPENAI_API_KEY will be loaded from .env file or system environment
      },
      restart_delay: 5000,
      max_restarts: 5,
      min_uptime: '10s'
    }
  ]
}
