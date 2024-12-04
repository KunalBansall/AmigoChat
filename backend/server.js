const mongoose = require("mongoose");
const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const socketIo = require("socket.io");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const updateAvatars = require("./utils/updateAvatars");
const { handleSocketConnection } = require("./controllers/chatController");
const User = require("./models/userModel"); // Import the User model

dotenv.config();
const app = express();

app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json());

// Routes
app.use("/auth", authRoutes);
app.use("/api", userRoutes);

// Serve static files from the React frontend app
app.use(express.static(path.join(__dirname, "../frontend/dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist", "index.html"));
});

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI, {})
  .then(() => {
    console.log("MongoDB is Connected Successfully");
    updateAvatars();
  })
  .catch((err) => console.error(err));

// Socket.io server setup
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
handleSocketConnection(io);

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
