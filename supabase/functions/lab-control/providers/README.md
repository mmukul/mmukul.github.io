# E2E Networks provider integration — Website v311

## Implemented in v311

- Admin-only E2E OS-plan discovery via `GET /api/v1/images/`.
- Admin-only provisioning of one E2E node for an approved NextGen internal student workspace via `POST /api/v1/nodes/`.
- Workspace-to-provider node mapping, provider status and IP synchronization.
- Start, stop and restart via `PUT /api/v1/nodes/{node_id}/actions/` with `power_on`, `power_off`, and `reboot`.
- Add SSH public key via the same actions endpoint with `type: add_ssh_keys`.
- Delete a node via `DELETE /api/v1/nodes/{node_id}/`.
- Admin workspace table displays provider node ID, provider status and public IP.
- Provider operations remain feature-gated by `E2E_WRITE_ENABLED=true`.

## Required database migration

Apply `supabase/lab-e2e-provisioning-v311.sql` before deploying the v311 `lab-control` Edge Function. It adds provider mapping columns to `public.lab_workspaces` and a unique partial index for provider node IDs. The migration intentionally fails with a clear error if the existing internal `lab_workspaces` table is absent.

## E2E API authentication

The supplied MyAccount OpenAPI spec documents the following authentication pattern:

- Query parameters: `project_id`, `apikey`, and `location` for node, image and action operations.
- Header: `Authorization: Bearer <API_TOKEN>`.
- API token creation: `POST /api/v1/apis/token/` with `token_name` and `access_name`. The supplied schema accepts `access_name: ["read"]` or `access_name: ["read", "write"]`.
- Token creation itself requires an existing Bearer token. Obtain the initial token from the E2E account console or E2E support. The token-create response contains `api_key` and `auth_token`.

Store the resulting API key and Bearer auth token only in Supabase Edge Function Secrets:

- `E2E_API_BASE_URL=https://api.e2enetworks.com/myaccount`
- `E2E_API_KEY=<E2E API key>`
- `E2E_API_TOKEN=<E2E Bearer auth token with READ and WRITE permissions>`
- `E2E_PROJECT_ID=62333` (confirm against the actual E2E project)
- `E2E_LOCATION=Chennai` (must match the region selected in the OS plan)
- `E2E_MAX_NODES=3` (pilot safety cap; increase only after reviewing cost and capacity)
- `E2E_WRITE_ENABLED=false` initially

After successful read-only validation and confirmation that the installed E2E token has both READ and WRITE access, set `E2E_WRITE_ENABLED=true` to enable provider mutations. Do not expose any of these secrets in browser code, SQL, Git, logs or client-visible configuration.

## Provisioning workflow

1. Approve an internal lab deployment so that individual `lab_workspaces` rows are queued.
2. Apply the v311 migration.
3. Configure and test the E2E read-only credentials.
4. Load OS plans in Admin Portal. Plans are read from `GET /api/v1/images/`; only a plan/image pair matching the configured location is accepted.
5. Paste the student's single-line OpenSSH public key.
6. Select **Provision E2E VPS** for one queued/failed workspace. The function creates exactly one node (`number_of_instances: 1`) and maps the returned numeric node ID to that workspace.
7. Use Start / Stop / Restart / Add SSH key / Sync / Terminate controls for the mapped node.
8. Keep the student workspace in `provisioning` until the environment setup, SSH and terminal checks are complete. Provider `Running` status alone does not mark the student workspace `ready`.

## Safety and operational notes

- All write operations are admin-session authenticated and server-side only.
- The function validates that the target workspace belongs to an internal NextGen deployment.
- Creation requires a valid OS plan/image pair from the provider's current OS-plan response and one valid SSH public key.
- `E2E_MAX_NODES` caps active mapped nodes; default is 3. This is a count cap, not a substitute for a financial budget control.
- The E2E create API schema does not document an idempotency key. The implementation uses a database claim and unique provider-instance mapping to reduce duplicate submissions. If a create request times out, fails after submission, or returns no node ID, the workspace is marked `create_unknown` and automatic retry is blocked. Reconcile the E2E console first; only reset the workspace to `create_failed` after confirming no billable node was created.
- Termination uses the documented **Delete Node** endpoint `DELETE /api/v1/nodes/{node_id}/`. The unrelated `/terminate-request/` endpoint in this specification is tagged for license management, not VPS node termination.
- Start/stop/restart requests can be asynchronous. The function returns the last provider status it can read; use Sync to refresh.
- Adding an SSH key only submits the public key to E2E. Test actual SSH connectivity before declaring the student environment ready.
- The v311 package does not yet provide a browser terminal gateway, scheduled expiry worker, or automated cost/billing reconciliation. Those remain follow-up work.
- Never terminate a node automatically solely because a student workspace expired until expiry policy, data-retention policy and provider deletion behaviour have been tested.

## Validation status

The package can be syntax-checked and the ZIP structure verified locally. No live E2E API calls, VPS creation, lifecycle operation, Supabase migration, or Supabase deployment were performed in this environment. Validate with one test workspace and one billable VPS before enabling student rollout.


## v332 — NextGen standard
The Admin and Student experiences use NextGen Cloud naming. The cloud API provider remains an internal adapter only. Learner SSH key entry has been removed; the centrally configured NextGen bootstrap public key is used for provisioning. Student launch is routed through the signed-ticket NextGen terminal gateway.
