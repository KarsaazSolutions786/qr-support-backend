module.exports = {
  apps: [{
    name: 'karsaazqr-support',
    script: 'src/server.js',
    instances: 'max',  // Use all CPU cores
    exec_mode: 'cluster',
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3005,
    },
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    restart_delay: 1000,
    max_restarts: 10,
    watch: false,
  }]
};
