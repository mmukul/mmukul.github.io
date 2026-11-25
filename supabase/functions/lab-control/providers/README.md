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
