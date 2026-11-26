# External Labs — independent product scaffold

This application is deliberately separate from NextGen. It requires its own Supabase project, Auth users, database, deployment, secrets, billing configuration and operational ownership. Do not point it at the NextGen Supabase project.

## Setup
1. Create a dedicated Supabase project for External Labs.
2. Apply `supabase/schema.sql` in that project only.
3. Copy `config.js.example` to `config.js` and enter the dedicated project URL and anon key. The anon key is intended for browser use; never put a service-role key here.
4. Deploy the `external-labs/` directory to its own hosting target/domain.
5. Configure organization onboarding and invite users only into the External Labs Supabase Auth project.
6. Implement server-side E2E provisioning in a separately deployed Edge Function/service using External Labs project secrets. Never call NextGen `lab-control` for external users.
7. Add billing provider integration, audit/monitoring, secure browser terminal gateway and SSH key lifecycle before production use.

## Current scope
The portal includes independent Supabase password authentication scaffolding. Database tables and tenant RLS policies define organizations, memberships, catalogue, assignments, VPS instances and usage records. E2E provisioning, browser terminal proxy, SSH credential delivery, billing and organization onboarding are intentionally not enabled yet.
