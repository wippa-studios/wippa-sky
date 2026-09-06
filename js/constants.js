// ═══════════════════════════════════════════
//  CONSTANTS — Wippa Sky v2
// ═══════════════════════════════════════════

export const MAX_FLOORS_ABOVE = 512;
export const MAX_BASEMENTS = 8;
export const DEFAULT_COLS = 9;
export const CELL_W = 80;
export const CELL_H = 40;
export const GROUND_Y_OFFSET = 140;
export const ELEVATOR_SPEED = 3.5;
export const ELEVATOR_CAPACITY = 8;
export const EXPRESS_CAPACITY = 12;
export const EXPRESS_SPEED_MULT = 2;
export const STANDARD_SHAFT_MAX_SPAN = 30;
export const EXPRESS_SHAFT_MAX_SPAN = 120;
export const SKY_LOBBY_COST = 45000;
export const CAR_UPGRADE_COST = 15000;
export const MAX_CARS_PER_SHAFT = 4;
export const DAY_LENGTH_SECONDS = 90;
export const DAY_PHASES = { DAWN: 0.15, DAY: 0.5, DUSK: 0.7, NIGHT: 1.0 };
export const MOOD_CONTENT = 70;
export const MOOD_ANNYED = 40;
export const MOOD_ANGRY = 25;
export const MOOD_FURIOUS = 15;
export const ELEVATOR_WAIT_STRESS_START = 10;
export const ELEVATOR_WAIT_STRESS_RATE = 0.5;
export const FURIOUS_DAYS_BEFORE_MOVEOUT = 2;
export const RELET_MIN_RATING = 3;
export const RELET_DAYS = 3;
export const BANKRUPTCY_GRACE_DAYS = 3;
export const BANKRUPTCY_LOAN = 200000;
export const BANKRUPTCY_RATING_PENALTY = 1;
export const SUBWAY_UNLOCK_POP = 500;
export const SUBWAY_VISITOR_MULT = 1.5;
export const SUBWAY_INCOME = 500;
export const PARKING_DEMAND_BONUS = 0.04;
export const SERVICE_EXPENSE_REDUCTION = 0.08;
export const MAX_SERVICES = 3;
export const DEEP_RETAIL_MOOD_PENALTY = 2;
export const DIG_COST_BASE = 2500;
export const DIG_COST_PER_DEPTH = 600;
export const LAND_PURCHASE = [
  { addCols: 3, cost: 400000, minRating: 2 },
  { addCols: 3, cost: 1500000, minRating: 3 },
  { addCols: 3, cost: 6000000, minRating: 4 },
  { addCols: 3, cost: 20000000, minRating: 5 },
];

export const COLORS = {
  building: {
    office: '#3b82f6', residence: '#8b5cf6', hotel: '#f59e0b',
    shop: '#ec4899', restaurant: '#ef4444', cinema: '#6366f1',
    spa: '#14b8a6', park: '#22c55e', elevator: '#64748b', lobby: '#475569',
    parking: '#a3a3a3', service: '#78716c', basementLobby: '#57534e', subway: '#0ea5e9',
    skyLobby: '#f59e0b',
  },
  buildingLight: {
    office: '#60a5fa', residence: '#a78bfa', hotel: '#fbbf24',
    shop: '#f472b6', restaurant: '#f87171', cinema: '#818cf8',
    spa: '#2dd4bf', park: '#4ade80', elevator: '#94a3b8', lobby: '#64748b',
    parking: '#d4d4d4', service: '#a8a29e', basementLobby: '#78716c', subway: '#38bdf8',
    skyLobby: '#fcd34d',
  },
  buildingDark: {
    office: '#1d4ed8', residence: '#6d28d9', hotel: '#d97706',
    shop: '#db2777', restaurant: '#dc2626', cinema: '#4f46e5',
    spa: '#0d9488', park: '#16a34a', elevator: '#475569', lobby: '#334155',
    parking: '#525252', service: '#44403c', basementLobby: '#44403c', subway: '#0284c7',
    skyLobby: '#d97706',
  },
  mood: {
    content: '#4ade80',
    annoyed: '#fbbf24',
    angry: '#f87171',
    furious: '#ef4444',
  },
  soil: ['#3d2914', '#4a3520', '#5a4530', '#2d1f0f'],
};

export const FLOOR_TYPES = {
  office:      { name: 'Office',      cost: 10000,  income: 200,  popAdd: 0,  satisfaction: 2,  residents: false, icon: '💼', capacity: 5,  staffCapacity: 5 },
  residence:   { name: 'Residence',   cost: 15000,  income: 50,   popAdd: 4,  satisfaction: 5,  residents: true,  icon: '🏠', capacity: 4,  staffCapacity: 0 },
  hotel:       { name: 'Hotel',       cost: 20000,  income: 300,  popAdd: 0,  satisfaction: 3,  residents: true,  icon: '🏨', capacity: 2,  staffCapacity: 0 },
  shop:        { name: 'Shop',        cost: 8000,   income: 150,  popAdd: 0,  satisfaction: 4,  residents: false, icon: '🛍️', capacity: 3,  staffCapacity: 2 },
  restaurant:  { name: 'Restaurant',  cost: 12000,  income: 250,  popAdd: 0,  satisfaction: 6,  residents: false, icon: '🍽️', capacity: 4,  staffCapacity: 2 },
  cinema:      { name: 'Cinema',      cost: 25000,  income: 400,  popAdd: 0,  satisfaction: 8,  residents: false, icon: '🎬', capacity: 8,  staffCapacity: 2 },
  park:        { name: 'Sky Park',    cost: 18000,  income: 30,   popAdd: 0,  satisfaction: 10, residents: false, icon: '🌳', capacity: 12, staffCapacity: 0 },
  spa:         { name: 'Spa',         cost: 22000,  income: 350,  popAdd: 0,  satisfaction: 7,  residents: false, icon: '🧖', capacity: 2,  staffCapacity: 1 },
  elevator:    { name: 'Elevator',    cost: 5000,   income: 0,    popAdd: 0,  satisfaction: 0,  residents: false, icon: '🛗', capacity: 0,  staffCapacity: 0 },
  lobby:       { name: 'Lobby',       cost: 0,      income: 0,    popAdd: 0,  satisfaction: 0,  residents: false, icon: '🚪', capacity: 0,  staffCapacity: 0 },
  skyLobby:    { name: 'Sky Lobby',   cost: 45000,  income: 50,   popAdd: 0,  satisfaction: 2,  residents: false, icon: '☁️', capacity: 20, staffCapacity: 2 },
  parking:     { name: 'Parking',     cost: 9000,   income: 120,  popAdd: 0,  satisfaction: 1,  residents: false, icon: '🅿️', capacity: 8,  staffCapacity: 0 },
  service:     { name: 'Service',     cost: 14000,  income: 0,    popAdd: 0,  satisfaction: 0,  residents: false, icon: '⚙️', capacity: 0,  staffCapacity: 2 },
  basementLobby: { name: 'B. Lobby',  cost: 6000,   income: 0,    popAdd: 0,  satisfaction: 0,  residents: false, icon: '🚪', capacity: 0,  staffCapacity: 0 },
  subway:      { name: 'Subway',      cost: 80000,  income: 500,  popAdd: 0,  satisfaction: 3,  residents: false, icon: '🚇', capacity: 40, staffCapacity: 2 },
};

export const LAND_PURCHASE_DEFAULT = 0;

export function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
