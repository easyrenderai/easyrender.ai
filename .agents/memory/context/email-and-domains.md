---
name: email-and-domains
description: How easyrender.ai mail is set up: Google Workspace for inbound, Resend for sending on a subdomain, Route 53 for DNS
type: project
---

Inbound mail for `easyrender.ai` is Google Workspace (decided 2026-11-20, no extra licence): the
domain is a secondary domain of the owner's workspace. MX is Google's single record, SPF includes
Google (soft fail), DKIM selector `google` is on, DMARC is `p=none`. `vincent@` and `hello@` are
aliases; `jorge@` and `info@` are Google Groups whose one external member is the lead's own
inbox, with anyone allowed to post. Outbound product mail goes through Resend on
`send.easyrender.ai` only, so the root mail records are never touched. The webhook is
`/api/webhooks/email`.

DNS is AWS Route 53. Stacks and record changes are applied by hand from the owner's machine; the
cloud cannot run them. Old `forward-email=` TXT records from the first mail plan are inert.

**Why:** ForwardEmail was the first plan; Google Workspace replaced it because the aliases and
groups cost nothing extra and replies reach the team reliably.
**How to apply:** do not add a receiving MX for Resend at the apex. Check the `jorge@` group in
Google Admin before blaming DNS. `docs/email-onboarding.md` has the Resend status and env vars.
