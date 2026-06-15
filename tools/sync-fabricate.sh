#!/usr/bin/env bash
#
# sync-fabricate.sh — install the newest Fabricate build into your local Foundry.
#
# WHY THIS EXISTS
#   Automate FVTT hard-depends on Fabricate, which ships almost daily as GitHub
#   *prereleases* (the 1.0.0-rc.N line). Foundry's in-app updater and the
#   `releases/latest/...` manifest URL both EXCLUDE prereleases, so they get
#   stuck on the last non-prerelease build. This script grabs the most recent
#   release of any kind (prerelease included) and swaps it into the module dir,
#   backing up the previous install outside the scanned `modules/` folder.
#
# REQUIREMENTS
#   - gh   (GitHub CLI, authenticated)  — fetches the release + asset
#   - unzip
#
# USAGE
#   tools/sync-fabricate.sh                # auto-detect data path, latest RC
#   tools/sync-fabricate.sh --tag v1.0.0-rc.80   # pin a specific tag
#   FOUNDRY_DATA=/path/to/foundrydata tools/sync-fabricate.sh
#
# After it runs: reload your world (or restart Foundry) to load the new build.

set -euo pipefail

REPO="mistersilver-uk/fabricate"
MODULE_ID="fabricate"
TAG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag) TAG="${2:?--tag needs a value}"; shift 2 ;;
    --repo) REPO="${2:?--repo needs a value}"; shift 2 ;;
    -h|--help) sed -n '2,28p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

command -v gh    >/dev/null || { echo "error: gh (GitHub CLI) not found" >&2; exit 1; }
command -v unzip >/dev/null || { echo "error: unzip not found" >&2; exit 1; }

# --- locate the Foundry data path -------------------------------------------
# Priority: $FOUNDRY_DATA env → --dataPath of a running Foundry process → guesses.
detect_data_path() {
  if [[ -n "${FOUNDRY_DATA:-}" ]]; then echo "$FOUNDRY_DATA"; return; fi
  local from_proc
  from_proc=$(ps -eo args 2>/dev/null | grep -oP -- '--dataPath=\K\S+' | head -1 || true)
  if [[ -n "$from_proc" ]]; then echo "$from_proc"; return; fi
  for guess in "$HOME/foundrydata" "$HOME/.local/share/FoundryVTT" "$HOME/FoundryVTT/Data/.."; do
    [[ -d "$guess/Data/modules" ]] && { echo "$guess"; return; }
  done
  return 1
}

DATA_PATH=$(detect_data_path) || {
  echo "error: could not find Foundry data path. Set FOUNDRY_DATA=/path/to/foundrydata" >&2
  exit 1
}
MODS="$DATA_PATH/Data/modules"
DEST="$MODS/$MODULE_ID"
BACKUPS="$DATA_PATH/_module-backups"   # outside modules/ so Foundry never scans it

[[ -d "$MODS" ]] || { echo "error: no modules dir at $MODS" >&2; exit 1; }
echo "Foundry data:  $DATA_PATH"

# --- resolve the tag to install ---------------------------------------------
if [[ -z "$TAG" ]]; then
  # `.[0]` is the most recently published release, prerelease or not.
  TAG=$(gh api "repos/$REPO/releases" --jq '.[0].tag_name')
fi
[[ -n "$TAG" ]] || { echo "error: could not resolve a release tag from $REPO" >&2; exit 1; }

OLD_VER="(none)"
if [[ -f "$DEST/module.json" ]]; then
  OLD_VER=$(grep -oP '"version":\s*"\K[^"]+' "$DEST/module.json" || echo "unknown")
fi
echo "Installed:     $OLD_VER"
echo "Target tag:    $TAG"

# --- download + stage --------------------------------------------------------
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
echo "Downloading $TAG …"
gh release download "$TAG" -R "$REPO" -p '*.zip' -D "$TMP"
ZIP=$(find "$TMP" -name '*.zip' | head -1)
[[ -n "$ZIP" ]] || { echo "error: release $TAG has no .zip asset" >&2; exit 1; }

mkdir -p "$TMP/extract"
unzip -oq "$ZIP" -d "$TMP/extract"
[[ -f "$TMP/extract/module.json" ]] || { echo "error: zip has no module.json at its root" >&2; exit 1; }
NEW_VER=$(grep -oP '"version":\s*"\K[^"]+' "$TMP/extract/module.json" || echo "unknown")

# --- back up current install (outside modules/) and swap --------------------
if [[ -d "$DEST" ]]; then
  mkdir -p "$BACKUPS"
  BK="$BACKUPS/$MODULE_ID-$OLD_VER"
  rm -rf "$BK"
  cp -a "$DEST" "$BK"
  echo "Backed up $OLD_VER -> $BK"
  rm -rf "${DEST:?}/"*
else
  mkdir -p "$DEST"
fi
cp -a "$TMP/extract/." "$DEST/"

echo "Done: $MODULE_ID  $OLD_VER -> $NEW_VER"
echo "Reload your world (or restart Foundry) to load it."
