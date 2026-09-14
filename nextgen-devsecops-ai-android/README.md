# NextGen DevSecOps AI — Android App v2 Architecture

Android-only React Native + Expo app structure.

## Removed for now
- Assignments

## Navigation
Bottom tabs:
- Home
- Courses
- Class Recordings
- Cloud Lab
- Progress
- Profile

Secondary screens:
- Course details
- Modules
- Lesson
- Certificates
- Certificate details

## Backend
Uses the same Supabase Auth/database as the existing NextGen DevSecOps AI website and Student LMS.

Never include the Supabase service-role/secret key in the app.

## Build
npm install
npx expo start
npx expo start --android

APK:
eas build --platform android --profile preview
