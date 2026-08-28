<div align="center">

<img src="src/icon.png" alt="Planetarium icon" width="112" height="112">

# Planetarium

### Explore an infinite procedural galaxy from your ship.

Type a destination. Discover a world. Change its climate, inspect its moons, launch probes, follow strange signals, and keep the places worth remembering.

[![Version](https://img.shields.io/github/v/release/Draconov/Planetarium?include_prereleases&sort=semver&label=version&style=for-the-badge)](https://github.com/Draconov/Planetarium/releases/latest)
[![Build](https://img.shields.io/github/actions/workflow/status/Draconov/Planetarium/build.yml?branch=main&label=build&logo=github&style=for-the-badge)](https://github.com/Draconov/Planetarium/actions/workflows/build.yml)
[![Pages](https://img.shields.io/github/actions/workflow/status/Draconov/Planetarium/pages.yml?branch=main&label=web&logo=githubpages&logoColor=white&style=for-the-badge)](https://github.com/Draconov/Planetarium/actions/workflows/pages.yml)

[![Play Online](https://img.shields.io/badge/PLAY_ONLINE-GitHub_Pages-2ea44f?style=for-the-badge&logo=githubpages&logoColor=white)](https://draconov.github.io/Planetarium/)
[![Download](https://img.shields.io/badge/DOWNLOAD-Windows-0078D4?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/Draconov/Planetarium/releases/latest)

![Platform](https://img.shields.io/badge/platform-Web%20%7C%20Windows-informational?style=flat-square)
![Resolution](https://img.shields.io/badge/native%20resolution-480%C3%97270-blueviolet?style=flat-square)
![Tauri](https://img.shields.io/badge/desktop-Tauri%202-24C8DB?style=flat-square&logo=tauri&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-20%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![License](https://img.shields.io/badge/license-All%20rights%20reserved-lightgrey?style=flat-square)

<img src="preview.png" alt="Planetarium preview" width="820">

`Planetarium 1.1.0`

</div>

---

## About

**Planetarium** is a tiny procedural space-exploration game built around a simple idea: you are the captain of a ship exploring an effectively endless galaxy, one destination name at a time.

A name becomes a deterministic seed. Revisit the same name and the same world returns, including its terrain, climate, atmosphere, moons, rings, life, orbital characteristics and other generated details.

The interface intentionally stays compact. Most information appears only when you interact with something, so the planet remains the focus rather than a dashboard full of permanent panels.

<table>
<tr>
<td width="25%"><b>Explore</b><br><br>Enter names and discover deterministic worlds, dwarf planets and rare unusual outcomes.</td>
<td width="25%"><b>Observe</b><br><br>Hover planets, moons, orbits and special orbital objects to inspect them.</td>
<td width="25%"><b>Probe</b><br><br>Launch missions to uncover deeper geology, atmosphere, life and anomalies.</td>
<td width="25%"><b>Remember</b><br><br>Save favorites, scanned worlds and exploration history in the Captain's Log.</td>
</tr>
</table>

## Highlights

- Deterministic procedural planets generated from names
- Terrestrial, ocean, desert, ice, volcanic, toxic, barren, verdant and dwarf worlds
- Very rare damaged or partially destroyed procedural planets
- Physically scaled moons with textured native pixel sprites
- Dotted moon orbits with hover, click-to-pin and slow inspection behavior
- Deterministic orbital distances and periods
- Multiple ring types, widths, materials and densities
- Dynamic temperature simulation that can radically transform a world
- Two moving procedural cloud layers with shadows and climate-dependent coverage
- Hurricanes, storms, dust, snow, atmospheric haze, lightning, auroras and volcanic plumes
- Atmosphere chemistry that influences clouds, weather and precipitation
- Procedural alien life ranging from microbes to complex animals and intelligent civilizations
- Orbital satellites, stations, spacecraft and moon missions on capable civilizations
- Probe missions with persistent deep-scan discoveries
- Deterministic anomalies and rare probe-loss events
- Shareable planet URLs
- Captain's Log with Favorites, Recent and Scanned worlds
- JSON export/import of exploration data
- Reversible, pausable and accelerated simulation time
- Clean screenshots of the world or full-interface captures
- Desktop and browser editions powered by the same application code

## Planet views

The view button cycles through four ways of observing the current world:

| View | What it shows |
| --- | --- |
| **Normal** | Surface, atmosphere, clouds, weather and environmental effects |
| **Clean** | Bare surface without clouds or atmospheric effects |
| **Atmosphere** | Atmosphere, clouds and weather emphasized for inspection |
| **Temperature** | Thermal visualization of the planet |

Airless worlds automatically skip the Atmosphere view.

## Exploration

### Entering destinations

Planetarium uses a keyboard-first search flow so global shortcuts do not interfere with typing:

1. Press **Enter**.
2. Type a destination name.
3. Press **Enter** again to travel there.

The same destination always resolves to the same generated world.

### Hover and focus

Interactive objects use the same pixel focus-frame language as the original interface.

Hovering the planet reveals information such as world class, temperature, radius, gravity, water, atmosphere, life, day length and year length. Moons expose their physical size, orbital distance and period. Hovering a dotted orbit keeps the associated moon information accessible without forcing you to chase a fast-moving object with the mouse.

Clicking a moon or its orbit pins it for inspection and slows that moon substantially until you click away.

### Launch Probe

Probes can target planets, moons and certain special orbital objects. A completed scan can reveal:

- atmospheric pressure and major gases
- magnetic field
- tectonic and volcanic activity
- water and ice
- resources
- life type and population
- civilization technology
- unusual anomalies

Scan results persist locally and are restored when the same destination is revisited.

### Captain's Log

The Captain's Log keeps your exploration history without requiring an account or server.

It contains:

- **Favorites**
- **Recent** destinations
- **Scanned** worlds
- **Export JSON**
- **Import JSON**
- **Reset exploration data**

The exported save contains exploration state such as favorites, history, scans, probe results, saved temperatures and the last visited planet.

## Hidden destinations

Not every valid destination is procedurally generated.

Some names produce unusual handcrafted worlds, objects, references or other things your ship computer probably was not expecting. The README deliberately does not provide a spoiler list.

Experiment with names. Familiar places, fictional worlds and suspiciously specific words may occasionally produce something different.

## Controls

| Input | Action |
| --- | --- |
| **Enter** | Start typing a destination / confirm destination |
| **0** or **?** | Random planet |
| **Left / Right** | Change temperature |
| **Up / Down** | Change temperature when not typing |
| **Tab** | Cycle Normal, Clean, Atmosphere and Temperature views |
| **1** | Reverse time |
| **Space** | Pause / resume time |
| **2** | Cycle simulation speed |
| **P** | Launch probe |
| **3** | Launch civilization rocket when available |
| **4** | Take picture |
| **5** | Mute / unmute music |
| **F** | Favorite / unfavorite current destination |
| **L** | Open / close Captain's Log |
| **C** | Copy a shareable planet link |
| **Click planet / moon / orbit** | Pin or unpin an inspection target |
| **Mouse wheel over life report** | Scroll long probe-life reports |
| **Alt + Enter** | Toggle fullscreen |
| **Esc** | First press shows exit prompt; second press exits desktop app |

The entire bottom control bar is also usable with the mouse.

## Web and Windows

Planetarium has two frontends built from the same source:

| Edition | Delivery |
| --- | --- |
| **Web** | Static GitHub Pages build |
| **Windows** | Portable Tauri/WebView2 executable |

The Windows release is intentionally a single executable named:

```text
Planetarium-1.1.0.exe
```

No installer is required. Modern Windows 10 and Windows 11 already provide the WebView2 runtime used by the desktop shell.

## Releases

The application version is stored in `package.json`.

```json
"version": "1.1.0"
```

The release workflow derives the Git tag directly from that value:

```text
1.1.0 -> v1.1.0
```

A successful push to `main` or `master` builds the web and Windows editions. If the version has **not** changed, the existing release under that version tag is refreshed instead of creating another versioned release. Increment `package.json` when you want a new release entry.

The GitHub Release contains one custom downloadable asset: the portable Windows executable. GitHub may also show its standard source-code archives.

<details>
<summary><b>Development and local run</b></summary>

### Requirements

- Node.js 20+
- npm
- Rust toolchain for native desktop builds
- Visual Studio C++ Build Tools on Windows for native desktop builds

### Browser development

```bash
npm run dev:web
```

Then open:

```text
http://127.0.0.1:8080
```

Windows shortcut:

```text
run-dev.bat
```

### Desktop development

```bash
npm install
npm run dev:desktop
```

Windows shortcut:

```text
run-desktop.bat
```

### Validate source and bundled resources

```bash
npm run check
```

</details>

<details>
<summary><b>Build commands</b></summary>

### Web

```bash
npm run build:web
```

Output:

```text
dist/web/
```

Windows shortcut:

```text
build-web.bat
```

### Windows

```bash
npm install
npm run build:win
```

Output:

```text
release/Planetarium-1.1.0.exe
```

Windows shortcut:

```text
build-windows.bat
```

</details>

<details>
<summary><b>GitHub automation</b></summary>

### Build and release

`.github/workflows/build.yml`

The workflow:

1. validates the source
2. builds the static web edition
3. builds the Windows Tauri executable
4. uploads CI artifacts
5. creates or refreshes the published release matching `package.json`

Pull requests build and validate the project but do not publish releases.

The workflow can also be run manually from **Actions -> Build -> Run workflow**.

### GitHub Pages

`.github/workflows/pages.yml`

Pushes to `main` or `master` rebuild the web edition and deploy `dist/web/` through GitHub Pages.

For a new repository, Pages must use:

```text
Settings -> Pages -> Build and deployment -> Source -> GitHub Actions
```

</details>

<details>
<summary><b>Repository structure</b></summary>

```text
Planetarium/
|-- .github/
|   `-- workflows/          CI, releases and GitHub Pages
|-- scripts/                Build, validation and local-server utilities
|-- src/
|   |-- assets/             Pixel art, audio and other bundled resources
|   |-- app.js              Main Planetarium implementation
|   |-- font_data.js        Bitmap-font data
|   `-- index.html          Browser entry point
|-- src-tauri/              Minimal native desktop shell
|-- package.json            Version and npm scripts
|-- preview.png             Repository preview image
`-- README.md
```

The browser code is the application. Tauri provides a lightweight Windows shell around that same code rather than bundling a second implementation.

</details>

## License

No public software license is currently granted. Unless a license is added later, **all rights are reserved**.

---

<div align="center">

**Every name is somewhere. Some places are stranger than others.**

</div>
