#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  printf 'Usage: %s <query> [all|root|about|community|engine_details|getting_started|tutorials|classes|readme]\n' "$(basename "$0")" >&2
  exit 1
fi

query="$1"
section="${2:-all}"
workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="${workspace_root}/vendor/godot-docs"

if [[ ! -d "${repo_root}" ]]; then
  printf 'Repo nicht gefunden: %s. Zuerst scripts/update-godot-docs.ps1 oder scripts/update-godot-docs.sh ausführen.\n' "${repo_root}" >&2
  exit 1
fi

case "${section}" in
  root)
    targets=("${repo_root}/index.rst")
    ;;
  about)
    targets=("${repo_root}/about")
    ;;
  community)
    targets=("${repo_root}/community")
    ;;
  engine_details)
    targets=("${repo_root}/engine_details")
    ;;
  getting_started)
    targets=("${repo_root}/getting_started")
    ;;
  tutorials)
    targets=("${repo_root}/tutorials")
    ;;
  classes)
    targets=("${repo_root}/classes")
    ;;
  readme)
    targets=("${repo_root}/README.md")
    ;;
  all)
    targets=(
      "${repo_root}/index.rst"
      "${repo_root}/README.md"
      "${repo_root}/about"
      "${repo_root}/community"
      "${repo_root}/engine_details"
      "${repo_root}/getting_started"
      "${repo_root}/tutorials"
      "${repo_root}/classes"
    )
    ;;
  *)
    printf 'Ungültige section: %s\n' "${section}" >&2
    exit 1
    ;;
esac

if command -v rg >/dev/null 2>&1; then
  rg --line-number --ignore-case --fixed-strings "${query}" "${targets[@]}"
else
  grep -RinF -- "${query}" "${targets[@]}"
fi
