# Wippa Sky v2 — Update Specification

Version: 2.0-draft · Date: 2026-09-06 · Status: For review
Target codebase: `index.html` (single-file, ~1760 lines, vanilla JS + Canvas, zero dependencies)

---

## 1. Summary

Wippa Sky v1 is a visually polished SimTower-like with a strong presentation layer, but its simulation is cosmetic: elevators wander randomly with no passengers, sims teleport between floors, mood never has consequences, feedback is limited to one global percentage, the camera is unclamped and janky, there are no basements, and the grid hard-caps at 9×100.

v2 turns the cosmetics into mechanics and removes the scale ceiling:

| # | Feature | One-liner |
|---|---------|-----------|
| F1 | Real elevator transport | Sims queue, board, ride, and alight; wait times drive mood |
| F2 | Sim mood & consequences | Needs, anger, complaints, move-outs, income multipliers |
| F3 | Feedback & happiness UI | Per-sim bubbles, per-floor overlay, complaint feed, report card |
| F4 | Huge tower support | 512+ floors, wider plots, sprite caching, O(visible) rendering |
| F5 | Camera & scroll fixes | Clamped/smooth camera, pan with any tool, accurate minimap |
| F6 | Underground levels | B1–B8: parking, subway, service floors, dig costs, bedrock |
| F7 | Foundation & supporting | Module split, negative-row grid, save/load, pacing, balance |

**Measurable goals**

- 60 fps at 512 floors × 20 cols × 1,200 sims on a 2020-class laptop.
- Any state change (mood, wait, income, vacancy) is visible in the UI within 1 s.
- p95 elevator wait < 30 s (game time, 1×) in a well-served 100-floor tower.
- Every sim state is inspectable (click a sim → info panel).

---

## 2. Current-state audit

Findings from `index.html`, with references. These are the root causes of the user-visible complaints.

### 2.1 Elevators don't really move
- Cars pick a **random** target floor whenever idle (`index.html:540-567`). No passengers, no calls, no dispatch.
- `car.passengers[]` is declared (`index.html:238-240`) but never populated.
- Initial shafts serve only floor 0 (`elev.floors=[0]`, `index.html:234-241`), so cars never move until the player builds shaft cells — on a fresh save the elevators sit dead.
- Sims fake travel: `riding` state is a timer, then teleport (`index.html:517-523`, alpha 0.48 while "riding").
- `sfxElevator()` fires on every random move → noise spam.

### 2.2 Sims never get angry / no consequences
- Mood exists per sim (`index.html:463`) and decays slowly, but nothing consumes it except a ±2-point nudge to global satisfaction (`index.html:604-606`).
- No move-outs, no quits, no vacancy, no income effect. Mood 0 and mood 100 are indistinguishable in gameplay.
- Per-cell `satisfaction` field (`index.html:369`) is written, never read.

### 2.3 No feedback / happiness surface
- HUD shows money/pop/floors/rating only — **no happiness stat** (`index.html:82-87`).
- Info panel shows the *global* satisfaction for every floor (`index.html:1638`) — useless per-floor.
- Build-preview highlight is **dead code**: the hover branch checks `!cell` inside a loop that already skipped empty cells (`index.html:918` vs `index.html:958`) → no green/red ghost ever renders.
- Rating changes silently (`index.html:607`).

### 2.4 Scale ceiling
- `MAX_FLOORS = 100`, `COLS = 9` hard-coded (`index.html:143-144`).
- `getHighestFloor()` scans the whole grid and is called 2×/frame + on resize (`index.html:313-318`, used at `305`, `890`, `1524`).
- Every cell creates multiple gradients + interior drawing per frame (`index.html:929-952`) — fine at 900 cells, fatal at 10,000.
- `updateEconomy()` recomputes a 5×5 amenity scan for every cell every day (`index.html:572-601`).

### 2.5 Scroll/camera issues
- Wheel has **no upper clamp** → scrolls into empty sky forever (`index.html:1667`).
- Left-drag pans **only** in Select mode (`index.html:1651`) — can't pan while building.
- Building snaps the camera (`index.html:399-400`).
- Window resize resets cameraY (`index.html:305`).
- Minimap click math is approximate and there is no minimap drag (`index.html:1686-1692`).
- No zoom control (zoom is a fixed function of window width, `index.html:304`).

