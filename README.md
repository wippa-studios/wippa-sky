# Wippa Sky

A modern tower builder game inspired by SimTower, built entirely with HTML5 Canvas, ES6 Modules, and vanilla JavaScript. No frameworks, no dependencies — just serve and play.

## Features

### Core Gameplay
- Build offices, residences, hotels, shops, restaurants, cinemas, sky parks, spas
- New: Sky Lobbies, Parking, Service floors, Basement Lobbies, Subway stations
- Real elevator transport with SCAN dispatch algorithm
- Sims with needs (energy, food, leisure, work), mood, anger, and move-outs
- Per-sim happiness, mood overlay, complaint feed, weekly report cards
- Dynamic day/night cycle with aurora, stars, sun/moon, and clouds
- Underground levels (B1–B8) with dig costs and bedrock limit
- Huge tower support (512+ floors, expandable plots)

### Elevator System
- Real passenger boarding and alighting (no teleporting)
- SCAN (collective control) dispatch algorithm
- Shaft rules: standard (≤30 floor span), express (≤120 span, 2× speed)
- Sky Lobby transfers for towers that need multiple shaft segments
- Car upgrades (max 4 per shaft)
- Call buttons with wait time tracking

### Sim System
- 4 sim kinds: residents, workers, hotel guests, visitors
- Needs decay over time: energy, food, leisure, work
- Mood bands: content (≥70), annoyed (40-69), angry (25-39), furious (<25)
- Consequences: move-outs, office quits, early hotel checkout, income multipliers
- Complaint logging with floor references
- Lobby influx: new sims arrive at ground floor

### Economy
- Income = base × occupancy × mood multiplier × demand
- Expenses = per-cell fixed cost × (1 - service discount)
- Bankruptcy detection with emergency loan system
- Parking boosts office demand
- Subway unlocks at 500 population (visitor influx)

### Performance
- Sprite cache for cell rendering
- O(visible) tower iteration
- Incremental stats tracking (no full-grid scans)
- Sim LOD (offscreen sims update less frequently)
- Throttled minimap redraws

## How to Play

1. Serve with a local HTTP server (ES modules require HTTP):
   ```bash
   ./launch.sh
   # or
   python3 -m http.server 3001
   # or
   npx serve .
   ```
2. Open `http://localhost:3001` in a modern browser
3. Select a tool from the toolbar at the bottom
4. Click an empty cell in the tower to build
5. Manage your funds, keep tenants happy, and build skyward!

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1`-`8` | Select building tool |
| `E` | Elevator |
| `D` / `Del` | Demolish |
| `S` | Select / Info |
| `H` | Toggle mood overlay |
| `Space` | Pause |
| `↑` `↓` | Scroll camera |
| `PgUp` `PgDn` | Scroll 5 floors |
| `Home` | Go to ground lobby |
| `End` | Go to top of tower |
| `Ctrl/Cmd+Wheel` | Zoom in/out |
| `Esc` | Close panels |

### Mouse Controls

| Input | Action |
|-------|--------|
| Left click (tool) | Build / demolish / select |
| Left drag (Select mode) | Pan camera |
| Right/middle drag | Pan camera (any tool) |
| Wheel | Scroll vertically |
| Ctrl/Cmd + Wheel | Zoom |
| Minimap click/drag | Navigate |

## Running Locally

```bash
# Option 1: use the included server script
chmod +x launch.sh
./launch.sh
# Serves on http://localhost:3001

# Option 2: Python
python3 -m http.server 3001

# Option 3: npx
npx serve .
```

**Note:** This game uses ES6 modules and must be served via HTTP. Opening `index.html` directly via `file://` will not work.

## Architecture

```
index.html          — HTML structure + CSS
js/
  constants.js      — Game configuration, floor types, colors
  state.js          — Game state, grid operations
  grid.js           — Building, demolish, support rules
  camera.js         — Camera clamping, smooth scroll, zoom
  input.js          — Mouse, keyboard, minimap input
  hud.js            — HUD, info panel, toast, event log
  achievements.js   — Achievement system
  save.js           — localStorage save/load
  dispatch.js       — Elevator SCAN algorithm
  elevators.js      — Elevator rendering and state
  pathfind.js       — Floor graph pathfinding with BFS
  sims.js           — Sim spawning, movement, rendering
  needs.js          — Sim needs, mood, anger, move-outs
  economy.js        — Income, expenses, demand, bankruptcy
  sprites.js        — Sprite cache for performance
  render/
    sky.js          — Sky, weather, background city
    ground.js       — Street, road, traffic, trees
    tower.js        — Tower facade, interiors, effects
    minimap.js      — Minimap rendering
  main.js           — Game loop, initialization
test/
  *.test.js         — Unit tests for pure logic modules
```

## License

ISC
