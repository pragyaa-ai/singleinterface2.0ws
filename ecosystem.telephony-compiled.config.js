module.exports = {
  apps: [{
    name: 'voiceagent-telephony-compiled',
    script: 'dist/server/telephony/index.js',
    interpreter: 'node',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: '8080',
      HOST: '0.0.0.0',
      // RNNoise enabled by default in compiled version
      USE_NOISE_SUPPRESSION: 'true',
      USE_HIGH_QUALITY_RESAMPLING: 'true',
      RESAMPLING_QUALITY: 'MEDIUM',
    },
    error_file: './logs/telephony-compiled-error.log',
    out_file: './logs/telephony-compiled-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
  }]
};

