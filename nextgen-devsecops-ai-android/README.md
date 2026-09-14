# NextGen DevSecOps AI — Android App v2

Android-only React Native + Expo student application.

## Current scope

Included:
- Student Login
- Welcome Student
- My Courses
- Course Details
- Modules
- Lessons
- Class Recordings
- Cloud Lab
- My Progress
- Certificates
- Profile

Removed for now:
- Assignments

## Supabase

Uses the same Supabase project as the existing website, Student LMS and Admin Portal.

Course flow:
Student -> enrollments -> courses -> modules -> lessons

The app relies on the existing Supabase Row Level Security policies for access control.

## Run

```bash
npm install
npx expo start
npx expo start --android
```

## APK

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

Do not put a Supabase service-role/secret key in the Android application.
