#!/bin/bash
cd /var/www/vezin

# .env.local dosyasını yedekle
cp .env.local /tmp/env.backup

# git güncelle
git pull origin main

# .env.local dosyasını geri yükle
cp /tmp/env.backup .env.local

npm install
npm run build
pm2 restart vezin --update-env

echo "Deploy tamamlandı!"
