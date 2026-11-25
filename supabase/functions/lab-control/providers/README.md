# VPS provider adapter — current status

The current v309 implementation supports authenticated lab requests, admin approval,
individual workspace records, and manual workspace status updates. It does **not**
create, resize, stop, or delete VPS instances. The provider adapter remains fail-closed.

## Current admin workflow
1. Admin creates an internal or external deployment request.
2. Admin approves the request; one queued workspace record is created per active enrolled student.
3. Admin marks a workspace as provisioning while setting it up.
4. Only after the isolated environment is tested, admin enters its HTTPS URL and marks it ready.
5. The student portal displays Launch only for a ready workspace with a valid HTTPS URL.

## Provider integration prerequisites
- Use the selected provider's current official API documentation and account identifiers.
- Implement the `VpsProviderAdapter` contract in a provider-specific module.
- Validate credentials, region, plan, image, SSH key, quotas, and pricing using read-only calls first.
- Store API credentials only as Supabase Edge Function secrets.
- Add idempotency, ownership tags, budget and node caps, audit logs, rollback tests, and explicit admin approval before enabling create/delete.

Do not infer endpoint URLs, request fields, plan IDs, image IDs, or pricing. The current
manual workflow is intentionally available while automated provisioning remains disabled.

## E2E Networks read-only API (v310)

The lab-control Edge Function now supports admin-only GET operations: list nodes, get one node, and read server-health/health-info. It does not call any E2E write/action endpoint. The existing-VPS workflow remains separate from automated provisioning.

Configure Supabase Edge Function Secrets: `E2E_API_BASE_URL`, `E2E_API_KEY`, `E2E_API_TOKEN`, `E2E_PROJECT_ID=62333`, and `E2E_LOCATION=Chennai`. Confirm the exact location identifier in the E2E console if the API rejects `Chennai`. Never put credentials in the Admin Portal, frontend, SQL, or Git.

The API token creation operation in the supplied OpenAPI requires an existing Bearer token. Obtain the initial token from the E2E account console or E2E support; do not attempt to create one from API key alone.
