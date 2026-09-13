# invite-student Edge Function

Deploy this function to the same Supabase project. It lets an active Admin Portal user invite a student without exposing the service-role key to GitHub Pages.

## Deploy

From a Supabase CLI environment:

```bash
supabase functions deploy invite-student
```

The function uses the platform-provided `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` environment variables. Do not put the service-role key in source control.

## Auth email settings

Set the Site URL / redirect allow-list to include:

`https://mmukul.github.io/student-portal/reset-password.html`

The invitation email lets the student complete account setup and set a password.
