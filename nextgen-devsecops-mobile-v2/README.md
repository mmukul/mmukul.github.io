# NextGen DevSecOps AI — Simple Mobile App v0.2

A simple React Native / Expo app based on the website base working copy `index_main_page_BASE_WORKING_v197.html`.

## Included
- Home
- Services: Individual Training, Corporate Training, Interview Preparation, Consulting & Advisory
- Training Delivered / Clients & Training Engagements
- About Mukul with 20 / 6+ / 2+ experience points
- Let's Connect form UI
- Simple bottom-tab navigation
- No Mentoring service
- Dark indigo / cyan visual language
- Supabase client foundation only

## Not connected yet
- Authentication
- Secure contact submission / Turnstile
- Razorpay payment
- Student Portal
- Admin Portal
- Push notifications

## Run
```powershell
npm install
npx expo start
```
Then scan the QR code using Expo Go.

For Android emulator:
```powershell
npx expo start --android
```

For a network fallback:
```powershell
npx expo start --tunnel
```

## Security
Only use the Supabase publishable key in the mobile app. Never include a service-role key, Razorpay secret, database password, or Turnstile secret.
