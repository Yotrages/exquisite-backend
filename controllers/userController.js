const User = require("../Models/User");
const generateToken = require("../utils/generateToken");
const bcrypt = require("bcryptjs");

// Register User
const registerUser = async (req, res) => {
  const { name, email, password, isAdmin = false } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,  
      isAdmin,
    });

    if (user) {
      res.status(201).json({
        _id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// Login User
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(404).json({ message: "All fields are required" });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (user.password) {
     const matchPassword = await bcrypt.compare(password, user.password);
     if (!matchPassword) {
       return res.status(400).json({ message: "Invalid credentials" });
     }
    }

    const response = {
      _id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
    };

    if (user.isAdmin) {
      response.token = generateToken(user.id, user.isAdmin);
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("Login server error:", error);
    res.status(500).json({ message: "Server Error", error });
  }
};

// Change Password
const changePassword = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(404).json({ message: "All fields are required" });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: "Invalid email account" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await User.findOneAndUpdate(
      { email: user.email },
      { password: hashedPassword },
      { new: true }
    );

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

module.exports = { registerUser, loginUser, changePassword };
