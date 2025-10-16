# 🚀 SSL化クイックガイド

## 最も簡単な方法（自動スクリプト）

```bash
# サーバー上で実行
sudo ./scripts/setup-ssl.sh your-domain.com your-email@example.com
```

たったこれだけ！自動的に：
- ✅ Nginxインストール
- ✅ Certbotインストール
- ✅ SSL証明書取得
- ✅ Nginx設定
- ✅ 自動更新設定

---

## 手動で設定する場合

### 1. Nginxインストール
```bash
sudo apt update
sudo apt install nginx -y
```

### 2. Certbotインストール
```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 3. SSL証明書取得
```bash
sudo certbot --nginx -d your-domain.com
```

### 4. 設定ファイルをコピー
```bash
sudo cp nginx-template.conf /etc/nginx/sites-available/monstdb
# ドメイン名を編集
sudo nano /etc/nginx/sites-available/monstdb

sudo ln -s /etc/nginx/sites-available/monstdb /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. 環境変数更新
```bash
nano .env.production
```
```env
NEXTAUTH_URL="https://your-domain.com"
```

### 6. アプリ再起動
```bash
pm2 restart monstdb
```

---

## もっと簡単: Caddy使用

### 1. Caddyインストール
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

### 2. Caddyfile設定
```bash
sudo nano /etc/caddy/Caddyfile
```
```caddy
your-domain.com {
    reverse_proxy localhost:3000
}
```

### 3. Caddy起動
```bash
sudo systemctl restart caddy
```

完了！これだけで自動的にHTTPS化されます。

---

## 確認方法

```bash
# SSL証明書の確認
curl -I https://your-domain.com

# SSL Labs でテスト
# https://www.ssllabs.com/ssltest/
```

---

## トラブルシューティング

### ポートが開いているか確認
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

### DNSが正しいか確認
```bash
nslookup your-domain.com
dig your-domain.com
```

### Nginxログ確認
```bash
sudo tail -f /var/log/nginx/error.log
```

### Certbotログ確認
```bash
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

---

## 更新（90日ごと）

### 自動更新（推奨）
Certbotは自動的に証明書を更新します。

確認:
```bash
sudo systemctl status certbot.timer
```

### 手動更新
```bash
sudo certbot renew
sudo systemctl reload nginx
```

---

## まとめ

| 方法 | 難易度 | 推奨度 |
|-----|--------|--------|
| 自動スクリプト | ⭐ | ⭐⭐⭐⭐⭐ |
| Caddy | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| Nginx手動 | ⭐⭐⭐ | ⭐⭐⭐⭐ |

**初心者には自動スクリプトまたはCaddyを推奨！**
