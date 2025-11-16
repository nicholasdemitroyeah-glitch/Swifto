# Swifto: Trip & Pay Calculator

A web app for Swift truck drivers to track trips, loads, stops, and calculate pay.

## Features

- Google Authentication
- Track trips with mileage
- Add loads and stops to trips
- Calculate pay based on CPM, loads, and stops
- Weekly earnings dashboard with graphs
- Edit trips, loads, and stops
- Mobile-friendly design

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up Firebase:
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Google Authentication
   - Create a Firestore database
   - Copy your Firebase config to `.env.local`

3. Create `.env.local` file (or use the runtime config file noted below):
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

   If you prefer not to store credentials in environment variables (for example when deploying a static export to GitHub Pages), copy `public/firebase-config.example.js` to `public/firebase-config.js`, fill in the same values, and keep that file out of version control (it is already ignored via `.gitignore`). The runtime script is loaded before the app boots so authentication works even when env vars are unavailable.

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

