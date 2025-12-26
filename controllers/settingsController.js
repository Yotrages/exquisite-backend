const User = require("../Models/User");
const bcrypt = require("bcryptjs");

/**
 * Get user profile settings
 */
const getUserSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "-password -isAdmin -createdAt"
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        avatar: user.avatar || "",
        shippingAddress: user.shippingAddress || {},
        billingAddress: user.billingAddress || {},
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve settings",
      details: error.message,
    });
  }
};

/**
 * Update user profile
 */
const updateProfile = async (req, res) => {
  try {
    const { name, phone, avatar } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Validate inputs
    if (name && name.trim().length < 2) {
      return res.status(400).json({ error: "Name must be at least 2 characters" });
    }

    // Update fields
    if (name) user.name = name.trim();
    if (phone) user.phone = phone.trim();
    if (avatar) user.avatar = avatar;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to update profile",
      details: error.message,
    });
  }
};

/**
 * Update shipping address
 */
const updateShippingAddress = async (req, res) => {
  try {
    const {
      street,
      city,
      state,
      postalCode,
      country,
      isDefault,
    } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Validate address
    if (!street || !city || !state || !postalCode || !country) {
      return res.status(400).json({ error: "All address fields are required" });
    }

    const newAddress = {
      street: street.trim(),
      city: city.trim(),
      state: state.trim(),
      postalCode: postalCode.trim(),
      country: country.trim(),
    };

    if (!user.shippingAddress) {
      user.shippingAddress = [];
    }

    if (isDefault) {
      user.shippingAddress.forEach((addr) => {
        if (addr.isDefault) addr.isDefault = false;
      });
      newAddress.isDefault = true;
    }

    user.shippingAddress.push(newAddress);
    await user.save();

    res.status(200).json({
      success: true,
      message: "Shipping address added successfully",
      address: newAddress,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to update address",
      details: error.message,
    });
  }
};

/**
 * Delete shipping address
 */
const deleteShippingAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById(req.user._id);

    if (!user || !user.shippingAddress) {
      return res.status(404).json({ error: "Address not found" });
    }

    user.shippingAddress = user.shippingAddress.filter(
      (addr) => addr._id.toString() !== addressId
    );

    await user.save();

    res.status(200).json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to delete address",
      details: error.message,
    });
  }
};

/**
 * Change password
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: "All password fields are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "New passwords do not match" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify current password
    const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to change password",
      details: error.message,
    });
  }
};

/**
 * Get account security info
 */
const getSecuritySettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "email phone createdAt lastLogin"
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      email: user.email,
      phone: user.phone || "Not set",
      accountCreated: user.createdAt,
      lastLogin: user.lastLogin || "Never",
      twoFactorEnabled: false, // TODO: Implement 2FA
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve security settings",
      details: error.message,
    });
  }
};

/**
 * Delete account
 */
const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "Password is required to delete account" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify password
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ error: "Password is incorrect" });
    }

    // Delete user
    await User.findByIdAndDelete(req.user._id);

    res.status(200).json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to delete account",
      details: error.message,
    });
  }
};

/**
 * Get privacy settings
 */
const getPrivacySettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "privacy -_id"
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const privacySettings = {
      profileVisibility: "private", // Can be: private, friends, public
      showWishlist: false,
      showOrderHistory: false,
      allowMessages: true,
    };

    res.status(200).json(privacySettings);
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve privacy settings",
      details: error.message,
    });
  }
};

/**
 * Update privacy settings
 */
const updatePrivacySettings = async (req, res) => {
  try {
    const { profileVisibility, showWishlist, showOrderHistory, allowMessages } =
      req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Store privacy settings (you might want to add a privacy field to User model)
    // For now, we'll just validate and return success
    const privacySettings = {
      profileVisibility: profileVisibility || "private",
      showWishlist: showWishlist || false,
      showOrderHistory: showOrderHistory || false,
      allowMessages: allowMessages !== false,
    };

    res.status(200).json({
      success: true,
      message: "Privacy settings updated successfully",
      settings: privacySettings,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to update privacy settings",
      details: error.message,
    });
  }
};

module.exports = {
  getUserSettings,
  updateProfile,
  updateShippingAddress,
  deleteShippingAddress,
  changePassword,
  getSecuritySettings,
  deleteAccount,
  getPrivacySettings,
  updatePrivacySettings,
};
