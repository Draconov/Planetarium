<div align="center">

# Planetarium

### Tiny procedural worlds from a single name.

Type a planet name. Change its temperature. Watch its terrain, oceans, ice, life, clouds, moons and atmosphere react.

[![Version](https://img.shields.io/github/v/release/draconov/Planetarium?include_prereleases&sort=semver&label=version&style=for-the-badge)](https://github.com/draconov/Planetarium/releases/latest)
[![Build](https://img.shields.io/github/actions/workflow/status/draconov/Planetarium/build.yml?branch=main&label=build&logo=github&style=for-the-badge)](https://github.com/draconov/Planetarium/actions/workflows/build.yml)
[![Pages](https://img.shields.io/github/actions/workflow/status/draconov/Planetarium/pages.yml?branch=main&label=pages&logo=githubpages&logoColor=white&style=for-the-badge)](https://github.com/draconov/Planetarium/actions/workflows/pages.yml)

[![Play Online](https://img.shields.io/badge/PLAY%20ONLINE-GitHub%20Pages-2ea44f?logo=github&style=for-the-badge)](https://draconov.github.io/Planetarium/)
[![Latest Release](https://img.shields.io/badge/DOWNLOAD-Latest%20Release-6f42c1?logo=windows&logoColor=white&style=for-the-badge)](https://github.com/draconov/Planetarium/releases/latest)

[![Downloads](https://img.shields.io/github/downloads/draconov/Planetarium/total?label=downloads&style=flat-square)](https://github.com/draconov/Planetarium/releases)
[![Stars](https://img.shields.io/github/stars/draconov/Planetarium?style=flat-square&logo=github)](https://github.com/draconov/Planetarium/stargazers)
[![Forks](https://img.shields.io/github/forks/draconov/Planetarium?style=flat-square&logo=github)](https://github.com/draconov/Planetarium/forks)
[![Issues](https://img.shields.io/github/issues/draconov/Planetarium?style=flat-square)](https://github.com/draconov/Planetarium/issues)
![Last commit](https://img.shields.io/github/last-commit/draconov/Planetarium?style=flat-square)
![Repo size](https://img.shields.io/github/repo-size/draconov/Planetarium?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Web%20%7C%20Windows-informational?style=flat-square)
![Node](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white&style=flat-square)
![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white&style=flat-square)
![WebView2](https://img.shields.io/badge/Windows-WebView2-0078D4?logo=microsoftedge&logoColor=white&style=flat-square)
![Resolution](https://img.shields.io/badge/native%20resolution-480%C3%97270-blueviolet?style=flat-square)
![License](https://img.shields.io/badge/license-All%20rights%20reserved-lightgrey?style=flat-square)

**[Play Online](https://draconov.github.io/Planetarium/)** | **[Latest Release](https://github.com/draconov/Planetarium/releases/latest)** | **[Actions](https://github.com/draconov/Planetarium/actions)** | **[Pages](https://github.com/draconov/Planetarium/deployments)**

<img src="preview.png" alt="Planetarium preview" width="820">

</div>

---

## About

**Planetarium** is a compact **480x270 procedural planet generator**. A planet name acts as a deterministic seed, so the same name always produces the same world.

This repository is a source reconstruction of the original Planetarium project after its original development source was lost. The original release supplied the visual/audio assets and behavioral reference; the current application logic was rebuilt as a fresh implementation.

> **Current version:** `1.1.0`

## Quick links

| Destination | Link |
| --- | --- |
| **Play in browser** | **https://draconov.github.io/Planetarium/** |
| **Latest release** | **https://github.com/draconov/Planetarium/releases/latest** |
| **Windows builds** | Available from **Releases** and CI artifacts |
| **Build status** | **https://github.com/draconov/Planetarium/actions/workflows/build.yml** |
| **Pages status** | **https://github.com/draconov/Planetarium/actions/workflows/pages.yml** |
| **All Actions** | **https://github.com/draconov/Planetarium/actions** |

## Features

- **Deterministic procedural planets** generated from names
- **Temperature simulation** that changes the world
- Oceans, beaches and coastlines
- Mountains and terrain variation
- Ice and frozen regions
- Temperature-dependent life
- Procedural cloud layers
- Star fields
- Deterministic named moons with orbit distance and orbital period
- Moon motion derived from its generated orbital period and the time controls
- Hover planet details: class, temperature, radius, gravity, water, atmosphere, life, day and year
- Hover moon details: name, orbit distance, orbital period and moon radius
- Contextual probe targeting: click a planet or moon to pin it as the probe target
- Launch Probe button and **P** shortcut
- Visible probe flight and scanning sequence with ETA affected by the time-speed control
- Persistent deep-scan unlocks stored locally per planet and moon
- Planet deep scans: age, atmospheric pressure and gases, magnetic field, tectonics, volcanism, ocean depth, ice cover, life type, technology level and resource abundance
- Moon deep scans: temperature, gravity, surface type, atmosphere, water ice, activity and anomalies
- Deterministic anomalies and discoveries, including rare first-mission probe loss events
- Word-based life population levels from **TRACE** through **MASSIVE**
- Touch/tap object inspection on devices without hover
- Favorites and recent-planet library stored locally
- Shareable planet URLs containing planet name and temperature
- Moons and occasional planetary rings
- Normal and temperature visualization modes
- Reversible time
- Accelerated time
- Rocket launch effect
- PNG screenshots
- Music mute toggle
- Random planet generation
- Per-planet temperature persistence
- Mouse controls
- Keyboard controls
- Special named planets and Easter eggs
- Original pixel sprites and bitmap-font presentation

## Controls

| Input | Action |
| --- | --- |
| Type a name + **Enter** | Visit / generate the planet |
| **0** or **?** | Generate a random planet |
| **Left / Right** | Change temperature |
| **Up / Down** | Change temperature while not typing |
| **Tab** | Toggle temperature view |
| **1** | Reverse time |
| **2** | Cycle time speed |
| **3** | Launch rocket |
| **4** | Save screenshot |
| **5** | Mute / unmute |
| **F** | Add/remove the current planet from Favorites |
| **L** | Open/close the Favorites and Recent library |
| **C** | Copy a shareable link for the current planet |
| **P** | Launch a probe at the hovered/pinned body, or the planet by default |
| Click planet/moon | Pin/unpin it as the probe target |
| Hover planet | Show generated planet information |
| Hover moon | Show moon name, orbit and orbital period |
| Tap planet/moon | Pin/unpin its information on touch devices |
| **Alt + Enter** | Toggle fullscreen |
| **Double-click** | Toggle fullscreen |

The bottom control bar is also fully usable with the mouse.

## Version 1.1.0

Version 1.1.0 keeps the original minimalist single-planet view and adds depth without turning the application into a permanent dashboard.

### Contextual object information

Planet information appears only while the pointer is over the planet. The generated values include world class, temperature, Earth-relative radius, gravity, surface water, atmosphere, biosphere level, word-based population amount, day length and year length. The compact always-visible label remains limited to the planet name and radius. Deep-scan data stays hidden until a probe mission succeeds.

Every generated moon now has a deterministic name, physical orbit distance, moon radius and orbital period. Hovering a moon reveals those values beside that moon. Moon movement is derived from its orbital period, and reverse/fast-forward controls affect the orbital simulation. On touch devices, tapping a planet or moon pins the same contextual information until another object or empty space is tapped.

### Launch Probe and deep scans

The bottom control bar includes a **Launch Probe** control. Press **P** or click the probe button to launch toward the currently hovered or pinned celestial body; if no moon is selected, the planet is targeted.

Probe missions are intentionally lightweight rather than a separate upgrade/game system. A tiny probe visibly flies toward the target, reports an ETA, enters a scanning phase and then unlocks persistent deep-scan information. The existing time-speed control accelerates probe missions, while reverse time does not rewind a launched probe.

Planet deep scans reveal generated scientific details such as age, atmospheric pressure and major gases, magnetic field, tectonics, volcanism, ocean depth, ice coverage, life type, population, technology level, resource abundance and a possible anomaly. Moon scans reveal temperature, gravity, composition, atmosphere, water ice, geological activity and a possible anomaly.

A small number of targets can deterministically lose the first probe with **PROBE LOST - CAUSE UNKNOWN**. The loss is remembered locally, so a second mission can still complete the scan. Completed scans are also remembered locally and are regenerated deterministically whenever that named planet is revisited.

The normal interface remains intentionally minimal: basic information appears on hover, while the additional scientific data only appears after the relevant body has been scanned.

### Favorites and recent planets

Press **F** to add or remove the current planet from Favorites. Press **L** to open the compact library overlay and browse Favorites or Recent planets. These lists are stored locally in the browser/WebView and require no account or server.

### Shareable planets

Press **C** to copy a URL containing the current planet name and temperature, for example:

```text
https://draconov.github.io/Planetarium/?planet=AXIOM&temp=18
```

Opening that URL recreates the same named world at the shared temperature.

### Smaller Windows build

The desktop shell was migrated from Electron to Tauri/WebView2. The application no longer bundles Chromium with every release. The release workflow publishes the size-optimized raw Windows x64 executable as the single custom release asset.

## Play on GitHub Pages

The web build is deployed automatically from `main` / `master` by GitHub Actions.

### **[Launch Planetarium](https://draconov.github.io/Planetarium/)**

For a newly created repository, enable Pages once under:

**Settings -> Pages -> Build and deployment -> Source -> GitHub Actions**

The Pages workflow is located at:

```text
.github/workflows/pages.yml
```

The site uses relative asset paths and ships `.nojekyll`, so repository-subpath hosting works correctly.

## Downloads

### Windows

The portable Windows executable is published through GitHub Releases:

### **[Download latest Planetarium release](https://github.com/draconov/Planetarium/releases/latest)**

Each release exposes one custom download: the compact Windows x64 executable generated by Tauri and rendered through the system WebView2 runtime. GitHub also adds its standard `Source code (zip)` and `Source code (tar.gz)` links automatically.

CI builds from ordinary pushes are also available under **Actions -> Build -> Artifacts**.

### Web

The browser edition is available directly through GitHub Pages. The static build is also produced by CI as the `Planetarium-web` artifact.

## Development

### Requirements

- **Node.js 20+**
- npm
- **Rust toolchain** for desktop development/builds
- **Visual Studio C++ Build Tools** on Windows for desktop development/builds
- Microsoft Edge WebView2 (already present on modern Windows 10/11 systems)

The browser application itself has no runtime npm dependencies. Tauri is only a desktop build dependency.

### Run locally

```bash
npm run dev:web
```

Then open:

```text
http://127.0.0.1:8080
```

On Windows you can simply run:

```text
run-dev.bat
```

For the native Tauri desktop window:

```bash
npm install
npm run dev:desktop
```

or run:

```text
run-desktop.bat
```

### Validate the source

```bash
npm run check
```

This checks JavaScript syntax and verifies that all required bundled resources exist.

## Build

### Web

```bash
npm run build:web
```

Windows shortcut:

```text
build-web.bat
```

Output:

```text
dist/web/
```

The output is a completely static site suitable for GitHub Pages, itch.io, Netlify, Cloudflare Pages, or a normal web server.

### Windows

Install development dependencies:

```bash
npm install
```

Then:

```bash
npm run build:win
```

or on Windows:

```text
build-windows.bat
```

Output:

```text
release/
`-- Planetarium-1.1.0-Windows-x64.exe
```

The `.exe` is a standalone application binary; no installer is required. It uses the WebView2 runtime already provided by modern Windows instead of bundling Chromium, which keeps the download dramatically smaller than the previous Electron package.

## Releases and versioning

The application version lives in `package.json`:

```json
"version": "1.1.0"
```

The release tag is derived **only** from that version. For example, version `1.1.0` always uses the tag `v1.1.0`.

### Automatic published releases

Every successful push to `main` or `master` automatically builds the Web and Windows editions. The GitHub Release publishes only the Windows portable executable; the Web edition is deployed through GitHub Pages.

If `package.json` still contains the same version, the workflow **updates the existing release instead of creating another one**:

```text
package.json = 1.1.0
push #1 -> v1.1.0 is created and published
push #2 -> v1.1.0 is updated
push #3 -> v1.1.0 is updated again
```

For an existing version, the workflow moves the same `vX.Y.Z` tag to the latest successful commit, removes any older custom assets, uploads the freshly built portable `.exe`, refreshes the release notes and keeps that release published as the latest release.

When you want a new release entry, change the version in `package.json` before pushing:

```text
1.0.0 -> v1.0.0
1.0.1 -> v1.0.1
1.1.0 -> v1.1.0
```

Recommended versioning:

- `1.0.1` - bug fix
- `1.1.0` - new backwards-compatible features
- `2.0.0` - major redesign or incompatible changes

### Rebuild a release manually from GitHub

You can also refresh the current version without making another commit:

1. Open **Actions** in the repository.
2. Open the **Build** workflow.
3. Select **Run workflow**.
4. Choose the branch to build, normally `main`.
5. Select **Run workflow**.

The manual run uses the version currently stored in `package.json` and creates or updates that same published `vX.Y.Z` release.

## GitHub Actions

### Build

`.github/workflows/build.yml`

Runs on:

- pushes to `main` / `master`
- pull requests
- manual workflow runs

Pull requests only validate/build the application. They do **not** publish releases.

A successful push to `main` / `master`, or a manual workflow run, produces:

| Artifact | Contents |
| --- | --- |
| `Planetarium-web` | Static browser build used for CI verification |
| `Planetarium-Windows` | Portable Windows `.exe` |

After both build jobs succeed, the workflow automatically creates or updates the published GitHub Release matching the version in `package.json`, with exactly one custom asset: `Planetarium-<version>-Windows-x64.exe`.

### GitHub Pages

`.github/workflows/pages.yml`

Every push to `main` / `master` rebuilds and deploys the browser edition to:

**https://draconov.github.io/Planetarium/**

## Repository structure

```text
Planetarium/
|-- .github/
|   `-- workflows/
|       |-- build.yml          # CI, desktop/web builds and releases
|       `-- pages.yml          # GitHub Pages deployment
|-- src-tauri/
|   |-- icons/                 # Windows application icon
|   |-- src/                   # Minimal Rust/Tauri desktop shell
|   |-- capabilities/          # Tauri permissions
|   |-- Cargo.toml             # Rust dependencies and size-optimized release profile
|   `-- tauri.conf.json        # WebView2 desktop configuration
|-- scripts/
|   |-- build-web.mjs          # Static web builder
|   |-- check-assets.mjs       # Resource validation
|   |-- check-version.mjs      # package/Tauri/Cargo version parity
|   |-- collect-tauri-exe.mjs  # Copies the optimized Windows binary to release/
|   `-- serve.mjs              # Dependency-free local server
|-- src/
|   |-- assets/                # Original bundled art/audio resources
|   |-- app.js                 # Main Planetarium implementation
|   |-- font_data.js           # Bitmap-font data
|   `-- index.html             # Browser entry point
|-- build-web.bat
|-- build-windows.bat
|-- run-dev.bat
|-- run-desktop.bat
|-- package.json              # Version, scripts and Tauri CLI dependency
|-- preview.png
`-- README.md
```

## Architecture

Planetarium intentionally stays small:

```text
Planet name
    |
    v
Deterministic seed
    |
    |-- terrain
    |-- climate / temperature
    |-- water / ice
    |-- life
    |-- clouds
    |-- moons / rings
    `-- visual details
            |
            v
       480 x 270 renderer
```

The same browser code powers both editions. The desktop edition uses a minimal Tauri shell and the Windows WebView2 runtime instead of shipping its own Chromium engine.

## Reconstruction

This repository is a **source restoration/reconstruction**, not a byte-for-byte recovery of the lost GameMaker project files.

The original release executable was used as the behavioral and visual reference. Original bundled visual/audio resources were recovered from that release, while the current application logic was rewritten to reproduce the original program's behavior in a maintainable modern codebase.

## License

No public software license is currently granted. Unless a license is added later, **all rights are reserved**.

---

<div align="center">

### Generate something weird.

**[Play Planetarium](https://draconov.github.io/Planetarium/)** | **[Download](https://github.com/draconov/Planetarium/releases/latest)**

`Planetarium v1.1.0`

</div>
