---
name: outage-alarm
description: The production outage alarm is AWS (Route 53 health check, CloudWatch alarm, SNS email), not Sentry uptime
type: project
---

The alarm is one CloudFormation template, `infra/aws/outage-alarm.yml`: a Route 53 health check on
the homepage, a CloudWatch alarm and an SNS email topic. Route 53 health check metrics exist only
in `us-east-1`, so the alarm and topic live there. Stacks in `infra/aws` are deployed by hand, not
on merge. Delivery was proven with a throwaway stack on a path that returns 404.

**Why:** the daily GitHub smoke workflow is not an alarm: GitHub starts scheduled runs hours late or
not at all, and real customers use production. The AWS zone and stack already existed, so no new
vendor.
**How to apply:** do not propose Sentry uptime or another monitor for "is the site down".
`TreatMissingData` must be `ignore` (`breaching` alarms on the empty startup window). A stack that
fails its first create sits in `ROLLBACK_COMPLETE` and must be deleted before a retry. The SNS
subscription must be confirmed by pressing the button on the confirmation page, and the mail
expires after 48 hours. Keep the Route 53 checkers out of any bot challenge: see
[bot protection](bot-protection.md).
