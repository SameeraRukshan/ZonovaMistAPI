🧠 Zonova Mist Admin – Backend Release Notes
🏷️ Version 4 (v1.0.0)

Release Date: October 2025
Deployment:

Hosting: Render

Frontend Integration: Flutter (Android & Web)

🚀 Overview

Zonova Mist Admin (Backend) powers the administrative and partner management features for the Zonova Mist platform.
It’s a RESTful Node.js + Express API connected to MongoDB, providing secure CRUD operations for managing hotel data.

⚙️ Tech Stack

Runtime: Node.js

Framework: Express.js

Database: MongoDB (Mongoose)

Middleware: CORS, Body-Parser, Dotenv

Deployment: Render

🏨 Core API Features

✅ Create, Read, Update, Delete (CRUD) for Hotels

🔍 Search hotels by city or star rating

🕓 Automatic createdAt and updatedAt timestamps

💬 Structured JSON responses with detailed error messages

🌐 CORS enabled for Flutter Web requests

🧑‍💻 Setup & Run Locally
1️⃣ Clone and navigate
git clone <your-repo-link>
cd backend


2️⃣ Install dependencies
npm install

3️⃣ Create environment file

Inside the backend folder, create a .env file and add:

PORT=5000
MONGO_URI=____

4️⃣ Start the server

For development (auto-restart on save):

npm run dev


Uses nodemon for hot reload.

Or for production:

npm start


Server will start at:
👉 http://localhost:3000

🧪 Testing

Once running, test your API:

GET http://localhost:3000/


You should receive a list of hotel documents from MongoDB.

🧾 Current Release Highlights (v1.0.0)

🧠 Added full CRUD routes (GET, POST, PATCH, DELETE)

🌍 CORS setup for frontend API access

⚙️ Improved error handling and response structure

🕓 Auto timestamp updates for each modification

🔄 Stable connection with Render-hosted database

# Setup Instructions

## Google Vision API Credentials

1. Get the credentials from your team lead
2. Add to `backend/.env`:
```bash
   GOOGLE_CLOUD_CREDENTIALS='{"type":"service_account",...}'
```
3. Restart server

**Note:** Do NOT commit the `.env` file - it's in `.gitignore`