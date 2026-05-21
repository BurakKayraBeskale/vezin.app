#!/bin/bash
cd /var/www/vezin
git stash
git pull origin main
npm install
npm run build
pm2 restart vezin
echo "Deploy tamamlandı!"
