# 🔧 Profile Update 500 Error - Troubleshooting Guide

## 📋 Root Cause

The **PUT /api/auth/profile** endpoint is returning **500 (Internal Server Error)**. This indicates a server-side failure, most likely due to:

1. **Missing environment variables on Render** (most likely)
   - `MONGO_URI` - Database connection string
   - `JWT_SECRET` - JWT signing key
   - Cloudinary credentials (if uploading images)

2. **Database connection failure**
   - MongoDB Atlas connection string expired or invalid
   - VPN/IP whitelist issues

3. **Authentication failure**
   - Token expired or invalid
   - Auth middleware can't verify token

---

## ✅ Step-by-Step Fix

### Step 1: Verify Backend is Running
Visit: `https://vitalcheck-56uj.onrender.com/`

**Expected response**: `{"status":"API running"}`

If you get:
- ❌ **Connection refused**: Backend isn't running
- ❌ **Timeout**: Render free tier may be sleeping (start it)
- ✅ **JSON response**: Backend is running

---

### Step 2: Set Environment Variables on Render

1. **Go to Render Dashboard**
   - https://dashboard.render.com/

2. **Select your backend service** (vitalcheck-56uj or similar)

3. **Click on "Environment" tab**

4. **Add these variables**:

```
# DATABASE (REQUIRED)
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database_name

# JWT (REQUIRED)
JWT_SECRET=your-super-secret-key-min-32-chars-change-in-production

# CLOUDINARY (Required for image uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# EMAIL SERVICE (For notifications)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password

# NODE ENVIRONMENT
NODE_ENV=production

# Optional: Payment gateways
FLUTTERWAVE_PUBLIC_KEY=pk_test_xxxxx
FLUTTERWAVE_SECRET_KEY=sk_test_xxxxx
PAYPAL_CLIENT_ID=xxxxx
PAYPAL_CLIENT_SECRET=xxxxx
```

5. **Save and wait for redeployment** (usually takes 1-2 minutes)

---

### Step 3: Check Render Logs

1. **In Render Dashboard, click "Logs"**
2. **Look for these messages**:

**✅ Good signs**:
```
✅ MongoDB connected successfully
```

**❌ Bad signs**:
```
❌ CRITICAL: MONGO_URI environment variable is not set!
❌ CRITICAL: JWT_SECRET not set
❌ MongoDB connection failed
```

---

### Step 4: Test the Profile Update Locally (Optional)

If you have the backend running locally:

```bash
cd backend
npm run dev
```

Test the endpoint:
```bash
curl -X PUT http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "age": 25,
    "phone": "1234567890"
  }'
```

---

### Step 5: Clear Frontend Cache & Try Again

1. **Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)**
2. **Clear browser cache**:
   - DevTools → Application → Clear Storage
3. **Login again**
4. **Try updating profile**

---

## 🆘 If Still Getting 500 Error

### Check 1: Verify MONGO_URI Format

Your MongoDB Atlas connection string should look like:
```
mongodb+srv://USERNAME:PASSWORD@cluster-name.mongodb.net/database_name?retryWrites=true
```

**Common issues**:
- ❌ Password contains `@` or special chars → URL-encode it
- ❌ Database name doesn't exist → Create it in MongoDB Atlas
- ❌ IP address not whitelisted → Add `0.0.0.0/0` (or your IP) in MongoDB Network Access

### Check 2: Verify JWT_SECRET

```bash
# Should be random, 32+ characters
# Example (generate a new one):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Output example: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

### Check 3: Check if Cloudinary is Required

If you're NOT uploading images, you can temporarily comment out file upload handling:

**File**: [backend/src/routes/auth.routes.js](backend/src/routes/auth.routes.js)

Look for this and verify it exists:
```javascript
router.put("/profile", auth, upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 }
]), updateProfile);
```

---

## 📝 Quick Checklist

- [ ] Visited `https://vitalcheck-56uj.onrender.com/` - got `{"status":"API running"}`
- [ ] Added `MONGO_URI` to Render env vars
- [ ] Added `JWT_SECRET` to Render env vars
- [ ] Added Cloudinary credentials to Render env vars
- [ ] Render service redeployed (wait 1-2 min)
- [ ] Checked Render logs - no errors
- [ ] Hard refreshed frontend
- [ ] Logged in again
- [ ] Tried updating profile

---

## 🚀 Next: Deploy Updated Backend

The backend code has been improved with better error logging. You should:

1. **Commit changes**:
   ```bash
   git add backend/src/
   git commit -m "Improve error logging for debugging"
   git push
   ```

2. **Render will auto-redeploy** if connected to GitHub

3. **Services will show better error messages** if something fails

---

## 📞 Need More Help?

If still stuck, check:
1. [DEPLOYMENT_AND_CONFIGURATION_GUIDE.md](../DEPLOYMENT_AND_CONFIGURATION_GUIDE.md)
2. [FRONTEND_BACKEND_INTEGRATION_GUIDE.md](../FRONTEND_BACKEND_INTEGRATION_GUIDE.md)
3. Check Render logs for exact error message
4. Verify all DB credentials are correct
