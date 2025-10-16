# 🔒 Let's Encrypt で SSL/HTTPS 化する手順

## 前提条件

- ✅ 独自ドメインを取得済み（例: monstdb.example.com）
- ✅ DNSがサーバーのIPアドレスに設定済み
- ✅ ポート80と443が開いている
- ✅ Linuxサーバー（Ubuntu/Debian推奨）

---

## 方法1: Nginx + Certbot（推奨）

### ステップ1: Nginxのインストール

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx -y

# CentOS/RHEL
sudo yum install nginx -y

# Nginxの起動
sudo systemctl start nginx
sudo systemctl enable nginx
```

### ステップ2: Certbotのインストール

```bash
# Ubuntu/Debian
sudo apt install certbot python3-certbot-nginx -y

# CentOS/RHEL
sudo yum install certbot python3-certbot-nginx -y
```

### ステップ3: SSL証明書の取得

```bash
# ドメインを自分のものに変更
sudo certbot --nginx -d monstdb.example.com

# 複数ドメイン対応
sudo certbot --nginx -d monstdb.example.com -d www.monstdb.example.com
```

対話的に以下を聞かれます：
1. メールアドレス入力（更新通知用）
2. 利用規約に同意
3. HTTPリダイレクト設定（推奨: Yes）

### ステップ4: Nginx設定ファイルの作成

```bash
sudo nano /etc/nginx/sites-available/monstdb
```

以下の内容を記述：

```nginx
# HTTP -> HTTPS リダイレクト
server {
    listen 80;
    listen [::]:80;
    server_name monstdb.example.com;
    
    # Let's Encrypt検証用
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # 全てHTTPSにリダイレクト
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS設定
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name monstdb.example.com;

    # SSL証明書（Certbotが自動設定）
    ssl_certificate /etc/letsencrypt/live/monstdb.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/monstdb.example.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # セキュリティヘッダー
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Next.jsへプロキシ
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # タイムアウト設定
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 静的ファイルのキャッシュ
    location /_next/static {
        proxy_pass http://localhost:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # 画像ファイルのキャッシュ
    location ~* \.(jpg|jpeg|png|gif|ico|svg|webp)$ {
        proxy_pass http://localhost:3000;
        add_header Cache-Control "public, max-age=86400";
    }
}
```

### ステップ5: 設定を有効化

```bash
# シンボリックリンク作成
sudo ln -s /etc/nginx/sites-available/monstdb /etc/nginx/sites-enabled/

# デフォルト設定を無効化（必要に応じて）
sudo rm /etc/nginx/sites-enabled/default

# 設定テスト
sudo nginx -t

# Nginx再起動
sudo systemctl restart nginx
```

### ステップ6: 環境変数の更新

```bash
# .env.productionを編集
nano .env.production
```

```env
NEXTAUTH_URL="https://monstdb.example.com"
```

### ステップ7: アプリケーションの再起動

```bash
# PM2使用の場合
pm2 restart monstdb

# 通常起動の場合
npm start
```

---

## 方法2: Caddy（最も簡単）

Caddyは自動的にLet's Encryptを設定してくれます。

### ステップ1: Caddyのインストール

```bash
# Ubuntu/Debian
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

### ステップ2: Caddyfile作成

```bash
sudo nano /etc/caddy/Caddyfile
```

以下の内容（たったこれだけ！）：

```caddy
monstdb.example.com {
    reverse_proxy localhost:3000
    
    # 自動的にHTTPS化される
    # Let's Encryptも自動設定
    
    # セキュリティヘッダー
    header {
        Strict-Transport-Security "max-age=31536000;"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        X-XSS-Protection "1; mode=block"
    }
}
```

### ステップ3: Caddy再起動

```bash
sudo systemctl restart caddy
sudo systemctl enable caddy
```

完了！Caddyが自動的にSSL証明書を取得・更新します。

---

## 方法3: Docker + Nginx + Certbot

### docker-compose.ymlの拡張

```yaml
version: '3.8'

services:
  app:
    build: .
    expose:
      - "3000"
    environment:
      - DATABASE_URL=file:./prod.db
      - NEXTAUTH_URL=https://monstdb.example.com
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
    volumes:
      - ./prisma:/app/prisma
      - sqlite-data:/app/data
    restart: unless-stopped
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    depends_on:
      - app
    restart: unless-stopped
    networks:
      - app-network

  certbot:
    image: certbot/certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
    restart: unless-stopped

volumes:
  sqlite-data:

networks:
  app-network:
    driver: bridge
```

### 初回証明書取得スクリプト

```bash
#!/bin/bash

# init-letsencrypt.sh
domains=(monstdb.example.com)
email="your-email@example.com"
staging=0 # 本番は0、テストは1

# 証明書取得
docker-compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    --email $email \
    -d $domains \
    --rsa-key-size 4096 \
    --agree-tos \
    --force-renewal" certbot

docker-compose restart nginx
```

---

## 🔄 自動更新の設定

### Nginxの場合

Certbotは自動更新タイマーを設定します：

```bash
# 自動更新の確認
sudo systemctl status certbot.timer

# 手動更新テスト
sudo certbot renew --dry-run
```

### Caddyの場合

自動更新は標準で有効。何もする必要なし！

---

## ✅ 確認方法

### SSL証明書のテスト

```bash
# OpenSSLで確認
openssl s_client -connect monstdb.example.com:443 -servername monstdb.example.com

# curlで確認
curl -I https://monstdb.example.com
```

### オンラインツール

- https://www.ssllabs.com/ssltest/
- https://www.whynopadlock.com/

---

## 🐛 トラブルシューティング

### 証明書取得エラー

```bash
# ファイアウォールの確認
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# ポートの確認
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443

# DNSの確認
nslookup monstdb.example.com
dig monstdb.example.com
```

### 更新エラー

```bash
# ログ確認
sudo journalctl -u certbot
sudo tail -f /var/log/letsencrypt/letsencrypt.log

# 手動更新
sudo certbot renew --force-renewal
```

---

## 📋 チェックリスト

- [ ] ドメインを取得済み
- [ ] DNSをサーバーIPに設定済み
- [ ] ポート80, 443を開放
- [ ] Nginx/Caddyをインストール
- [ ] Certbotで証明書取得
- [ ] Nginx設定ファイル作成
- [ ] NEXTAUTH_URLをHTTPSに変更
- [ ] アプリケーション再起動
- [ ] HTTPSでアクセス確認
- [ ] SSL Labsでテスト

---

## 💡 おすすめの構成

### 個人・小規模: Caddy
- 設定が最も簡単
- 自動HTTPS
- メンテナンス不要

### 中規模・企業: Nginx + Certbot
- 高性能
- カスタマイズ性が高い
- 広く使われている

### Docker環境: Docker Compose + Nginx + Certbot
- コンテナ化
- ポータビリティ
- 環境の再現性
