const User = require("../Models/User");
const generateToken = require("../utils/generateToken");

const handleOAuthCallback = async (req, res) => {
  if (!req.user) {
    return res.redirect(
      `${process.env.FRONTEND_URL || "http://localhost:5173"}/login?error=${encodeURIComponent("Authentication failed")}`
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
      
      console.log(decoded)
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
        // User already exists, redirect to login page with suggestion to login instead
        const errorMessage = existingUser.provider === provider 
          ? "Account already exists with this email. Please sign in instead."
          : `Email already registered with ${existingUser.provider || "another method"}. Try logging in instead.`;
        
        return res.redirect(
          `${redirectBase}/login?error=${encodeURIComponent(errorMessage)}&suggest=login`
        );
      }

      // Create new user (registration)
      const newUser = await User.create({
        name: profile.name,
        email: profile.email,
        providerId: profile.id,
        provider: provider,
        isAdmin: false
      });

      // After successful registration, redirect to login page with success message
      return res.redirect(
        `${redirectBase}/login?success=${encodeURIComponent("Account created successfully! Please log in.")}&registered=true`
      );

    } else {
      // LOGIN FLOW
      if (!existingUser) {
        // User doesn't exist, redirect to register page with suggestion to register
        return res.redirect(
          `${redirectBase}/register?error=${encodeURIComponent(
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

      // Successful login - redirect to oauth-success page with user data
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

module.exports = handleOAuthCallback;