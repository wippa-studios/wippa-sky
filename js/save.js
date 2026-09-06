// ═══════════════════════════════════════════
//  SAVE — Wippa Sky v2
// ═══════════════════════════════════════════

const SAVE_KEY = 'wippa-sky-save-v2';
const SAVE_VERSION = 1;

export function saveGame(state) {
  try {
    const data = {
      version: SAVE_VERSION,
      money: state.money,
      population: state.population,
      satisfaction: state.satisfaction,
      rating: state.rating,
      day: state.day,
      dayTime: state.dayTime,
      speed: state.speed,
      cameraY: state.cameraY,
      zoom: state.zoom,
      cols: state.cols,
      landPurchases: state.landPurchases,
      highestFloor: state.highestFloor,
      basementDepth: state.basementDepth,
      totalBuilt: state.totalBuilt,
      settings: { ...state.settings },
      stats: {
        p95Wait: state.stats.p95Wait,
        moveOuts: state.stats.moveOuts,
        moveIns: state.stats.moveIns,
        complaintsThisWeek: state.stats.complaintsThisWeek,
      },
      achievements: [...state.achievementsUnlocked],
      grid: serializeGrid(state),
      elevators: serializeElevators(state),
      elevatorCars: serializeElevatorCars(state),
      tenants: serializeTenants(state),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    state.lastSaveTime = Date.now();
    return true;
  } catch (e) {
    console.error('Save failed:', e);
    return false;
  }
}

export function loadGame(state) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data.version !== SAVE_VERSION) {
      localStorage.removeItem(SAVE_KEY);
      return false;
    }
    state.money = data.money;
    state.population = data.population;
    state.satisfaction = data.satisfaction;
    state.rating = data.rating;
    state.day = data.day;
    state.dayTime = data.dayTime;
    state.speed = data.speed;
    state.cameraY = data.cameraY;
    state.zoom = data.zoom;
    state.cols = data.cols;
    state.landPurchases = data.landPurchases;
    state.highestFloor = data.highestFloor;
    state.basementDepth = data.basementDepth;
    state.totalBuilt = data.totalBuilt;
    state.settings = { ...data.settings };
    state.stats = { ...data.stats, happinessHistory: [] };
    state.achievementsUnlocked = new Set(data.achievements || []);
    deserializeGrid(state, data.grid);
    deserializeElevators(state, data.elevators);
    deserializeElevatorCars(state, data.elevatorCars);
    deserializeTenants(state, data.tenants);
    return true;
  } catch (e) {
    console.error('Load failed:', e);
    localStorage.removeItem(SAVE_KEY);
    return false;
  }
}

export function hasSave() {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
}

export function exportSave() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  return btoa(raw);
}

export function importSave(encoded) {
  try {
    const raw = atob(encoded);
    JSON.parse(raw);
    localStorage.setItem(SAVE_KEY, raw);
    return true;
  } catch (e) {
    return false;
  }
}

function serializeGrid(state) {
  const sparse = [];
  for (const [row, cells] of state.grid) {
    for (let c = 0; c < state.cols; c++) {
      const cell = cells[c];
      if (cell) {
        sparse.push({ r: row, c, t: cell.type, b: cell.built, o: cell.occupancy,
          h: cell.happiness, m: cell.incomeMult, s: cell.staff,
          v: cell.vacant ? 1 : 0, vs: cell.vacantSince || 0 });
      }
    }
  }
  return sparse;
}

function deserializeGrid(state, sparse) {
  state.grid.clear();
  for (const item of sparse) {
    const row = getOrCreateRow(state, item.r);
    row[item.c] = {
      type: item.t, built: item.b, occupancy: item.o,
      happiness: item.h, incomeMult: item.m, staff: item.s,
      vacant: item.v === 1, vacantSince: item.vs || 0,
      dirty: true,
    };
  }
}

function serializeElevators(state) {
  return state.elevators.map(e => ({
    id: e.id, col: e.col, kind: e.kind,
    floors: e.floors, floorMin: e.floorMin, floorMax: e.floorMax,
  }));
}

function deserializeElevators(state, data) {
  state.elevators = data.map(e => ({ ...e }));
}

function serializeElevatorCars(state) {
  return state.elevatorCars.map(c => ({
    eid: c.elevatorId, pos: c.pos, dir: c.dir,
    cap: c.capacity, state: c.state, door: c.doorOpen,
    p: c.passengers.map(ps => ({ sid: ps.simId, df: ps.destFloor })),
  }));
}

function deserializeElevatorCars(state, data) {
  state.elevatorCars = data.map(c => ({
    elevatorId: c.eid, pos: c.pos, targetPos: 0, dir: c.dir,
    floor: Math.round(c.pos), targetFloor: 0,
    state: c.state, doorOpen: c.door, doorTimer: 0,
    passengers: (c.p || []).map(ps => ({ simId: ps.sid, destFloor: ps.df })),
    capacity: c.cap, waitTimer: 2, stops: new Set(),
  }));
}

function serializeTenants(state) {
  return state.tenants.slice(0, 1500).map(t => ({
    id: t.id, k: t.kind, hf: t.home?.floor, hc: t.home?.col,
    wf: t.work?.floor, wc: t.work?.col, f: t.floor, c: t.col,
    x: t.x, m: t.mood, e: t.energy, fo: t.food, l: t.leisure,
    w: t.workNeed, s: t.state,
  }));
}

function deserializeTenants(state, data) {
  state.tenants = data.map(t => ({
    id: t.id, kind: t.k,
    home: t.hf != null ? { floor: t.hf, col: t.hc } : null,
    work: t.wf != null ? { floor: t.wf, col: t.wc } : null,
    floor: t.f, col: t.c, x: t.x, targetX: t.x,
    mood: t.m, energy: t.e, food: t.fo, leisure: t.l, workNeed: t.w,
    state: t.s, stateTimer: 1, travelTimer: 0,
    patience: 100, waitSince: 0, complaints: 0,
    color: `hsl(${Math.random() * 360},58%,62%)`,
    skin: ['#f7c99b', '#d99a73', '#8d5524', '#f0b27a'][Math.floor(Math.random() * 4)],
    hair: ['#24180f', '#573b2a', '#18202b', '#c27a48'][Math.floor(Math.random() * 4)],
    direction: 1, action: '', bubble: '', bubbleTimer: 0,
    targetFloor: t.f, targetCol: t.c, route: null, routeIndex: 0,
  }));
}

function getOrCreateRow(state, row) {
  if (!state.grid.has(row)) {
    state.grid.set(row, new Array(state.cols).fill(null));
  }
  return state.grid.get(row);
}
