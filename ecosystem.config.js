module.exports = {
  apps: [
    {
      name: 'cash-request-backend',
      script: './server.js',

      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },

      // PM2 behavior
      instances: 1,
      exec_mode: 'fork',

      // Auto restart
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',

      // Logging
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Advanced features
      max_memory_restart: '500M',
      restart_delay: 4000,

      // Source control
      ignore_watch: [
        'node_modules',
        'logs',
        'uploads',
        '.git'
      ],

      // Environment-specific configs
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ],

  // Deployment configuration (optional - for PM2 deploy)
  deploy: {
    production: {
      user: 'root',
      host: 'YOUR_SERVER_IP',
      ref: 'origin/main',
      repo: 'git@github.com:username/cash-request-workflow.git',
      path: '/var/www/cash-request-backend',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};
