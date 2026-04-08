# Cash Request System - Server Deployment Guide (PM2)

Complete guide for deploying the backend on your own Linux server using PM2.

---

## 📋 Prerequisites

### Server Requirements:
- **OS:** Ubuntu 20.04+ / Debian 11+ / CentOS 8+ (or any Linux distro)
- **RAM:** Minimum 1GB (2GB recommended)
- **Storage:** Minimum 2GB free space
- **Node.js:** v18.x or higher
- **Access:** SSH access with sudo privileges

### What You'll Need:
- Server IP address
- SSH credentials (username/password or private key)
- Domain name (optional, but recommended)

---

## 🚀 Quick Deployment (TL;DR)

```bash
# On your server:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs nginx
sudo npm install -g pm2
git clone <your-repo-url> /var/www/cash-request-backend
cd /var/www/cash-request-backend/backend
cp .env.example .env
nano .env  # Configure your environment variables
npm install --production
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

---

## 📝 Step-by-Step Deployment

### Step 1: Connect to Your Server

```bash
# From your local machine
ssh username@your-server-ip

# Example:
ssh root@192.168.1.100
```

---

### Step 2: Update System & Install Node.js

```bash
# Update package list
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v18.x or higher
npm --version   # Should show v9.x or higher

# Install build tools (needed for some npm packages)
sudo apt-get install -y build-essential
```

---

### Step 3: Install PM2 (Process Manager)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Verify installation
pm2 --version
```

**What is PM2?**
- Keeps your app running 24/7
- Auto-restarts on crashes
- Zero-downtime deployments
- Built-in load balancer
- Log management
- Startup script generation

---

### Step 4: Create Application Directory

```bash
# Create directory for your app
sudo mkdir -p /var/www/cash-request-backend

# Change ownership to your user
sudo chown -R $USER:$USER /var/www/cash-request-backend

# Navigate to directory
cd /var/www/cash-request-backend
```

---

### Step 5: Upload Your Code

**Option A: Using Git (Recommended)**

```bash
# Clone your repository
git clone https://github.com/yourusername/cash-request-workflow.git .

# Or if using a private repo with SSH key:
git clone git@github.com:yourusername/cash-request-workflow.git .

# Navigate to backend directory
cd backend
```

**Option B: Using SCP (from your local machine)**

```bash
# From your local machine (not on server):
cd /Users/maicoltd/Desktop/cash-request-workflow
scp -r backend/ username@your-server-ip:/var/www/cash-request-backend/

# Then SSH into server:
ssh username@your-server-ip
cd /var/www/cash-request-backend/backend
```

**Option C: Using FTP/SFTP**
- Use FileZilla, WinSCP, or Cyberduck
- Connect to your server
- Upload the `backend` folder to `/var/www/cash-request-backend/`

---

### Step 6: Configure Environment Variables

```bash
# Navigate to backend directory
cd /var/www/cash-request-backend/backend

# Create .env file
nano .env
```

**Paste this configuration (update with your values):**

```env
# MongoDB Configuration
MONGODB_URI=mongodb+srv://Junior:Hello123@cluster0.pgfk40u.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0

# JWT Secret (generate a strong random string)
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

# Server Port
PORT=3000

# Email Configuration (Gmail)
EMAIL_USER=gasanadj2003@gmail.com
EMAIL_PASSWORD=pgyjiltevqkldhmt
EMAIL_FROM_NAME=Cash Request System
RECOVERY_CODE=D6L5W-J7AP9-BE2AC-229K7-TZRKG

# Frontend URL (your server's public IP or domain)
FRONTEND_URL=http://your-server-ip:8080
# Or if you have a domain:
# FRONTEND_URL=https://cashrequest.yourdomain.com
```

**Save and exit:**
- Press `Ctrl + X`
- Press `Y` to confirm
- Press `Enter`

**Security Note:** Change `JWT_SECRET` to a random string. Generate one:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Step 7: Install Dependencies

```bash
# Install Node.js packages (production only)
npm install --production

# This will install:
# - express, mongoose, socket.io, nodemailer, etc.
# - Takes 1-2 minutes
```

---

### Step 8: Create Logs Directory

```bash
# Create logs directory for PM2
mkdir -p logs

# Set proper permissions
chmod 755 logs
```

---

### Step 9: Start with PM2

