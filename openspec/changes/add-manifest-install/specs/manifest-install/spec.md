# manifest-install

## ADDED Requirements

### Requirement: Installable via a stable manifest URL
The module SHALL be installable in Foundry by a stable manifest URL. A published
release SHALL include a `module.json` asset and a `module.zip` asset, and the
`releases/latest/download/module.json` and `releases/latest/download/module.zip`
URLs SHALL resolve to them.

#### Scenario: Install from the latest manifest URL
- **WHEN** a user pastes the `releases/latest/download/module.json` URL into Foundry's Install Module dialog
- **THEN** Foundry fetches the manifest and the linked `module.zip` and installs the module

### Requirement: Manifest points to its install assets
The released `module.json` SHALL set `manifest` and `download` to the stable
latest-download URLs for `module.json` and `module.zip` respectively, and SHALL
declare a `compatibility` range.

#### Scenario: Manifest fields resolve to assets
- **WHEN** the released `module.json` is read
- **THEN** its `manifest` and `download` URLs resolve to the release's assets

### Requirement: Version consistency across tag, manifest, and zip
The release process SHALL keep versions consistent: the git release tag, the
`version` in the committed `module.json`, and the `version` in the released (in-zip)
`module.json` MUST all match.

#### Scenario: A release ships consistent versions
- **WHEN** a release is published for a tag
- **THEN** the committed manifest version, the in-zip manifest version, and the tag agree

### Requirement: Release publishes a resolvable, parseable latest manifest
After a release, the `releases/latest/download/module.json` URL SHALL return a
successful response that parses as JSON and whose `version` equals the released tag.

#### Scenario: Post-release manifest check
- **WHEN** a release completes
- **THEN** the latest manifest URL returns success, parses, and reports the released version

### Requirement: Documented install path
The README SHALL document installing the module via its manifest URL.

#### Scenario: README shows the manifest install
- **WHEN** a user reads the README
- **THEN** they find the manifest URL and the steps to install it in Foundry
