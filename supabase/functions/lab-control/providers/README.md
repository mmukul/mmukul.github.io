# VPS provider adapter

This directory is a provider-neutral integration contract only. It is deliberately
not connected to live infrastructure and cannot create, modify, or delete servers.

After E2E Networks (or another provider) is selected:
1. Obtain its current official API documentation and account-specific identifiers.
2. Implement `VpsProviderAdapter` in a provider-specific file.
3. Validate authentication, region, plan, image, SSH key and pricing.
4. Add credentials only as Supabase Edge Function secrets.
5. Test credential validation and read-only inventory first.
6. Enable create/delete only after explicit admin approval, idempotency, spend caps,
   node caps, ownership tags and rollback tests are in place.

Do not infer endpoint URLs, request fields, plan IDs or image IDs. They must come
from the provider's current API documentation and account console.
