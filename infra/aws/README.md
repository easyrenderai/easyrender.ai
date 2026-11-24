# infra/aws

CloudFormation for everything easyrender.ai keeps in AWS. Nothing here is applied by a Vercel
deploy or by a merge: a change to a template reaches AWS only when someone deploys the stack.

| Template              | Stack                        | Region    | What it holds                                                                               |
| --------------------- | ---------------------------- | --------- | ------------------------------------------------------------------------------------------- |
| `storage.yml`         | `easyrenderai-storage`       | eu-west-1 | Assets bucket, exports bucket, the CloudFront distribution, the Vercel OIDC role            |
| `cdn-certificate.yml` | `easyrender-cdn-certificate` | us-east-1 | The certificate for `cdn.easyrender.ai` (CloudFront reads certificates from us-east-1 only) |
| `exports.yml`         | `easyrender-exports`         | eu-west-1 | The Blender converter as an on-demand Lambda function, its image registry, its roles        |
| `outage-alarm.yml`    | `easyrender-outage-alarm`    | us-east-1 | Route 53 health check on the production site, CloudWatch alarm, SNS email topic             |

## What is public and what is private

- `renders/*` in the assets bucket is public through CloudFront: anyone with the URL can read it.
- `exports/*` is private. It is a second bucket behind the same distribution, and CloudFront
  answers 403 unless the URL carries a signature made with the exports key. Objects are deleted
  one day after they are written. Never put a private file anywhere else on the distribution.

## Deploy

Review the change set before executing it. `Distribution`, `AssetsBucket` and `VercelRole` must
show `Modify`, never `Replace` or `Remove`.

```bash
# 1. Certificate (once). Waits until DNS validation finishes, a few minutes.
aws cloudformation deploy --region us-east-1 --stack-name easyrender-cdn-certificate \
  --template-file infra/aws/cdn-certificate.yml \
  --parameter-overrides HostedZoneId=<easyrender.ai zone id>

# 2. Exports signing key (once, and again to rotate). The private key goes straight into Secrets
#    Manager and is never printed, committed or pasted.
key="$(mktemp -d)"
openssl genrsa -out "$key/private.pem" 2048
openssl rsa -in "$key/private.pem" -pubout -out "$key/public.pem"
aws secretsmanager create-secret --region eu-west-1 \
  --name easyrender/exports/signing-private-key --secret-string "file://$key/private.pem"
jq -n --rawfile pem "$key/public.pem" --arg cert "<CertificateArn output of step 1>" \
  --arg zone "<easyrender.ai zone id>" '{Parameters: {ExportsPublicKey: $pem,
  CdnDomain: "cdn.easyrender.ai", CertificateArn: $cert, HostedZoneId: $zone}}' > "$key/params.json"

# 3. Storage. Parameters that are not listed keep the value the stack already has.
aws cloudformation deploy --region eu-west-1 --stack-name easyrenderai-storage \
  --template-file infra/aws/storage.yml --capabilities CAPABILITY_IAM \
  --parameter-overrides "file://$key/params.json" --no-execute-changeset
# read the change set it prints, then execute it, then:
rm -rf "$key"
```

To rotate the key: `put-secret-value` with a new private key, then deploy with the new
`ExportsPublicKey` and `ExportsKeyVersion` raised by one.

## Model exports (the converter)

`exports.yml` runs `services/model-export` as a Lambda function from a container image. Nothing
runs between exports and there is no public endpoint: the web app starts one run through its
Vercel role. The stack goes up in two steps, because the registry has to exist before an image
can be pushed and the function cannot exist before an image does.

```bash
# 1. Registry and roles (once). No function yet.
aws cloudformation deploy --region eu-west-1 --stack-name easyrender-exports \
  --template-file infra/aws/exports.yml --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides ExportsBucket=<ExportsBucket output of easyrenderai-storage> \
  VercelRoleName=<role name at the end of the AwsRoleArn output>

# 2. Let CI ship. Set the repository variable to the stack's DeployRoleArn output, then run the
#    "Model export" workflow on main. It pushes the image tagged with the commit SHA.
gh variable set MODEL_EXPORT_DEPLOY_ROLE_ARN --body <DeployRoleArn output>
gh workflow run model-export.yml --ref main

# 3. The function. ImageTag is the commit SHA that run pushed.
aws cloudformation deploy --region eu-west-1 --stack-name easyrender-exports \
  --template-file infra/aws/exports.yml --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides ImageTag=<commit sha>
```

