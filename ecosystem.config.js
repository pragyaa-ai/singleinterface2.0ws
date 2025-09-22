module.exports = {
  apps: [
    {
      name: 'voiceagent-next',
      script: 'npm',
      args: 'run start',
      cwd: '/opt/voiceagent',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    },
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
