module.exports = {
  apps: [{
    name: 'voiceagent-telephony-python',
    script: 'src/server/telephony-python/main.py',
    interpreter: 'python3',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PYTHON_PORT: '8081',
      HOST: '0.0.0.0',
      // Copy all env vars from main .env file
      // These will be read by python-dotenv
    },
    error_file: './logs/telephony-python-error.log',
    out_file: './logs/telephony-python-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Restart policy
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Environment-specific overrides
    env_production: {
      NODE_ENV: 'production'
    },
    env_development: {
      NODE_ENV: 'development'
    }
  }]
};

