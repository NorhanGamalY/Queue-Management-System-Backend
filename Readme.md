# 🛠 Queue Management Backend

## Overview
This is the backend for a **Queue Management System** built with **Node.js**, **Express**, and **MongoDB**.  
It provides APIs for managing queues, users, and real-time updates via sockets.

---

## 🚀 Features
- RESTful API endpoints
- MongoDB database integration
- Modular folder structure for scalability
- Middleware support
- Socket.io for real-time communication
- Utility functions for reusable code
- Environment-based configuration

---

## 📁 Project Structure
backend/
├─ src/
│ ├─ controllers/ # Handles request logic
│ ├─ models/ # Mongoose models
│ ├─ routes/ # API routes
│ ├─ services/ # Business logic / service layer
│ ├─ middlewares/ # Express middlewares
│ ├─ utils/ # Helper functions
│ ├─ sockets/ # Socket.io setup and events
│ ├─ config/ # Configuration files
│ │ └─ db.js # Database connection
│ └─ server.js # Entry point of the server
├─ .env # Environment variables
├─ package.json # Project dependencies and scripts

---

## ⚙️ Environment Variables
Create a `.env` file in the root directory and add the following:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/queue_management

---

## 📦 Installation

1. Clone the repository:  
```bash
git clone <your-repo-url>
cd backend

## 📦 Install dependencies
npm install

## 📦 start the server
nodemon src/server

---

## 📝 Notes
- Make sure **MongoDB** is running locally.
- Empty folders can be tracked using `.gitkeep`.
- Unnecessary files like `node_modules/`, log files, and build outputs are ignored via `.gitignore`.
- Keep your `.env` file private; do **not** commit it to GitHub.

---

## 🛠 Tech Stack
- Node.js
- Express.js
- MongoDB / Mongoose
- Socket.io (optional for real-time updates)
