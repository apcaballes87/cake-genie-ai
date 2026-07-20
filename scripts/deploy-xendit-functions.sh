#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/deploy-xendit-functions.sh genie --check
  scripts/deploy-xendit-functions.sh genie --deploy
  scripts/deploy-xendit-functions.sh order-form --check
  scripts/deploy-xendit-functions.sh order-form --deploy

The guard refuses to deploy unless the selected repository is linked to its
expected Supabase project and its payment functions contain app-specific source
markers. Deployments always pass the expected project ref explicitly.
EOF
}

if [[ $# -ne 2 ]]; then
  usage
  exit 2
fi

app="$1"
action="$2"

if [[ "$action" != "--check" && "$action" != "--deploy" ]]; then
  usage
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
genie_repo="$(cd "$script_dir/.." && pwd)"
workspace_parent="$(dirname "$genie_repo")"

case "$app" in
  genie)
    repo_dir="$genie_repo"
    expected_ref="cqmhanqnfybyxezhobkx"
    create_required_marker="cakegenie_orders"
    create_forbidden_marker="pending_facebook_orders"
    verify_required_marker="order_contributions"
    verify_forbidden_marker="New Facebook Orders"
    jwt_flag="--no-verify-jwt"
    ;;
  order-form)
    repo_dir="$workspace_parent/cakes-and-memories-cebu-order-form"
    expected_ref="congofivupobtfudnhni"
    create_required_marker="pending_facebook_orders"
    create_forbidden_marker="cakegenie_orders"
    verify_required_marker="New Facebook Orders"
    verify_forbidden_marker="order_contributions"
    jwt_flag=""
    ;;
  *)
    usage
    exit 2
    ;;
esac

if [[ ! -d "$repo_dir/.git" ]]; then
  echo "Refusing deployment: repository not found at $repo_dir" >&2
  exit 1
fi

project_ref_file="$repo_dir/supabase/.temp/project-ref"
linked_project_file="$repo_dir/supabase/.temp/linked-project.json"
linked_ref=""

if [[ -f "$project_ref_file" ]]; then
  linked_ref="$(tr -d '[:space:]' < "$project_ref_file")"
elif [[ -f "$linked_project_file" ]]; then
  linked_ref="$(sed -nE 's/.*"ref"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$linked_project_file")"
fi

if [[ -z "$linked_ref" ]]; then
  echo "Refusing deployment: no linked Supabase project ref found for $repo_dir" >&2
  exit 1
fi

if [[ "$linked_ref" != "$expected_ref" ]]; then
  echo "Refusing deployment: $app is linked to $linked_ref, expected $expected_ref" >&2
  exit 1
fi

create_source="$repo_dir/supabase/functions/create-xendit-payment/index.ts"
verify_source="$repo_dir/supabase/functions/verify-xendit-payment/index.ts"

for source_file in "$create_source" "$verify_source"; do
  if [[ ! -f "$source_file" ]]; then
    echo "Refusing deployment: missing $source_file" >&2
    exit 1
  fi
done

if ! rg -q --fixed-strings "$create_required_marker" "$create_source"; then
  echo "Refusing deployment: create function lacks $app marker '$create_required_marker'" >&2
  exit 1
fi

if rg -q --fixed-strings "$create_forbidden_marker" "$create_source"; then
  echo "Refusing deployment: create function contains foreign marker '$create_forbidden_marker'" >&2
  exit 1
fi

if ! rg -q --fixed-strings "$verify_required_marker" "$verify_source"; then
  echo "Refusing deployment: verify function lacks $app marker '$verify_required_marker'" >&2
  exit 1
fi

if rg -q --fixed-strings "$verify_forbidden_marker" "$verify_source"; then
  echo "Refusing deployment: verify function contains foreign marker '$verify_forbidden_marker'" >&2
  exit 1
fi

echo "Deployment guard passed: $app -> $expected_ref"

if [[ "$action" == "--check" ]]; then
  exit 0
fi

deploy_function() {
  local function_name="$1"
  local args=(
    functions deploy "$function_name"
    --project-ref "$expected_ref"
    --workdir "$repo_dir"
    --use-api
    --yes
  )

  if [[ -n "$jwt_flag" ]]; then
    args+=("$jwt_flag")
  fi

  supabase "${args[@]}"
}

deploy_function create-xendit-payment
deploy_function verify-xendit-payment

echo "Deployed $app Xendit functions to $expected_ref"