From then on every Release (`RELEASING.md`) that includes a change under `services/model-export`
builds, tests and pushes a new image and points the function at it. A merge to `main` ships
nothing; pull requests still build and test the image. The stack's `ImageTag` keeps the tag it was created
with; pass the current one when you deploy a template change.

The converter's own role can only read and write `exports/*` in the exports bucket. The Vercel
role gains two rights here: write the model to convert under `exports/*`, and start the function.

## Outage alarm

`outage-alarm.yml` emails when production is down. A Route 53 health check requests
`https://easyrender.ai/` every 30 seconds from eight AWS regions. `/` answers from the app itself
on every request (it is not cached), so the check fails when the app is down and not only when the
CDN is. The alarm goes red after two minutes of failures and mails again on recovery. Route 53
publishes health check metrics in us-east-1 only, so the stack, the alarm and the SNS topic live
there. It runs beside the daily `prod-smoke.yml`, which keeps the deeper checks: this one only says
that the site answers, within a few minutes.

The address is a parameter and is never committed. AWS mails it a confirmation link; **until the
link is clicked the alarm mails nobody**.

```bash
aws cloudformation deploy --region us-east-1 --stack-name easyrender-outage-alarm \
  --template-file infra/aws/outage-alarm.yml \
  --parameter-overrides AlarmEmail=<address> --no-execute-changeset
# read the change set (four resources: topic, subscription, health check, alarm), then:
# (a stack left in ROLLBACK_COMPLETE by a failed first attempt has to be deleted before a retry)
aws cloudformation deploy --region us-east-1 --stack-name easyrender-outage-alarm \
  --template-file infra/aws/outage-alarm.yml --parameter-overrides AlarmEmail=<address>
```

Prove it after a change to the template. A second stack watches a path that answers 404, so its
check fails on purpose. It needs no subscription, because the alarm state can be read directly:

```bash
aws cloudformation deploy --region us-east-1 --stack-name easyrender-outage-alarm-test \
  --template-file infra/aws/outage-alarm.yml --parameter-overrides ResourcePath=/alarm-test-404
# within about four minutes the alarm reads ALARM
aws cloudwatch describe-alarms --region us-east-1 --alarm-names easyrender-outage-alarm-test-down \
  --query 'MetricAlarms[0].[StateValue,StateReason]'
aws cloudformation delete-stack --region us-east-1 --stack-name easyrender-outage-alarm-test
```

To see the mail itself, set the real alarm for a moment (it returns to OK on its own when the next
evaluation passes): `aws cloudwatch set-alarm-state --region us-east-1 --alarm-name
easyrender-outage-alarm-down --state-value ALARM --state-reason "test"`. A new alarm reads
`INSUFFICIENT_DATA` for its first minutes, then `OK`, which sends the recovery mail once: that is the
sign it works. The test stack must read `ALARM` with the reason "Threshold Crossed: 2 datapoints
[0.0, 0.0]"; "no datapoints" means it has not measured anything yet.

## Outputs the app uses

| Output                                            | Vercel variable                                                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `S3Bucket`, `AwsRoleArn`                          | `S3_BUCKET`, `AWS_ROLE_ARN`                                                                                      |
| `AssetsCdnUrl`                                    | `ASSETS_CDN_URL`. Leave the `*.cloudfront.net` value in place: stored asset URLs and upload clean-up match on it |
| `ExportsBucket`, `ExportsUrl`, `ExportsKeyPairId` | `EXPORTS_BUCKET`, `EXPORTS_CDN_URL`, `EXPORTS_KEY_PAIR_ID`. None is a secret                                     |
| `FunctionName` (`easyrender-exports`)             | `MODEL_EXPORT_FUNCTION`. Not a secret. With these four set, the export buttons appear                            |
