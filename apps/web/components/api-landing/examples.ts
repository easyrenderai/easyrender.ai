import { SITE_URL } from '@/lib/seo/site';

// These are separate commands: the paid build is never chained to a preview request.
export const API_SETUP = `export EASYRENDER_URL="${SITE_URL}"
export EASYRENDER_API_KEY="er_your_key"`;

export const API_EXAMPLES = [
  {
    key: 'upload',
    code: `curl --fail-with-body "$EASYRENDER_URL/api/renders" \\
  --header "Authorization: Bearer $EASYRENDER_API_KEY" \\
  --form "image=@product.jpg"`,
  },
  {
    key: 'visibility',
    code: `export EASYRENDER_RENDER_ID="REPLACE_WITH_RESPONSE_ID"`,
  },
  {
    key: 'preview',
    code: `curl --fail-with-body \\
  "$EASYRENDER_URL/api/renders/$EASYRENDER_RENDER_ID" \\
  --header "Authorization: Bearer $EASYRENDER_API_KEY"

curl --fail-with-body \\
  "$EASYRENDER_URL/api/renders/$EASYRENDER_RENDER_ID/preview" \\
  --header "Authorization: Bearer $EASYRENDER_API_KEY" \\
  --output preview.webp`,
  },
  {
    key: 'build',
    // Set this ceiling only after inspecting the preview and authorizing the live credit quote.
    code: `export EASYRENDER_MAX_CREDITS="REPLACE_WITH_APPROVED_CREDIT_CEILING"

curl --fail-with-body --request POST \\
  "$EASYRENDER_URL/api/renders/$EASYRENDER_RENDER_ID/render" \\
  --header "Authorization: Bearer $EASYRENDER_API_KEY" \\
  --header "Content-Type: application/json" \\
  --data '{"maxCredits":'"$EASYRENDER_MAX_CREDITS"'}'`,
  },
  {
    key: 'download',
    code: `curl --fail-with-body \\
  "$EASYRENDER_URL/api/renders/$EASYRENDER_RENDER_ID" \\
  --header "Authorization: Bearer $EASYRENDER_API_KEY"

curl --fail-with-body \\
  "$EASYRENDER_URL/api/renders/$EASYRENDER_RENDER_ID/model?download=1" \\
  --header "Authorization: Bearer $EASYRENDER_API_KEY" \\
  --output product.glb`,
  },
] as const;