### 2.6 No underground
- Row 0 is ground; `screenToCell` rejects `row < 0` (`index.html:343`); grid has no negative rows.
- Ground is drawn as an opaque block filling `GROUND_Y_OFFSET=140px` below the street (`index.html:764-771`) — nothing can exist below it.
- No basement floor types, dig costs, or transit.

### 2.7 Misc
- Day length ≈ 3.3 s at 1× (`dayTime += dt*speed*0.3`, `index.html:615`) — far too fast for feedback to be felt.
- Expenses can drive money negative with no bankruptcy state (`index.html:609-610`).
- Population = sum of `popAdd` constants, not actual sims (`index.html:446`, `577`).
- No save/load, no reset. Achievements stop at 100 floors.
- All logic in one `<script>`; no tests.

---

## 3. Goals & non-goals

**Goals**
1. Simulation depth that is *legible* — every mechanic has a visible symptom.
2. Scale to a huge tower without frame drops or redesign.
3. Smooth, clamped, predictable camera for building anywhere (including down).
4. Keep the zero-dependency, open-`index.html`-and-play ethos.

**Non-goals (v2)**
- 3D, multiplayer, mobile-native app, service workers, achievements beyond tower scope.
- Full pathfinding (stairs, corridors as separate rooms) — stairwells are a stretch goal only.

---

## 4. Cross-cutting system changes (do first — everything depends on these)

### 4.1 Coordinate system: signed rows
- Row `0` = ground. Above-ground floors `1..MAX_FLOORS_ABOVE` (soft cap **512**). Basements `-1..-8` (B1 = -1 … B8 = -8, bedrock).
- `screenToCell` / `cellToScreen` accept negative rows (screen y simply continues below `baseY`; `index.html:328-345` math already supports this if the ground rect stops overpainting it).
- Floor labels: `B1..B8` below ground, `F1..` above. Label every 5 floors as today.

### 4.2 Data model
```
grid: Map<row:int, Array<col>>          // lazy row allocation, sparse above content
cell: { type, built, occupancy, happiness, incomeMult,
        waitingStats:{p95WaitS}, dirty:bool }
elevatorShaft: { id, col, kind:'standard'|'express',
                 floorMin, floorMax, span, cars:[carId] }
car: { shaftId, pos:float, dir:'up'|'down'|'idle',
       passengers:[{simId, dest}], capacity, stops:Set<int>,
       doorT:0..1, state:'idle'|'doors'|'moving' }
sim: { id, kind:'resident'|'worker'|'guest'|'visitor',
       home:{row,col}|null, work:{row,col}|null,
       pos:{row,col,x}, state, needs:{energy,food,leisure,work},
       mood:0..100, patience, waitSince, complaints:n,
       path:[{via:'shaft', id, from, to}] }
towerStats: { highestFloor, basementDepth, dirtyFlags }   // maintained incrementally
```
- `towerStats.highestFloor`/`basementDepth` updated on build/demolish — never scanned (replaces `getHighestFloor()` loops).

### 4.3 Module split (still zero-dependency)
Split into ES modules served statically (README already ships `launch.sh`; note `file://` no longer works):

```
js/constants.js   js/grid.js       js/elevators.js  js/dispatch.js
js/sims.js        js/needs.js      js/economy.js    js/achievements.js
js/save.js        js/camera.js     js/input.js      js/hud.js
js/render/sky.js  js/render/ground.js  js/render/tower.js
js/render/sprites.js  js/render/minimap.js  js/main.js
```
Pure logic modules (`grid`, `dispatch`, `needs`, `economy`) must be importable from Node for tests (no DOM references).

### 4.4 Day length & pacing
- Default day = **90 s at 1×** (30 s at 3×); tunable constant + in-game setting.
- Phases: dawn 15% / day 35% / dusk 20% / night 30%.
- Economy tick stays 1×/day; **mood/needs tick continuous**; complaint aggregation per day; weekly report (see F3).

