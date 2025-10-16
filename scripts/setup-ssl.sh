#!/bin/bash

# SSL自動セットアップスクリプト（Ubuntu/Debian用）
# 使用方法: sudo ./setup-ssl.sh your-domain.com your-email@example.com

set -e

# 色の定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 引数チェック
if [ $# -ne 2 ]; then
    echo -e "${RED}エラー: ドメインとメールアドレスを指定してください${NC}"
    echo "使用方法: sudo $0 your-domain.com your-email@example.com"
    exit 1
fi

DOMAIN=$1
EMAIL=$2

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  SSL/HTTPS セットアップスクリプト${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "ドメイン: $DOMAIN"
echo "Email: $EMAIL"
echo ""

# rootチェック
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}このスクリプトはroot権限で実行してください${NC}"
    echo "実行方法: sudo $0 $DOMAIN $EMAIL"
    exit 1
fi

# DNSチェック
echo -e "${YELLOW}[1/7] DNS設定を確認中...${NC}"
if ! host $DOMAIN > /dev/null 2>&1; then
    echo -e "${RED}警告: $DOMAIN のDNSが設定されていません${NC}"
    echo "続行する前にDNSを設定してください"
    exit 1
fi
echo -e "${GREEN}✓ DNS設定OK${NC}"

# Nginxインストール
echo -e "${YELLOW}[2/7] Nginxをインストール中...${NC}"
apt update -qq
apt install -y nginx
systemctl enable nginx
systemctl start nginx
echo -e "${GREEN}✓ Nginxインストール完了${NC}"

# Certbotインストール
echo -e "${YELLOW}[3/7] Certbotをインストール中...${NC}"
apt install -y certbot python3-certbot-nginx
echo -e "${GREEN}✓ Certbotインストール完了${NC}"

# ファイアウォール設定
echo -e "${YELLOW}[4/7] ファイアウォールを設定中...${NC}"
if command -v ufw &> /dev/null; then
    ufw allow 'Nginx Full'
    ufw delete allow 'Nginx HTTP' 2>/dev/null || true
    echo -e "${GREEN}✓ ファイアウォール設定完了${NC}"
else
    echo -e "${YELLOW}⚠ ufwが見つかりません（スキップ）${NC}"
fi

# Nginx設定ファイル作成
echo -e "${YELLOW}[5/7] Nginx設定ファイルを作成中...${NC}"
cat > /etc/nginx/sites-available/monstdb << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN;

    # SSL証明書（Certbotが設定）
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    # セキュリティヘッダー
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /_next/static {
        proxy_pass http://localhost:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml+rss text/javascript;
}
EOF

ln -sf /etc/nginx/sites-available/monstdb /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
echo -e "${GREEN}✓ Nginx設定ファイル作成完了${NC}"

# Nginx設定テスト
echo -e "${YELLOW}[6/7] Nginx設定をテスト中...${NC}"
if nginx -t; then
    systemctl reload nginx
    echo -e "${GREEN}✓ Nginx設定テスト成功${NC}"
else
    echo -e "${RED}✗ Nginx設定エラー${NC}"
    exit 1
fi

# SSL証明書取得
echo -e "${YELLOW}[7/7] SSL証明書を取得中...${NC}"
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ SSL証明書取得成功${NC}"
else
    echo -e "${RED}✗ SSL証明書取得失敗${NC}"
    exit 1
fi

# 完了メッセージ
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  セットアップ完了！${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "✓ Nginx: インストール済み"
echo "✓ Certbot: インストール済み"
echo "✓ SSL証明書: 取得済み"
echo "✓ 自動更新: 有効"
echo ""
echo -e "${YELLOW}次のステップ:${NC}"
echo "1. .env.productionを編集:"
echo "   NEXTAUTH_URL=\"https://$DOMAIN\""
echo ""
echo "2. アプリケーションを起動:"
echo "   npm start"
echo "   または"
echo "   pm2 start npm --name monstdb -- start"
echo ""
echo "3. ブラウザでアクセス:"
echo "   https://$DOMAIN"
echo ""
echo -e "${GREEN}SSL証明書は自動的に更新されます！${NC}"
