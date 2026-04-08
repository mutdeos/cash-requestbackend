# Resend Email Setup Guide for Render Deployment

## ✅ Problem Solved

**Render blocks SMTP ports (587, 465)** - that's why Gmail/Nodemailer was timing out.

**Solution:** Switched to **Resend** - uses HTTP API instead of SMTP ports.

---

## 🚀 Quick Setup (5 minutes)

### Step 1: Sign Up for Resend

1. Go to **https://resend.com/signup**
2. Sign up with your email (free tier: 3,000 emails/month, 100/day)
3. Verify your email

### Step 2: Get Your API Key

1. After logging in, go to **https://resend.com/api-keys**
2. Click **"Create API Key"**
3. Name it: `Cash Request System - Production`
4. Permissions: **Full Access**
5. Copy the API key (starts with `re_`)

**Example:** `re_123abc456def789ghi012jkl345mno678`

### Step 3: Configure Render Environment Variables

1. Go to your **Render Dashboard**
2. Select your backend service
3. Click **Environment** tab
4. Add these variables:

```env
RESEND_API_KEY=re_YOUR_ACTUAL_API_KEY_HERE
EMAIL_FROM=onboarding@resend.dev
EMAIL_FROM_NAME=Cash Request System
FRONTEND_URL=https://cashrequisition.netlify.app
```

5. Click **"Save Changes"**
6. Render will automatically redeploy

### Step 4: Install Resend Locally

```bash
cd backend
npm install
```

This installs the `resend` package already added to package.json.

### Step 5: Update Local .env

Replace `RESEND_API_KEY=re_YOUR_API_KEY_HERE` with your actual API key:

```env
RESEND_API_KEY=re_123abc456def789ghi012jkl345mno678
EMAIL_FROM=onboarding@resend.dev
EMAIL_FROM_NAME=Cash Request System
```

---

## 📧 Testing Email Setup

### Using Resend Test Email (onboarding@resend.dev)

The default `EMAIL_FROM=onboarding@resend.dev` is Resend's **test email address**.

**Important:** When using the test email:
- ✅ Emails will **only** be sent to your **verified email** (the one you used to sign up)
- ❌ Other users won't receive emails yet
- Perfect for testing!

**To test:**
1. Deploy to Render with the new configuration
2. Check Render logs for: `✅ Email service initialized successfully (Resend API)`
3. Create a new user in your app with **your verified email**
4. You should receive a welcome email!

### Check Resend Dashboard

1. Go to **https://resend.com/emails**
2. You'll see all sent emails with status:
   - ✅ **Delivered**
   - ⏳ **Sent** (in transit)
   - ❌ **Bounced** (invalid recipient)

---

## 🏢 Production Setup (Send to All Users)

To send emails to **any email address** (not just your verified email), you need to verify your domain.

### Option 1: Use Your Own Domain (Recommended)

**Example:** Your company website is `mycompany.com`

1. Go to **https://resend.com/domains**
2. Click **"Add Domain"**
3. Enter your domain: `mycompany.com`
4. Add the provided DNS records to your domain:
   - **TXT record** (for verification)
   - **MX record** (for bounce handling)
   - **CNAME records** (for DKIM)

5. Wait for DNS propagation (5-60 minutes)
6. Click **"Verify Domain"**
7. Update Render environment variable:
   ```env
   EMAIL_FROM=noreply@mycompany.com
   ```

**Now emails can be sent to anyone!**

### Option 2: Use a Subdomain

If you don't want to affect your main domain:

1. Use a subdomain: `notifications.mycompany.com`
2. Follow same DNS setup as above
3. Set:
   ```env
   EMAIL_FROM=noreply@notifications.mycompany.com
   ```

### Option 3: Use Resend's Shared Domain (Testing Only)

Keep using `onboarding@resend.dev` but:
- Emails only go to **your verified email**
- **Not suitable for production**

---

## 🔍 Verification Checklist

After deploying to Render, check these in order:

### 1. Check Render Logs

**Success message:**
```
✅ Email service initialized successfully (Resend API)
   Sending from: Cash Request System <onboarding@resend.dev>
```

**If using test email, you'll also see:**
```
⚠️  Using Resend test email - emails will only be delivered to your verified email
   For production: verify your domain and update EMAIL_FROM in .env
```

