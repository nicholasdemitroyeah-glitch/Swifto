# Firestore Security Rules

Copy and paste these rules into your Firestore Database Rules in the Firebase Console.

## Steps:
1. Go to https://console.firebase.google.com/project/swifto-f21fc/firestore/rules
2. Replace the existing rules with the rules below
3. Click "Publish"

## Security Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Settings collection - users can only read/write their own settings
    match /settings/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Trips collection - users can only read/write their own trips
    match /trips/{tripId} {
      allow read: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
      allow update, delete: if request.auth != null && request.auth.uid == resource.data.userId;
    }
  }
}
```

## For Development (Test Mode):

If you want to allow all reads/writes during development (NOT recommended for production):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.time < timestamp.date(2025, 12, 31);
    }
  }
}
```

**Note:** The test mode rules above will expire on December 31, 2025. Make sure to update to the secure rules before then!