```bash
# Start the application
pm2 start ecosystem.config.js --env production

# You should see:
# ┌────┬────────────────────────┬──────────┬──────┬───────────┐
# │ id │ name                   │ mode     │ ↺    │ status    │
# ├────┼────────────────────────┼──────────┼──────┼───────────┤
# │ 0  │ cash-request-backend   │ fork     │ 0    │ online    │
# └────┴────────────────────────┴──────────┴──────┴───────────┘
```

**Check if it's running:**

```bash
# View status
pm2 status

# View logs (live)
pm2 logs cash-request-backend

# You should see:
# ✅ Connected to MongoDB
# ✅ Email service initialized successfully (Gmail)
# Server running on port 3000
```

**If you see errors:**
- Check MongoDB connection string in .env
- Check Gmail credentials
- View error logs: `pm2 logs cash-request-backend --err`

---

### Step 10: Configure PM2 Startup (Auto-restart on Reboot)

```bash
# Save current PM2 process list
pm2 save

# Generate startup script
pm2 startup

# It will show a command like:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u username --hp /home/username

# Copy and run that command (it's different for each system)
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

# Now PM2 will auto-start on server reboot!
```

---

### Step 11: Install & Configure Nginx (Reverse Proxy)

**Why Nginx?**
- Serve frontend on port 80/443 (standard HTTP/HTTPS)
- Proxy backend API requests to port 3000
- SSL/TLS certificate support
- Better performance and security

```bash
# Install Nginx
sudo apt-get install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/cash-request
```

**Paste this configuration:**

```nginx
server {
    listen 80;
    server_name your-server-ip;  # Or your domain: cashrequest.yourdomain.com

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
    }

    # WebSocket support for Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Frontend (optional - if hosting frontend on same server)
    location / {
        root /var/www/cash-request-frontend/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

**Enable the site:**

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/cash-request /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Should show:
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# Restart Nginx
sudo systemctl restart nginx

# Enable Nginx on boot
sudo systemctl enable nginx
```

---

### Step 12: Configure Firewall

```bash
# Allow SSH (important - don't lock yourself out!)
sudo ufw allow ssh
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow backend port (if accessing directly)
sudo ufw allow 3000/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

### Step 13: Test Your Deployment

**Test Backend API:**

```bash
# From server:
curl http://localhost:3000/

# From your local machine:
curl http://your-server-ip/api/

# Should return API response
```

**Test in Browser:**

Open your browser and go to:
- Backend API: `http://your-server-ip/api/`
- Frontend: `http://your-server-ip/`

---

## 🔧 PM2 Management Commands

### Basic Commands:

```bash
# View all running apps
pm2 list
pm2 status

# View logs (live)
pm2 logs cash-request-backend

# View only error logs
pm2 logs cash-request-backend --err

# View logs history
pm2 logs cash-request-backend --lines 100

# Stop application
pm2 stop cash-request-backend

# Start application
pm2 start cash-request-backend

# Restart application
pm2 restart cash-request-backend

# Reload without downtime (zero-downtime)
pm2 reload cash-request-backend

# Delete from PM2
pm2 delete cash-request-backend

# Show detailed info
pm2 show cash-request-backend

# Monitor CPU/Memory
pm2 monit
```

### Useful Commands:

```bash
# Clear logs
pm2 flush

# Restart all apps
pm2 restart all

# Stop all apps
pm2 stop all

# Save current process list
pm2 save

# Resurrect saved process list
pm2 resurrect

# Update PM2 itself
npm install -g pm2@latest
pm2 update
```

---

## 🔄 Updating Your Application

When you make changes to your code:

### Option 1: Git Pull (Recommended)

```bash
# SSH into server
ssh username@your-server-ip

# Navigate to app directory
cd /var/www/cash-request-backend/backend

# Pull latest changes
git pull origin main

# Install new dependencies (if any)
npm install --production

# Reload app with PM2 (zero-downtime)
pm2 reload cash-request-backend

# Or restart (brief downtime)
pm2 restart cash-request-backend
```

### Option 2: Upload Files

```bash
# From your local machine:
scp -r backend/ username@your-server-ip:/var/www/cash-request-backend/

# Then SSH in and restart:
ssh username@your-server-ip
cd /var/www/cash-request-backend/backend
npm install --production
pm2 restart cash-request-backend
```

---

## 📊 Monitoring & Logs

### View Logs:

