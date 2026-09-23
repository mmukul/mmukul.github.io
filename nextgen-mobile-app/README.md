# NextGen DevSecOps AI Mobile App — V1

A simple installable mobile web app/PWA companion for https://mmukul.github.io/.

## Data sync architecture
The app reads `data.json`. For production, place the same data file at the website root (for example `https://mmukul.github.io/data.json`) or replace `DATA_URL` in `app.js` with the shared Supabase/API endpoint.

Recommended next step: move courses, fees, batches, YouTube links and announcements into the existing Supabase project so both the website and mobile app read the same source of truth.
