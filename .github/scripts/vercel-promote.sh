#!/usr/bin/env bash
# Points the production domains at an already built deployment, through the Vercel REST API.
#
# `vercel promote` calls /v2/user first, which a team scoped token cannot do ("User not found",
# 404). The REST API needs no user, only the team id. No rebuild happens.
#
# Usage: vercel-promote.sh <deployment url>
# Env:   VERCEL_TOKEN, VERCEL_ORG_ID (team id), VERCEL_PROJECT_ID
set -euo pipefail

url="${1:?usage: vercel-promote.sh <deployment url>}"
host="${url#https://}"
host="${host%/}"
api="https://api.vercel.com"
response="$(mktemp)"

request() {
  local status
  status="$(curl -sS -o "${response}" -w '%{http_code}' --max-time 30 \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" "$@")"
  if [[ ! "${status}" =~ ^2[0-9][0-9]$ ]]; then
    echo "::error::Vercel API returned HTTP ${status} for ${*: -1}"
    jq -c '{code: .error.code, message: .error.message}' "${response}" 2>/dev/null || true
    exit 1
  fi
}

request "${api}/v13/deployments/${host}?teamId=${VERCEL_ORG_ID}"
deployment_id="$(jq -r '.id // empty' "${response}")"
if [ -z "${deployment_id}" ]; then
  echo "::error::Vercel has no deployment for ${host}."
  exit 1
fi

request -X POST "${api}/v10/projects/${VERCEL_PROJECT_ID}/promote/${deployment_id}?teamId=${VERCEL_ORG_ID}"
echo "Promote requested for ${deployment_id}"

# The promote is asynchronous: wait until the project reports the deployment as its production one.
for attempt in $(seq 1 30); do
  request "${api}/v9/projects/${VERCEL_PROJECT_ID}?teamId=${VERCEL_ORG_ID}"
  current="$(jq -r '.targets.production.id // empty' "${response}")"
  echo "Production is ${current:-unknown} (${attempt}/30)"
  [ "${current}" = "${deployment_id}" ] && exit 0
  sleep 10
done
echo "::error::Production did not move to ${deployment_id} within 5 minutes."
exit 1