---

## 5. Feature specifications

### F1 — Real elevator transport

**Problem:** cars wander empty; sims teleport; the single most SimTower-defining system is fake.

**Design**
1. **Calls, not randomness.** Each shaft keeps per-floor up/down call buttons. A sim that needs to change rows walks to the shaft column on its floor (`x → shaft col`), presses a call, and enters `waitingElevator` with a patience meter.
2. **Dispatch — SCAN (collective control).** Car continues in its current direction, collecting passengers whose destination is on the way, stopping for calls it passes when capacity allows. Idle cars answer the oldest call. Deterministic, O(passengers), no lookahead needed. (Implemented in `dispatch.js`; unit-tested.)
3. **Boarding/riding.** Door cycle 1.2 s open + 1.2 s close; sims board up to car capacity (standard 8), ride at `ELEVATOR_SPEED` (raise to 3.5 floors/s), alight at destination, then continue on foot.
4. **Shaft rules (the huge-tower mechanic).**
   - Standard shaft: serves a contiguous span of **≤ 30 floors** (up and/or down from where it's built; may extend into basements).
   - Express shaft: **2× speed, capacity 12**, only stops at ground, sky lobbies, and every 15th floor; max span 120.
   - **Sky Lobby** (new buildable, cost $45k): transfer floor; sims may disembark and re-board another shaft.
5. **Car upgrades.** Player can add cars to a shaft: $15k each, max 4/shaft. Info panel on a shaft shows: cars, span, utilization %, p95 wait.
6. **Pathfinding.** Floor graph: nodes = floors with shaft access, edges = shafts serving both endpoints within span. Sim route = BFS (direct shaft, else via ground lobby / sky lobby). Cache per `(from,to)`, invalidate on build/demolish of shafts. If no route exists, sim refuses the trip and complains ("no elevator route to F37") — this is *the* feedback that forces elevator architecture.
7. **Population influx via lobby.** New residents/workers/hotel guests spawn at the ground lobby and must ride up — elevators are visibly busy from day 1 (fixes the dead-on-start problem).
8. **Visuals:** real car position (already `car.y`), door animation tied to actual stops, floor call lamps (▲▼) on shaft walls, passenger silhouettes in car, occupancy badge, single soft ding per stop (replaces per-move chirp).
9. **Stairwell (stretch goal, S):** cheap $3k cell, walkable ±8 floors, slow (6 s/floor), zero capacity issues — early-game relief valve. Implement only if time allows; excluded from acceptance criteria.

**Acceptance**
- [ ] Fresh save: guests visible riding from lobby within the first day.
- [ ] Selecting a shaft shows span, cars, utilization, p95 wait.
- [ ] p95 wait < 30 s at 1× in a 100-floor tower with ≤1 car per 15 served floors.
- [ ] No sim ever teleports; every row change is a ride (or stairs, if built).
- [ ] Cutting a shaft mid-span strands affected sims within one tick and they complain.
- [ ] `dispatch.js` unit tests: pickup order, capacity overflow, direction reversal, express stops.

---

### F2 — Sim mood & consequences

**Problem:** mood is inert. Sims should get angry, complain, and leave.

**Needs model (per sim, 0..100, decaying over the day)**
- `energy` — restored at home/hotel; drained by activity.
- `food` — restored by restaurants (and home breakfast).
- `leisure` — restored by park/spa/cinema/shop visits.
- `work` (workers only) — must be at their office during day phase, else stress accrues.

**Stressors (add to a per-sim stress accumulator)**
- Elevator wait: > 10 s starts accruing; scales with overshoot.
- No route to destination (F1.6): large one-time hit.
- Crowding: cell occupancy > capacity.
- Commute distance: > 40 floors without express = chronic daily stress.
- Adjacency nuisance (small): cinema/restaurant directly beside a residence.

**Mood** = `100 − stress − unmetNeedsPenalty + amenityRegen` (existing ±2-floor amenity bonus becomes regen, keeping the current intent of `index.html:579-597`).

**Bands & consequences**

| Mood | Band | Visible behavior | Consequence |
|------|------|------------------|-------------|
| ≥70 | content | occasional positive bubble (😊 ♥ ☕) | incomeMult bonus |
| 40–69 | annoyed | neutral bubble, slower walk | — |
| 25–39 | **angry** | red bubble (😠), stomping animation, complaint logged | incomeMult 0.7× |
| <25 | **furious** | storms out (leaves venue / goes straight home) | timer: 2 furious-days → move-out / quit / early checkout |

- **Resident move-out:** home cell occupancy −1; cell shows "VACANT" sign; no income; re-let after 3 days iff tower rating ≥ 3 (demand gating).
- **Worker quit:** office understaffed → that office's `incomeMult` ↓ (staffing ratio = occupancy/capacity).
- **Hotel guest early checkout + 1-star review:** rating pressure (rating inputs now include review score).
- Complaints persist in a rolling ledger: `{simKind, floorRef, reason, waitS}` — powers F3.

**Acceptance**
- [ ] Force a worst case (one shaft, 60 floors, 3× speed): red bubbles and complaint log entries within one day.
- [ ] A furious resident vacates after 2 days and the cell visibly shows VACANT with $0 income.
- [ ] Offices with < 50% staffing earn < 60% of base income.
- [ ] Global happiness = weighted mean of sim moods; rating derives from it + reviews + amenity coverage.

---

### F3 — Feedback & happiness UI

**Problem:** one number in an info panel; no per-floor, per-sim, or trend feedback; broken build preview.

**UI additions**
1. **HUD:** new Happiness stat (color-coded, trend arrow ▲▼ vs yesterday) next to rating; population now = actual resident count (fix `index.html:446`).
2. **Mood overlay (toggle `H` or toolbar button):** every floor cell tinted by its mean sim mood (green→red gradient); shafts show p95 wait badges; VACANT cells flash.
3. **Per-sim bubbles:** mood-colored, with needs icons when relevant (💤 hungry/tired/leisure, 😠 anger, ⏳ waiting); capped to visible sims. Click a sim → info panel (kind, home/work, mood, current need, wait stats).
4. **Info panel (per floor cell):** occupancy vs capacity, mean mood of sims present, `income = base × incomeMult`, built day, and (for shafts) the F1.5 stats. Replaces the global-satisfaction echo at `index.html:1638`.
5. **Complaint feed:** event log gains `complaint` style (amber/red) with floor refs; clicking a complaint pans the camera to that floor.
6. **Weekly report card (modal, every 7 game-days):** income, expenses, happiness trend, top-3 complaint categories, move-outs, new move-ins, rating change. Dismissable, also opened from HUD.
7. **Fix build preview (bug):** render green/red ghost on empty cells (canBuild/cost-check) — restore the intent of `index.html:955-963` by testing hover *before* the `if (!cell) continue` at `index.html:918`. Also show cost tooltip near cursor.
8. **Rating change animation:** stars fill/empty with a pulse + toast when crossing a threshold.

**Acceptance**
- [ ] Ghost preview visible for every tool on empty cells; red when unaffordable/invalid.
- [ ] Mood overlay and bubbles readable at 0.62 zoom (worst-case mobile width).
- [ ] Weekly report appears within 1 s of day 7 boundary and is pausable-speed-independent.
- [ ] Clicking a complaint pans to the floor.

---

### F4 — Huge tower support

**Problem:** 9×100 hard cap and per-frame gradient creation won't survive a huge tower.

**Scale targets**
- Height: soft cap **512** floors (constant; architecture supports more). Land: start 9 cols, **land purchases** add 3 cols per side up to **21 total** (cost: $400k → $1.5M → $6M → $20M; unlocks at rating 2/3/4/5). Tower stays centered; `towerLeft` math already centers (`index.html:329`).
- Achievements extended: 150 (🌤 *Altitude Sickness*), 250 (🛰 *Orbital Views*), 512 (🌌 *Space Elevator*), plus deepest basement, express shaft, 1,000 residents, zero-complaint week.

**Performance plan (budgets in §7)**
1. **Sprite cache (`render/sprites.js`):** pre-render each cell type's interior + facade to an offscreen canvas per `(type × dayPhase:day/night × zoomBucket)`. Interiors are deterministic per (row,col) via `mulberry32` seed (`index.html:1167`) — bake per-cell variants once, blit thereafter. Invalidate on zoom change only. This removes the per-frame gradient storm (`index.html:929-952`).
2. **Row-window iteration:** compute visible row range from camera each frame; iterate only that ± 2 rows (the per-cell cull at `index.html:920` becomes a loop bound instead).
3. **Incremental stats:** `highestFloor`/`basementDepth` maintained on build/demolish; minimap and camera clamps read them (removes `getHighestFloor()` scans).
4. **Economy caching:** per-cell amenity score recomputed only when a cell in its 5×5 neighborhood changes (dirty flags); daily tick becomes O(dirty).
5. **Sim LOD:** visible sims tick every frame; offscreen sims tick every 4th frame (movement-only, needs aggregated); particle cap 300; minimap redraw throttled to 4 Hz or on change; HUD DOM writes only on value change.
6. **Memory:** grid rows allocated lazily; sims pooled; save format stores sparse cells only.

**Camera support for huge towers:** zoom buttons + `Ctrl/Cmd+wheel` (buckets 0.5 / 0.75 / 1 / 1.25 / 1.6), "Go to floor" input (type a floor number, Enter), Home/End keys, minimap drag (F5).

**Acceptance**
- [ ] 60 fps at 512×20 with 1,200 sims (Chrome, 2020-class laptop); frame budget table in §7 respected.
- [ ] Building floor 512 works with no camera jump; minimap remains accurate.
- [ ] No `getHighestFloor()` full-grid scans in any per-frame path.
- [ ] Sprite cache hit rate > 99% in steady state (log counter in dev overlay).

---

### F5 — Camera & scroll fixes

**Problem:** unclamped wheel, tool-locked panning, snap-scroll, resize jumps, inaccurate minimap.

**Spec**
1. **Clamp:** `cameraY ∈ [minCamY, maxCamY]` computed from incremental stats with a 3-floor margin above the highest built floor and below the deepest basement. Recompute on build/demolish. Kills the infinite sky scroll (`index.html:1667`).
2. **Panning always available:** right-drag or middle-drag pans regardless of active tool; left-drag pans in Select mode (current behavior kept). Space-drag = temporary pan override.
3. **Edge auto-pan:** while a *build* tool is active and the pointer is within 40 px of the top/bottom screen edge, camera pans smoothly (12 px/s ramping). Building at screen edges becomes possible without switching tools.
4. **Smooth wheel:** target-camera + lerp (0.15/frame) instead of raw jumps; `Ctrl/Cmd+wheel` = zoom (F4). Wheel on the *page* (over HUD panels) must not scroll the canvas — check event target.
5. **Build auto-follow (replaces snap at `index.html:399-400`):** only if the built cell is offscreen, ease the camera so the cell is 2 rows inside the viewport. Never jump.
6. **Resize:** preserve the camera's anchor row (center of viewport) instead of resetting (`index.html:305`).
7. **Minimap:** exact bidirectional mapping (world row ↔ minimap y, including basements below a ground line drawn across the minimap); supports click **and drag** to scroll; viewport rectangle clamped.
8. **Keyboard:** hold ↑/↓ = smooth scroll (clamped); PageUp/PageDown = ±5 floors; Home = ground lobby; End = top. Update README table.
9. **Underground range:** clamp and minimap extended by F6 automatically via signed rows.

**Acceptance**
- [ ] Wheel/drag/keys can never leave content bounds (±3-floor margin).
- [ ] Pan works with a build tool active via right/middle-drag and edge auto-pan.
- [ ] Building 20 cells in a column produces zero camera jumps, one smooth follow at most.
- [ ] Window resize keeps the same floor centered.
- [ ] Minimap click lands within ±1 row of the clicked cell; drag pans continuously.

---

### F6 — Underground levels (B1–B8)

**Problem:** nothing below ground; ground is opaque fill.

**World changes**
- Rows -1..-8 = B1..B8. **Bedrock at B8** (hard limit, drawn as dark rock; build attempts show red ghost + toast "Bedrock").
- Ground rendering (`render/ground.js`): street/road strip stays at `baseY`; below it a **soil cross-section** (gradient + strata lines + utility conduits) sized to `basementDepth` + 120 px margin. Basement cells render inside it with a foundation wall outline, always-lit interiors (no windows), and a darker ceiling. Background city/stars/sky only above `baseY`. `GROUND_Y_OFFSET` becomes dynamic.
- **Digging:** building any basement cell requires a one-time **dig cost** `$2,500 + $600×depth` (B1 = $3,100 … B8 = $7,300) + the type's build cost. Support rule inverted: a cell requires the cell *above* it (B1 requires ground floor existence; Bn requires Bn-1 dug). Elevator shafts may extend down and count as support.
- **Camera/labels/minimap** handle negative rows (F4.1/F5); minimap shows a ground line with B levels below.

**New floor types**

| Type | Depth | Cost | Effect |
|------|-------|------|--------|
| Parking 🅿️ | any B | $9k | Income $120/day; each level adds office demand +4%; cars visible |
| Service ⚙️ | B2+ | $14k | −8% daily expenses each (max 3); boiler/maintenance visuals |
| Basement Lobby 🚪 | any B | $6k | Extends lobby; required adjacent to Subway |
| Subway 🚇 | B6 only | $80k | Unlocks at 500 pop; visitor influx ×1.5; fare income $500/day; train arrival animation + surge of visitors |
| Shop / Restaurant | B1–B2 only | std | Std costs; mood penalty "windowless" −2 regen (keeps deep retail unattractive) |

- Sim usage: subway spawns visitors at B6 who ride up (heavy elevator load — intentional design tension); parking serves commuters (workers arrive "by car", skipping lobby elevator pressure if their office floor has parking access — simplified: parking reduces worker commute stress by 25%).
- Achievements: *Dig It* (first basement), *Mole City* (B8), *Transit Oriented* (subway).

**Acceptance**
- [ ] Dig B1 under an existing tower; soil cross-section and foundation wall render correctly; road/street unchanged.
- [ ] Bedrock blocks B9 with clear feedback.
- [ ] Subway at 500 pop: visible visitor surge through B6 lobby; income line item in weekly report.
- [ ] Elevator shaft extended to B3 serves basements; sims in basements ride correctly.
- [ ] Minimap shows underground extent; camera clamp includes it.

---

### F7 — Foundation & supporting systems

1. **Save/load (`save.js`)** — localStorage `wippa-sky-save-v2`: `{version, day, dayTime, money, rating, grid(sparse), shafts, cars, sims(core fields), stats, achievements, settings, camera}`. Autosave every game-day + on `beforeunload`; manual Save/New Tower buttons in a small menu; migrate-or-discard on version mismatch with a toast. Sim count > 1,500 → save aggregates instead of individual sims (guards localStorage quota).
2. **Bankruptcy:** money < 0 for 3 consecutive days → "Receivership" modal: emergency loan (+$200k, −rating 1) or demolish-prompt. Prevents the current silent negative drift (`index.html:609-610`).
3. **Economy rebalance:** every income source = `base × occupancy% × incomeMult(mood) × demand`; expenses scale with floors + sims; demand = f(rating, parking bonus, subway bonus). Full tuning table to be validated in playtest milestone (numbers in this doc are defaults, marked tunable).
4. **Settings:** sound, speed, day length (60/90/150 s), reduced motion (disables crane/sheen/aurora), show mood overlay by default.
5. **README update:** new shortcuts (H, Home/End, Ctrl+wheel), basements, save feature, ES-module note ("serve via `launch.sh`; `file://` unsupported").
6. **Accessibility:** tooltips on all tools, focusable toolbar with keyboard nav, contrast-checked HUD values, `prefers-reduced-motion` respected.

---

## 6. Interaction model summary (post-v2)

| Input | Action |
|-------|--------|
| Left click (tool) | Build / demolish / select |
| Left drag (Select) | Pan |
| Right/middle drag | Pan (any tool) |
| Wheel | Vertical scroll (clamped, smoothed) |
| Ctrl/Cmd + wheel | Zoom (0.5–1.6 buckets) |
| `1`-`8` / `E` / `D` / `S` | Tools (as today) |
| `H` | Toggle mood overlay |
| `↑↓` (hold) / `PgUp,PgDn` / `Home,End` | Smooth scroll / ±5 floors / ground, top |
| Minimap click/drag | Navigate |
| Click complaint / sim / floor | Info panel / pan-to |

---

## 7. Performance budget (target: 16.6 ms/frame at 512×20, 1,200 sims)

| Subsystem | Budget | Mechanism |
|-----------|--------|-----------|
| Sky + background | 2.0 ms | unchanged cost, screen-space only |
| Ground + underground | 1.0 ms | static strips cached to offscreen when camera static |
| Tower cells | 8.0 ms | sprite blit of visible rows only (~40 rows × 20 cols worst case) |
| Sims | 3.0 ms | LOD ticks; sprite-drawn with 4 pose variants |
| Elevators | 1.0 ms | SCAN is O(passengers); ≤ 40 cars |
| Minimap | 0.5 ms | 4 Hz redraw or dirty-triggered |
| HUD/DOM | 0.5 ms | change-detection writes |
| Headroom | 0.6 ms | — |

Dev overlay (toggle `` ` ``): fps, frame ms breakdown, sprite-cache hit rate, sim count, active waits. Used to verify budgets in the QA milestone.

---

## 8. Testing & QA

**Automated (Node built-in test runner, no deps)** — pure modules only:
```
npm test   →   node --test test/
test/grid.test.js        signed rows, lazy alloc, support rules up/down, bedrock
test/dispatch.test.js    SCAN order, capacity, reversal, express stops, span limits
test/needs.test.js       mood bands, stress accrual, move-out timers, re-let gating
test/economy.test.js     incomeMult, occupancy, demand, expenses, bankruptcy timer
test/pathfind.test.js    routes via sky lobbies, no-route case, cache invalidation
test/save.test.js        round-trip, migration, quota aggregation
```

**Manual QA checklist (per milestone gate):** fresh-save first 10 minutes (is elevators/feedback alive), 100-floor stress build, basement dig sequence, resize/scroll torture (wheel spam at bounds), save → reload → identical state, 512×20 perf run with dev overlay, reduced-motion + sound-off pass, narrow-window (900px) layout pass.

---

## 9. Delivery plan

| Milestone | Contents | Gate |
|-----------|----------|------|
| **M1 Foundation** | Signed-row grid, module split, camera fixes (F5), build-preview bug, incremental stats, save/load skeleton | Camera torture + grid tests green |
| **M2 Elevators** | F1 dispatch, boarding, shaft rules, pathfinding, lobby influx | F1 acceptance list |
| **M3 Mood & feedback** | F2 needs/consequences + F3 all UI, weekly report, day length | F2+F3 acceptance lists |
| **M4 Underground** | F6 dig, rendering, subway, minimap/labels below ground | F6 acceptance list |
| **M5 Huge tower** | F4 sprite cache, row windows, LOD, land purchases, zoom, achievements | 512×20 perf run within budget |
| **M6 Balance & polish** | Economy tuning playtest, bankruptcy, settings, README, accessibility | Full QA checklist |

Rationale: M1 first because signed rows and the camera are prerequisites for both basements and huge towers; M5 last because performance work is only meaningful once the sim load it must survive exists.

---

## 10. Open questions (decide before M1)

1. **Plot width:** keep 9 cols at start with land purchases (proposed), or widen the starting plot to 12?
2. **Day length default:** 90 s proposed — 60 s (snappier) vs 150 s (relaxed)?
3. **Stairwells:** in-scope for M2 or dropped?
4. **Touch support:** basic touch pan/tap/pinch — worth including in M5 or defer to v2.1?
5. **Save export/import** (JSON file download) in addition to localStorage?

## 11. Out of scope / future

Multiplayer · 3D view · service workers/offline install · seasonal/weather effects on mood · mortgages/loans beyond emergency · tenant names & biographies · scenario/campaign mode.
