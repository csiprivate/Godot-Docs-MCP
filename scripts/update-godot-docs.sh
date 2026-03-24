#!/usr/bin/env bash
set -euo pipefail

workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
vendor_root="${workspace_root}/vendor"
repo_root="${vendor_root}/godot-docs"
repo_url="https://github.com/godotengine/godot-docs.git"
branch="stable"

mkdir -p "${vendor_root}"

if [[ ! -d "${repo_root}/.git" ]]; then
  git clone --depth 1 --branch "${branch}" "${repo_url}" "${repo_root}"
else
  git -C "${repo_root}" fetch --depth 1 origin "${branch}"
  git -C "${repo_root}" reset --hard "origin/${branch}"
fi

commit="$(git -C "${repo_root}" rev-parse HEAD)"
date="$(git -C "${repo_root}" log -1 --format=%cI)"

printf 'Godot-Doku aktualisiert.\n'
printf 'Pfad: %s\n' "${repo_root}"
printf 'Branch: %s\n' "${branch}"
printf 'Commit: %s\n' "${commit}"
printf 'Datum: %s\n' "${date}"
