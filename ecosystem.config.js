module.exports = {
  apps: [
    {
      name: "vezin",
      script: "npm",
      args: "run deploy",
      cwd: "/var/www/vezin",
      env: {
        NODE_ENV: "production",
      },
      // Uygulama çöktüğünde otomatik yeniden başlat
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      // Loglar
      error_file: "/var/log/pm2/vezin-error.log",
      out_file: "/var/log/pm2/vezin-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
