const User = require("../Models/User");
const generateToken = require("../utils/generateToken");
const bcrypt = require("bcryptjs");

// Register User
const registerUser = async (req, res) => {
  const { name, email, password, isAdmin = false } = req.body;

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({
      name,
      email,
      password,
      isAdmin,
    });
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    if (user) {
      res.status(201).json({
        _id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        token: generateToken(user.id, user.isAdmin),
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

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const matchPassword = await bcrypt.compare(password, user.password);

    if (!matchPassword) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const check = user.isAdmin === true && generateToken(user.id, user.isAdmin);
    if (user && matchPassword) {
      console.log("Credentials matched");
      res.status(200).json({
        _id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        token: check,
      });
    } else {
      console.error("Invalid email or password");
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    console.error("Login server error:", error); // Debug log
    res.status(500).json({ message: "Server Error", error });
  }
};

const changePassword = async (req, res) => {
  const { email, password} = req.body;

  try {
    const salt = bcrypt.genSalt(10);
  const newPassword = bcrypt.hash(password, salt);

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email account" });
    }
    
    const updatedUser = await User.findOneAndUpdate(
      { email: user.email },
      { password: newPassword },
      { new: true }
    );
    return res
      .status(200)
      .json({ message: "Password updated successfully", updatedUser });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

module.exports = { registerUser, loginUser, changePassword };