**Failure message (API key missing):**
```
⚠️  RESEND_API_KEY not configured - email notifications disabled
```

**Failure message (wrong API key):**
```
❌ Email service initialization failed: Invalid API key
```

### 2. Test Email Sending

**Test 1: Welcome Email**
1. Login as admin
2. Go to Admin Panel
3. Create new user with **your verified email**
4. Check your inbox for welcome email

**Test 2: Request Notification**
1. Create a cash request
2. Check if approver receives email

**Test 3: Check Resend Dashboard**
- Go to https://resend.com/emails
- See sent emails with delivery status

---

## 📊 Free Tier Limits

Resend Free Tier:
- ✅ **3,000 emails/month**
- ✅ **100 emails/day**
- ✅ Unlimited API keys
- ✅ Email analytics

**Is this enough?**
- 50 users × 5 notifications/day = **250 emails/day** ❌ (exceeds limit)
- 50 users × 2 notifications/day = **100 emails/day** ✅ (within limit)

**If you need more:** Upgrade to Pro ($20/month for 50,000 emails)

---

## 🔧 Troubleshooting

### Issue 1: "RESEND_API_KEY not configured"

**Fix:** Add `RESEND_API_KEY` to Render environment variables

### Issue 2: "Invalid API key"

**Causes:**
- API key copied wrong (missing characters)
- API key includes quotes `"re_xxx"` (remove quotes)
- Used old/deleted API key

**Fix:** Generate new API key and update Render env vars

### Issue 3: Emails not arriving

**Check:**
1. Resend dashboard - is email marked as "Delivered"?
2. Using test email? - Only goes to verified address
3. Check spam folder
4. Check email address is correct

### Issue 4: "Email service initialization failed"

**Check Render logs for exact error:**
```bash
# In Render Dashboard → Logs
```

Common causes:
- Missing `resend` package (run `npm install`)
- Wrong API key format
- Network issue (very rare with HTTP API)

---

## 🆚 Resend vs Gmail SMTP

| Feature | Gmail SMTP | Resend API |
|---------|-----------|-----------|
| **Works on Render** | ❌ (ports blocked) | ✅ (HTTP API) |
| **Free Tier** | ✅ Unlimited | ✅ 3,000/month |
| **Setup Time** | 10 minutes | 5 minutes |
| **Deliverability** | Good | Excellent |
| **Monitoring** | ❌ No dashboard | ✅ Full analytics |
| **Custom Domain** | ❌ Gmail only | ✅ Your domain |
| **Production Ready** | ⚠️ Not recommended | ✅ Yes |

---

## 📝 Environment Variables Summary

### Required for Basic Testing:
```env
RESEND_API_KEY=re_YOUR_API_KEY
EMAIL_FROM=onboarding@resend.dev
EMAIL_FROM_NAME=Cash Request System
FRONTEND_URL=https://cashrequisition.netlify.app
```

### Required for Production:
```env
RESEND_API_KEY=re_YOUR_API_KEY
EMAIL_FROM=noreply@yourdomain.com  # ← Your verified domain
EMAIL_FROM_NAME=Cash Request System
FRONTEND_URL=https://cashrequisition.netlify.app
```

---

## 🎯 Next Steps

**Immediate (Testing):**
1. ✅ Get Resend API key
2. ✅ Add `RESEND_API_KEY` to Render
3. ✅ Deploy and check logs
4. ✅ Test with your verified email

**Before Production Launch:**
1. ⏳ Verify your company domain on Resend
2. ⏳ Update `EMAIL_FROM` to your domain
3. ⏳ Test emails to all user roles
4. ⏳ Monitor Resend dashboard for delivery rates

---

## 🔗 Useful Links

- **Resend Dashboard:** https://resend.com/emails
- **API Keys:** https://resend.com/api-keys
- **Domain Setup:** https://resend.com/domains
- **Resend Docs:** https://resend.com/docs/introduction
- **Pricing:** https://resend.com/pricing

---

## 💬 Support

If you encounter issues:

1. **Check Render logs** for exact error message
2. **Check Resend dashboard** for email delivery status
3. **Verify API key** is correct in Render environment variables
4. **Test locally** first before deploying to Render

---

**Status:** ✅ Ready to deploy
**Estimated Setup Time:** 5 minutes
**Works on:** Render, Heroku, Railway, Vercel, Netlify Functions, all cloud platforms
