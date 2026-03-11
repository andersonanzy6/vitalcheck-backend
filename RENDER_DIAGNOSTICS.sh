#!/bin/bash
# Backend Health Check Script

echo "🔍 VitalCheck Backend Diagnostics"
echo "================================"
echo ""

# Test if backend is accessible
echo "1️⃣  Testing Backend Connection..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://vitalcheck-56uj.onrender.com/)
if [ "$RESPONSE" == "200" ]; then
  echo "✅ Backend is running (HTTP $RESPONSE)"
else
  echo "❌ Backend responded with HTTP $RESPONSE"
  echo "   Visit: https://vitalcheck-56uj.onrender.com/ (should show {\"status\":\"API running\"})"
fi

echo ""
echo "2️⃣  Critical Environment Variables Needed on Render:"
echo "   ✓ MONGO_URI - MongoDB connection string"
echo "   ✓ JWT_SECRET - JWT signing key"
echo "   ✓ CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET"
echo "   ✓ EMAIL_USER, EMAIL_PASSWORD"
echo ""

echo "3️⃣  To Fix Profile Update Error:"
echo "   Step 1: Go to Render Dashboard"
echo "   Step 2: Select your backend service"
echo "   Step 3: Go to 'Environment' tab"
echo "   Step 4: Add missing variables (see above)"
echo "   Step 5: Service will auto-redeploy"
echo ""

echo "4️⃣  To Debug Further:"
echo "   - Check Render logs for MongoDB connection errors"
echo "   - Look for 'JWT_SECRET not found' errors"
echo "   - Verify all required env vars are present"
