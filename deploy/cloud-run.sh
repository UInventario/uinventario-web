#!/usr/bin/env sh
set -eu

usage() {
  echo "Usage: $0 <dev|prod> <container-image> <https-api-origin>" >&2
  exit 2
}

[ "$#" -eq 3 ] || usage

environment="$1"
image="$2"
api_upstream="${3%/}"
region="${CLOUD_RUN_REGION:-us-central1}"

case "$environment" in
  dev) project_id="software-inventario-dev" ;;
  prod) project_id="software-inventario-prod" ;;
  *) usage ;;
esac

case "$api_upstream" in
  https://*) ;;
  *) echo "API upstream must be an HTTPS origin." >&2; exit 2 ;;
esac

case "${api_upstream#https://}" in
  ''|*/*|*\?*|*\#*|*@*) echo "API upstream must not contain a path, credentials, query or fragment." >&2; exit 2 ;;
esac

case "$image" in
  *.pkg.dev/"$project_id"/*:*) ;;
  *) echo "Container image must be a tagged Artifact Registry image in $project_id." >&2; exit 2 ;;
esac

service_name="uinventario-web"
runtime_service_account="${WEB_RUNTIME_SERVICE_ACCOUNT:-uinventario-web-runtime@${project_id}.iam.gserviceaccount.com}"

if ! gcloud artifacts docker images describe "$image" --project="$project_id" >/dev/null 2>&1; then
  echo "Container image $image is unavailable in $project_id." >&2
  exit 4
fi

gcloud run deploy "$service_name" \
  --project="$project_id" \
  --region="$region" \
  --image="$image" \
  --service-account="$runtime_service_account" \
  --set-env-vars="DEPLOY_ENV=${environment},API_UPSTREAM=${api_upstream}" \
  --allow-unauthenticated \
  --port=8080 \
  --cpu=1 \
  --memory=256Mi \
  --cpu-throttling \
  --concurrency=80 \
  --min=0 \
  --max=3 \
  --timeout=60s \
  --labels="app=uinventario,environment=${environment},component=web" \
  --startup-probe=httpGet.path=/health/live,initialDelaySeconds=0,timeoutSeconds=3,periodSeconds=3,failureThreshold=10 \
  --liveness-probe=httpGet.path=/health/live,initialDelaySeconds=10,timeoutSeconds=3,periodSeconds=30,failureThreshold=3 \
  --quiet

service_url="$(gcloud run services describe "$service_name" --project="$project_id" --region="$region" --format='value(status.url)')"
curl --fail --silent --show-error "${service_url}/health/live" >/dev/null
curl --fail --silent --show-error "${service_url}/config.json" >/dev/null
printf '%s\n' "$service_url"
