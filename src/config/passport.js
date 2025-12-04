const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userSchema");

// Check if environment variables exist
const clientID = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const callbackURL =
  process.env.GOOGLE_CALLBACK_URL ||
  "http://localhost:5000/api/auth/google/callback";

// Only configure Google Strategy if we have credentials
if (clientID && clientSecret) {
  console.log("✅ Configuring Google OAuth Strategy...");

  passport.use(
    new GoogleStrategy(
      {
        clientID: clientID,
        clientSecret: clientSecret,
        callbackURL: callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ email: profile.emails[0].value });

          if (!user) {
            user = await User.create({
              name: profile.displayName,
              email: profile.emails[0].value,
              googleId: profile.id,
              authProvider: "google",
              isEmailVerified: true, // Google emails are pre-verified
            });
          }

          done(null, user);
        } catch (err) {
          done(err, null);
        }
      },
    ),
  );

  // Serialize/Deserialize user
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
} else {
  console.warn("⚠️  Google OAuth is DISABLED - Missing credentials");
  console.warn(
    "   Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env",
  );
}

module.exports = passport;
