# infra/aws

CloudFormation for everything easyrender.ai keeps in AWS. Nothing here is applied by a Vercel
deploy or by a merge: a change to a template reaches AWS only when someone deploys the stack.

| Template              | Stack                        | Region    | What it holds                                                                               |
| --------------------- | ---------------------------- | --------- | ------------------------------------------------------------------------------------------- |
| `storage.yml`         | `easyrenderai-storage`       | eu-west-1 | Assets bucket, exports bucket, the CloudFront distribution, the Vercel OIDC role            |
| `cdn-certificate.yml` | `easyrender-cdn-certificate` | us-east-1 | The certificate for `cdn.easyrender.ai` (CloudFront reads certificates from us-east-1 only) |

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

## Outputs the app uses

| Output                                            | Vercel variable                                                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `S3Bucket`, `AwsRoleArn`                          | `S3_BUCKET`, `AWS_ROLE_ARN`                                                                                      |
| `AssetsCdnUrl`                                    | `ASSETS_CDN_URL`. Leave the `*.cloudfront.net` value in place: stored asset URLs and upload clean-up match on it |
| `ExportsBucket`, `ExportsUrl`, `ExportsKeyPairId` | Read by the export routes when they ship. None is a secret                                                       |
