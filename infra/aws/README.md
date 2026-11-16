# infra/aws

CloudFormation for everything easyrender.ai keeps in AWS. Nothing here is applied by a Vercel
deploy or by a merge: a change to a template reaches AWS only when someone deploys the stack.

| Template              | Stack                        | Region    | What it holds                                                                               |
| --------------------- | ---------------------------- | --------- | ------------------------------------------------------------------------------------------- |
| `storage.yml`         | `easyrenderai-storage`       | eu-west-1 | Assets bucket, exports bucket, the CloudFront distribution, the Vercel OIDC role            |
| `cdn-certificate.yml` | `easyrender-cdn-certificate` | us-east-1 | The certificate for `cdn.easyrender.ai` (CloudFront reads certificates from us-east-1 only) |
| `exports.yml`         | `easyrender-exports`         | eu-west-1 | The Blender converter as an on-demand Lambda function, its image registry, its roles        |

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

From then on a merge to `main` that touches `services/model-export` builds, tests and pushes a
new image and points the function at it. The stack's `ImageTag` keeps the tag it was created
with; pass the current one when you deploy a template change.

The converter's own role can only read and write `exports/*` in the exports bucket. The Vercel
role gains two rights here: write the model to convert under `exports/*`, and start the function.

## Outputs the app uses

| Output                                            | Vercel variable                                                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `S3Bucket`, `AwsRoleArn`                          | `S3_BUCKET`, `AWS_ROLE_ARN`                                                                                      |
| `AssetsCdnUrl`                                    | `ASSETS_CDN_URL`. Leave the `*.cloudfront.net` value in place: stored asset URLs and upload clean-up match on it |
| `ExportsBucket`, `ExportsUrl`, `ExportsKeyPairId` | Read by the export routes when they ship. None is a secret                                                       |
| `FunctionName` (`easyrender-exports`)             | `MODEL_EXPORT_FUNCTION`, read by the export routes when they ship. Not a secret                                  |
