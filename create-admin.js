const bcrypt = require("bcryptjs");

// Generate hashed password for admin@123
const password = "admin@123";
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hashedPassword) => {
  if (err) {
    console.error("Error hashing password:", err);
    process.exit(1);
  }

  console.log("\n✅ Use this document in MongoDB Atlas:\n");
  console.log(JSON.stringify({
    name: "Admin User",
    email: "admin@healthconsult.com",
    password: hashedPassword,
    role: "admin",
    status: "active",
    isAdmin: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }, null, 2));
  
  console.log("\n📋 Steps:");
  console.log("1. Go to MongoDB Atlas → Collections");
  console.log("2. Find 'users' collection");
  console.log("3. Click 'Insert Document'");
  console.log("4. Paste the JSON above");
  console.log("5. Click 'Insert'\n");
});
