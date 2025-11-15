# Deploying to GitHub Pages

## Setup Instructions

1. **Create a GitHub Repository**
   - Create a new repository on GitHub (e.g., `swifto-trip-pay-calculator`)
   - Push your code to the repository

2. **Configure GitHub Pages**
   - Go to your repository Settings → Pages
   - Source: Select "GitHub Actions"

3. **Add Firebase Secrets**
   - Go to your repository Settings → Secrets and variables → Actions
   - Add the following secrets:
     - `NEXT_PUBLIC_FIREBASE_API_KEY`
     - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
     - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
     - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
     - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
     - `NEXT_PUBLIC_FIREBASE_APP_ID`

4. **Update Repository Name (if needed)**
   - If your repository name is different, update `next.config.js`:
     - Change `basePath` and `assetPrefix` to match your repository name
     - Example: If repo is `my-app`, use `/my-app`

5. **Push to Main Branch**
   - Push your code to the `main` branch
   - GitHub Actions will automatically build and deploy

6. **Access Your App**
   - Your app will be available at: `https://[your-username].github.io/[repository-name]`
   - Example: `https://drizzy.github.io/swifto-trip-pay-calculator`

## Local Testing

To test the production build locally:

```bash
npm run build
npx serve out
```

## Notes

- The app uses static export, so all routes must be defined at build time
- Firebase environment variables are required for the app to work
- Make sure your Firebase project allows your GitHub Pages domain in authorized domains