```bash
# Real-time logs
pm2 logs cash-request-backend

# View log files directly
tail -f logs/out.log
tail -f logs/error.log

# Last 50 lines
pm2 logs cash-request-backend --lines 50
```

### Monitor Resources:

```bash
# Interactive monitoring
pm2 monit

# Show CPU/Memory usage
pm2 status
```

### PM2 Web Dashboard (Optional):

```bash
# Install PM2 Web
pm2 install pm2-server-monit

# Access at: http://your-server-ip:9615/
```

---

## 🔒 Security Best Practices

### 1. Change Default Ports:

```bash
# Edit .env
nano .env

# Change PORT from 3000 to something else
PORT=8080
```

### 2. Use Strong JWT Secret:

```bash
# Generate random secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Add to .env
JWT_SECRET=your_generated_secret_here
```

### 3. Set Up SSL/TLS (HTTPS):

```bash
# Install Certbot for Let's Encrypt
sudo apt-get install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d cashrequest.yourdomain.com

# Certbot will auto-configure Nginx for HTTPS!
# Certificates auto-renew every 90 days
```

### 4. Restrict Database Access:

In MongoDB Atlas:
- Go to Network Access
- Add your server's IP address
- Remove `0.0.0.0/0` if present (allows all IPs)

### 5. Regular Updates:

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update npm packages
cd /var/www/cash-request-backend/backend
npm update
pm2 restart cash-request-backend
```

---

## 🐛 Troubleshooting

### App Not Starting:

```bash
# Check PM2 logs
pm2 logs cash-request-backend --err

# Common issues:
# 1. MongoDB connection failed → Check MONGODB_URI in .env
# 2. Port already in use → Change PORT in .env
# 3. Missing dependencies → Run: npm install --production
```

### Email Not Sending:

```bash
# Check logs
pm2 logs cash-request-backend | grep -i email

# Verify Gmail credentials in .env
# Ensure Gmail app password is correct (16 characters, no spaces)
```

### Cannot Connect from Frontend:

```bash
# Check Nginx is running
sudo systemctl status nginx

# Check Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Check firewall
sudo ufw status
```

### PM2 Process Keeps Restarting:

```bash
# View restart count
pm2 status

# If restart count is high, check error logs
pm2 logs cash-request-backend --err

# Check memory usage (may be out of memory)
pm2 show cash-request-backend
free -h
```

---

## 📦 Complete Deployment Checklist

Before going live, verify:

- [ ] Node.js v18+ installed
- [ ] PM2 installed and configured
- [ ] MongoDB connection working (check logs)
- [ ] Email service initialized (check logs)
- [ ] .env file configured correctly
- [ ] App running with PM2: `pm2 status`
- [ ] PM2 startup script enabled: `pm2 save && pm2 startup`
- [ ] Nginx installed and configured
- [ ] Firewall configured (ports 80, 443, 22 open)
- [ ] Frontend URL updated in .env
- [ ] SSL certificate installed (if using HTTPS)
- [ ] Database seeder run: `node seeders/createAdmin.js`
- [ ] Test backend API: `curl http://your-server-ip/api/`
- [ ] Test from browser
- [ ] Monitor logs for 10 minutes: `pm2 logs`

---

## 🚀 Quick Reference Card

```bash
# Start app
pm2 start ecosystem.config.js --env production

# Stop app
pm2 stop cash-request-backend

# Restart app
pm2 restart cash-request-backend

# View logs
pm2 logs cash-request-backend

# View status
pm2 status

# Update code (git)
cd /var/www/cash-request-backend/backend
git pull && npm install --production && pm2 reload cash-request-backend

# Restart Nginx
sudo systemctl restart nginx

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 📞 Support & Resources

**PM2 Documentation:** https://pm2.keymetrics.io/docs/usage/quick-start/
**Nginx Documentation:** https://nginx.org/en/docs/
**MongoDB Atlas:** https://www.mongodb.com/docs/atlas/

**Server Management Tools:**
- **Monitoring:** Netdata, Prometheus + Grafana
- **Backups:** MongoDB Atlas auto-backup, or `mongodump`
- **Security:** Fail2ban, UFW firewall

---

**Status:** ✅ Ready for deployment
**Estimated Setup Time:** 30-45 minutes
**Difficulty:** Intermediate

Your backend will be accessible at:
- **API:** `http://your-server-ip/api/`
- **WebSocket:** `ws://your-server-ip/socket.io/`
