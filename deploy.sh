#!/bin/bash
cd /var/www/vezin

# .env dosyasını yedekle
cp .env .env.backup

# git güncelle
git stash
git pull origin main

# .env dosyasını geri yükle
cp .env.backup .env

npm install
npm run build
pm2 restart vezin --update-env

echo "Deploy tamamlandı!"
