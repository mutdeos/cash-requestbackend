#!/bin/bash

###############################################################################
# SSL Setup Script for Cash Request Backend
# Generates self-signed certificate and configures Nginx with HTTPS
#
# Usage: sudo bash setup-ssl.sh
###############################################################################

set -e  # Exit on error

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Cash Request Backend - SSL Setup Script               ║"
echo "║     Setting up HTTPS with self-signed certificate         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root: sudo bash setup-ssl.sh"
    exit 1
fi

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "📍 Detected Server IP: $SERVER_IP"
echo ""

# Step 1: Create SSL directory
echo "📁 Creating SSL directory..."
mkdir -p /etc/nginx/ssl
chmod 700 /etc/nginx/ssl

# Step 2: Generate self-signed certificate
echo "🔐 Generating self-signed SSL certificate..."
echo "   (This will be valid for 365 days)"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/cash-request.key \
    -out /etc/nginx/ssl/cash-request.crt \
    -subj "/C=US/ST=State/L=City/O=CashRequest/OU=IT/CN=$SERVER_IP"

# Set proper permissions
chmod 600 /etc/nginx/ssl/cash-request.key
chmod 644 /etc/nginx/ssl/cash-request.crt

echo "✅ SSL certificate generated"
echo ""

# Step 3: Configure Nginx
echo "⚙️  Configuring Nginx for HTTPS..."

cat > /etc/nginx/sites-available/cash-request <<'NGINX_CONFIG'
# HTTP Server - Redirect to HTTPS
server {
    listen 80;
    server_name _;

    # Redirect all HTTP traffic to HTTPS
    return 301 https://$host$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    server_name _;

    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/cash-request.crt;
    ssl_certificate_key /etc/nginx/ssl/cash-request.key;

    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # CORS Headers
        add_header Access-Control-Allow-Origin "https://cashrequisition.netlify.app" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
        add_header Access-Control-Allow-Credentials "true" always;

        # Handle preflight requests
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "https://cashrequisition.netlify.app";
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "Authorization, Content-Type";
            add_header Access-Control-Max-Age 86400;
            add_header Content-Length 0;
            return 204;
        }
    }

    # WebSocket support for Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # CORS for WebSocket
        add_header Access-Control-Allow-Origin "https://cashrequisition.netlify.app" always;
        add_header Access-Control-Allow-Credentials "true" always;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "OK";
        add_header Content-Type text/plain;
    }
}
NGINX_CONFIG

# Enable the site
ln -sf /etc/nginx/sites-available/cash-request /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

echo "✅ Nginx configuration created"
echo ""

# Step 4: Test Nginx configuration
echo "🧪 Testing Nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration has errors. Please check the output above."
    exit 1
fi
echo ""

# Step 5: Restart Nginx
echo "🔄 Restarting Nginx..."
systemctl restart nginx
systemctl enable nginx

echo "✅ Nginx restarted successfully"
echo ""

# Step 6: Configure firewall
echo "🔥 Configuring firewall..."

# Check if UFW is installed
if command -v ufw &> /dev/null; then
    echo "   Configuring UFW firewall..."
    ufw allow 22/tcp comment 'SSH'
    ufw allow 80/tcp comment 'HTTP'
    ufw allow 443/tcp comment 'HTTPS'
    ufw --force enable
    echo "✅ UFW firewall configured"
else
    echo "⚠️  UFW not installed. Please configure your firewall manually to allow ports 80, 443, and 22."
fi
echo ""

# Step 7: Display summary
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                 🎉 SSL Setup Complete!                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 Summary:"
echo "   • SSL certificate generated (valid for 365 days)"
echo "   • Nginx configured with HTTPS on port 443"
echo "   • HTTP (port 80) redirects to HTTPS"
echo "   • Firewall configured (ports 22, 80, 443)"
echo "   • CORS enabled for Netlify frontend"
echo ""
echo "🌐 Your backend is now accessible at:"
echo "   https://$SERVER_IP/api/"
echo ""
echo "⚠️  IMPORTANT - Update Frontend:"
echo "   In your frontend .env file, change:"
echo "   From: VUE_APP_API_URL=http://$SERVER_IP:3000"
echo "   To:   VUE_APP_API_URL=https://$SERVER_IP/api"
echo ""
echo "⚠️  Browser Warning:"
echo "   Self-signed certificates trigger a security warning in browsers."
echo "   Users must click 'Advanced' → 'Proceed to site' on first visit."
echo "   This is normal and expected."
echo ""
echo "🧪 Test your setup:"
echo "   curl -k https://$SERVER_IP/api/"
echo ""
echo "📝 To view certificate details:"
echo "   openssl x509 -in /etc/nginx/ssl/cash-request.crt -text -noout"
echo ""
echo "✅ Setup complete! Your backend now uses HTTPS."
echo ""
