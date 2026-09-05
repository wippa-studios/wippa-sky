# Wippa Sky

A modern tower builder game inspired by SimTower, built entirely with HTML5 Canvas, CSS, and vanilla JavaScript. No frameworks, no dependencies — just open `index.html` in a browser.

## Features

- Build offices, residences, hotels, shops, restaurants, cinemas, sky parks, and spas
- Elevator system with animated cars and door mechanics
- Simulated tenants who move between floors based on time of day
- Dynamic day/night cycle with aurora, stars, sun/moon, and clouds
- Detailed floor interiors (desks, beds, shelves, screens, candles...)
- Background cityscape with lit windows at night
- Animated ground-level traffic with headlights and light trails
- Achievement system with 14 milestones
- Sound effects via Web Audio API (toggle with the speaker button)
- Minimap for quick navigation
- Speed controls (pause, 1x, 2x, 3x)
- Keyboard shortcuts (1-8 for tools, arrows to scroll, space to pause)

## How to Play

1. Open `index.html` in any modern browser
2. Select a tool from the toolbar at the bottom
3. Click an empty cell in the tower to build
4. Manage your funds, keep tenants happy, and climb to 100 floors

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1`-`8` | Select building tool |
| `E` | Elevator |
| `D` / `Del` | Demolish |
| `S` | Select / Info |
| `Space` | Toggle pause |
| `↑` `↓` | Scroll camera |
| `Esc` | Close info panel |

## Running Locally

```bash
# Option 1: just open index.html
open index.html

# Option 2: use the included server script
chmod +x launch.sh
./launch.sh
# Serves on http://localhost:3001

# Option 3: Python
python3 -m http.server 3001
```

## License

ISC
