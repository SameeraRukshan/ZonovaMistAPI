# ZonovaMistAPI
🧠 Zonova Mist Admin – Release Notes
🏷️ Version 4 (v1.0.0)

Release Date: October 2025
Deployment:

Backend: Render

Frontend: Play Store (Android) – Internal Testing

Web Testing: Flutter Web via Chrome

🚀 Overview

Zonova Mist Admin is a complete management system built for partners and administrators to manage hotel data efficiently.
It includes a robust Node.js backend with a Flutter-powered frontend, ensuring seamless integration between data and UI.

🖥️ Frontend (Flutter + Dart)

Platform: Android, Web
Key Features:

🌆 Partner Hotels Management Interface

✏️ Edit, Add, and Delete Hotel details

🖼️ Integrated Image Manager (CommonImageManager)

🔄 Real-time Refresh with Riverpod State Management

💬 Snackbar Feedback for all CRUD operations

🎨 Modern UI using Material Design & Flutter Slidable

⚙️ Configurable API base via AppConfig

Build Info:

Built with Flutter 3.x (Stable Channel)

Supports Android (AAB upload via Play Console)

Optimized for both Mobile and Web Testing

🧩 Backend (Node.js + Express + MongoDB)

Tech Stack:

Node.js

Express

MongoDB (Mongoose ORM)

CORS, Dotenv, Body-Parser

Render for Deployment

API Highlights:

🏨 Full CRUD for Hotels (/partner-hotels)

🌍 Query by city or star rating

🔗 MongoDB integration via Mongoose

🔒 CORS properly configured for Flutter Web access

⚙️ Error handling with descriptive JSON responses

Improvements in v1.0.0:

Enhanced error handling and validation

Refined CORS setup to support cross-origin requests

Consistent JSON structure for all responses

Stability updates to prevent server disconnections

🧰 Development Notes

Always run flutter clean and flutter pub get before creating new builds.

Backend uses environment variables (.env) for sensitive configuration – not committed to Git.

Use npm start (Render) or nodemon server.js (local testing).