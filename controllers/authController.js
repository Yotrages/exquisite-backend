const User = require("../Models/User");
const generateToken = require("../utils/generateToken");

const handleOAuthCallback = async (req, res) => {
  if (!req.user) {
    return res.redirect(
      `${process.env.FRONTEND_URL || "http://localhost:3000"}/login?error=${encodeURIComponent("Authentication failed")}`
    );
  }

  const { profile, provider } = req.user;
  const redirectBase = process.env.FRONTEND_URL || "http://localhost:3000";
  let intent = "login"; // Default to login
  let successRedirect = "oauth-success";

  // Parse state parameter to get intent
  try {
    if (req.query.state) {
      const decoded = JSON.parse(Buffer.from(req.query.state, "base64").toString());
      intent = decoded.intent || "login";
      successRedirect = decoded.redirectUrl || "oauth-success";
      
      // Check if state is expired (20 minutes)
      const timestamp = decoded.timestamp;
      if (timestamp && Date.now() - timestamp > 20 * 60 * 1000) {
        throw new Error("State parameter expired");
      }
    }
  } catch (error) {
    console.warn("Could not decode state parameter:", error);
    return res.redirect(
      `${redirectBase}/login?error=${encodeURIComponent("Invalid authentication state")}`
    );
  }

  try {
    const existingUser = await User.findOne({ email: profile.email });

    if (intent === "register") {
      // REGISTRATION FLOW
      if (existingUser) {
        // User already exists, can't register again
        if (existingUser.provider !== provider) {
          return res.redirect(
            `${redirectBase}/register?error=${encodeURIComponent(
              `Email already registered with ${existingUser.provider || "another method"}. Try logging in instead.`
            )}&suggest=login`
          );
        } else {
          return res.redirect(
            `${redirectBase}/register?error=${encodeURIComponent(
              "Account already exists with this email. Please sign in instead."
            )}&suggest=login`
          );
        }
      }

      // Create new user (registration)
      const newUser = await User.create({
        name: profile.name,
        email: profile.email,
        providerId: profile.id,
        provider: provider,
        isAdmin: false
      });

      const token = generateToken(existingUser._id, existingUser.isAdmin);

      // Redirect to success page after successful registration
      return res.redirect(
        `${redirectBase}/${successRedirect}?token=${token}&type=register&id=${newUser._id}&name=${encodeURIComponent(
          newUser.name || ""
        )}&isAdmin=${encodeURIComponent(newUser.isAdmin)}&new=true`
      );

    } else {
      // LOGIN FLOW
      if (!existingUser) {
        // User doesn't exist, can't login
        return res.redirect(
          `${redirectBase}/login?error=${encodeURIComponent(
            "No account found with this email. Please register first."
          )}&suggest=register`
        );
      }

      // Check if provider matches
      if (existingUser.provider !== provider) {
        return res.redirect(
          `${redirectBase}/login?error=${encodeURIComponent(
            `This email is registered with ${existingUser.provider || "another method"}. Please use that method to sign in.`
          )}`
        );
      }

      // Successful login
      const token = generateToken(existingUser._id, existingUser.isAdmin);

      return res.redirect(
        `${redirectBase}/${successRedirect}?token=${token}&type=login&id=${existingUser._id}&name=${encodeURIComponent(
          existingUser.name || ""
        )}&isAdmin=${encodeURIComponent(existingUser.isAdmin)}`
      );
    }

  } catch (error) {
    console.error("OAuth error:", error);
    
    // Redirect to appropriate page based on intent
    const redirectPage = intent === "register" ? "register" : "login";
    return res.redirect(
      `${redirectBase}/${redirectPage}?error=${encodeURIComponent(
        "Authentication failed. Please try again."
      )}`
    );
  }
};

// Helper function to generate state parameter for OAuth URLs
// const generateOAuthState = (intent, redirectUrl) => {
//   const state = {
//     intent,
//     redirectUrl: redirectUrl || "oauth-success",
//     timestamp: Date.now()
//   };
//   return Buffer.from(JSON.stringify(state)).toString("base64");
// };

// // Example usage in your OAuth routes
// const initiateGoogleOAuth = (intent) => {
//   return (req, res, next) => {
//     const state = generateOAuthState(intent, req.query.redirect);
//     // Add state to your passport authenticate call
//     req.query.state = state;
//     next();
//   };
// };

module.exports = handleOAuthCallback