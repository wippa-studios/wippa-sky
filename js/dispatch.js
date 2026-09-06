// Elevator dispatch system — SCAN (collective control) algorithm
// for Wippa Sky v2

const DOOR_OPEN_DURATION = 1.2;
const DOOR_CLOSE_DURATION = 1.2;
const FLOOR_TRAVEL_TIME = 1.0; // seconds per floor of travel
const CAR_CAPACITY = 8;
const EXPRESS_STOP_INTERVAL = 15;

// ── helpers ────────────────────────────────────────────────────

function carKey(shaftId, floor, dir) {
  return `${shaftId}-${floor}-${dir}`;
}

function floorDiff(a, b) {
  return Math.abs(a - b);
}

function isExpressStop(car, elevator, floor) {
  if (elevator.kind !== 'express') return true;
  if (floor === 0) return true;
  if (floor === state_skyLobby(elevator)) return true;
  return floor % EXPRESS_STOP_INTERVAL === 0;
}

// placeholder; replaced at call-site via closure
let state_skyLobby = () => 0;

function resolveSkyLobby(elevator) {
  // skyLobby is typically the highest floor in the shaft's contiguous block
  return elevator.floorMax;
}

// ── init ───────────────────────────────────────────────────────

export function initDispatch(state) {
  if (!state._callButtons) {
    state._callButtons = new Map();
  }
  if (!state.elevatorCars) {
    state.elevatorCars = [];
  }
  state_skyLobby = resolveSkyLobby;
}

// ── findBestShaftForFloor ──────────────────────────────────────

export function findBestShaftForFloor(state, floor, col) {
  const candidates = (state.elevators || []).filter(e => {
    return floor >= e.floorMin && floor <= e.floorMax;
  });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    return Math.abs(a.col - col) - Math.abs(b.col - col);
  });
  return candidates[0];
}

// ── getShaftForSim ─────────────────────────────────────────────

export function getShaftForSim(state, sim, fromFloor, toFloor) {
  const elevators = state.elevators || [];

  // direct shaft serving both floors
  const direct = elevators.find(e => {
    return fromFloor >= e.floorMin && fromFloor <= e.floorMax &&
           toFloor >= e.floorMin && toFloor <= e.floorMax;
  });
  if (direct) return direct;

  // try skyLobby transfer
  for (const e of elevators) {
    const skyLobby = resolveSkyLobby(e);
    const fromInShaft = fromFloor >= e.floorMin && fromFloor <= e.floorMax;
    const skyInShaft = skyLobby >= e.floorMin && skyLobby <= e.floorMax;
    if (!fromInShaft || !skyInShaft) continue;

    const otherShaft = elevators.find(e2 => {
      if (e2.id === e.id) return false;
      return skyLobby >= e2.floorMin && skyLobby <= e2.floorMax &&
             toFloor >= e2.floorMin && toFloor <= e2.floorMax;
    });
    if (otherShaft) return e;
  }
  return null;
}

// ── callElevator ───────────────────────────────────────────────

export function callElevator(state, floor, col, direction) {
  if (!state._callButtons) initDispatch(state);

  const shaft = findBestShaftForFloor(state, floor, col);
  if (!shaft) return null;

  const key = carKey(shaft.id, floor, direction);
  if (!state._callButtons.has(key)) {
    state._callButtons.set(key, {
      floor,
      dir: direction,
      timestamp: Date.now(),
      shaftId: shaft.id,
      served: false,
    });
  }

  assignCar(state, shaft, floor);
  return shaft;
}

// ── assignCar (SCAN) ───────────────────────────────────────────

export function assignCar(state, shaft, callFloor) {
  const cars = (state.elevatorCars || []).filter(c => c.elevatorId === shaft.id);
  if (cars.length === 0) return null;

  const pendingCalls = [];
  for (const [key, call] of state._callButtons) {
    if (call.shaftId === shaft.id && !call.served) {
      pendingCalls.push(call);
    }
  }

  if (pendingCalls.length === 0) return null;

  let bestCar = null;
  let bestScore = Infinity;

  for (const car of cars) {
    for (const call of pendingCalls) {
      const score = carCallScore(car, call, shaft);
      if (score < bestScore) {
        bestScore = score;
        bestCar = car;
      }
    }
  }

  if (!bestCar) return cars[0];

  // direct the car toward the nearest unserved call
  const target = findNearestCall(bestCar, pendingCalls);
  if (target) {
    if (target.floor > Math.round(bestCar.pos)) {
      bestCar.dir = 'up';
    } else if (target.floor < Math.round(bestCar.pos)) {
      bestCar.dir = 'down';
    }
    bestCar.stops.add(target.floor);
  }

  return bestCar;
}

function carCallScore(car, call, shaft) {
  const carFloor = Math.round(car.pos);
  const dist = floorDiff(carFloor, call.floor);
  let score = dist;

  // bonus: call is in same direction as car travel
  if (car.dir === 'up' && call.floor > carFloor) score -= 10;
  if (car.dir === 'down' && call.floor < carFloor) score -= 10;

  // car is idle — strong preference
  if (car.dir === 'idle') score -= 5;

  // penalise cars already full
  const load = car.passengers ? car.passengers.length : 0;
  if (load >= CAR_CAPACITY) score += 20;

  return score;
}

function findNearestCall(car, calls) {
  const carFloor = Math.round(car.pos);
  let nearest = null;
  let bestDist = Infinity;

  for (const call of calls) {
    const d = floorDiff(carFloor, call.floor);
    if (d < bestDist) {
      bestDist = d;
      nearest = call;
    }
  }
  return nearest;
}

// ── main update loop ───────────────────────────────────────────

export function updateDispatch(state, dt) {
  if (!state._callButtons) initDispatch(state);
  const cars = state.elevatorCars || [];
  const elevators = state.elevators || [];

  for (const car of cars) {
    const elevator = elevators.find(e => e.id === car.elevatorId);
    if (!elevator) continue;

    updateCar(car, elevator, state, dt);
  }
}

function updateCar(car, elevator, state, dt) {
  switch (car.state) {
    case 'idle':
      tickIdle(car, elevator, state, dt);
      break;
    case 'doors':
      tickDoors(car, elevator, state, dt);
      break;
    case 'moving':
      tickMoving(car, elevator, state, dt);
      break;
  }
}

// ── idle ───────────────────────────────────────────────────────

function tickIdle(car, elevator, state, dt) {
  // check if there are passengers inside (shouldn't happen, but handle)
  if (car.passengers && car.passengers.length > 0) {
    car.state = 'moving';
    return;
  }

  // find pending calls for this shaft
  const calls = getPendingCalls(state, elevator.id);
  if (calls.length === 0) return;

  // pick the oldest unserved call
  calls.sort((a, b) => a.timestamp - b.timestamp);
  const target = calls[0];

  car.stops.add(target.floor);

  if (target.floor > Math.round(car.pos)) {
    car.dir = 'up';
  } else if (target.floor < Math.round(car.pos)) {
    car.dir = 'down';
  }

  car.state = 'moving';
}

// ── doors ──────────────────────────────────────────────────────

function tickDoors(car, elevator, state, dt) {
  car.doorTimer = (car.doorTimer || 0) + dt;

  if (car.doorOpen < 1) {
    // opening phase
    car.doorOpen = Math.min(1, car.doorOpen + dt / DOOR_OPEN_DURATION);

    if (car.doorOpen >= 1) {
      // fully open — board and alight
      alightPassengers(car, state);
      boardPassengers(car, elevator, state);
      car.doorTimer = 0;
      // wait while doors open, then close
      car.doorOpen = 1;
    }
  } else {
    // doors fully open — wait, then start closing
    if (car.doorTimer >= 0.8) {
      // start closing
      car.doorOpen = Math.max(0, car.doorOpen - dt / DOOR_CLOSE_DURATION);
      if (car.doorOpen <= 0) {
        car.doorOpen = 0;
        car.state = 'moving';
        car.doorTimer = 0;
      }
    } else {
      car.doorTimer += dt;
    }
  }
}

// ── moving ─────────────────────────────────────────────────────

function tickMoving(car, elevator, state, dt) {
  if (car.dir === 'idle') {
    car.state = 'idle';
    return;
  }

  // check if car is at a stop
  const curFloor = Math.round(car.pos);

  // check for alighting or call at this floor
  const hasAlighting = car.passengers && car.passengers.some(p => p.destFloor === curFloor);
  const hasCall = state._callButtons && hasPendingCallAtFloor(state, elevator.id, curFloor, car.dir);
  const isStop = hasAlighting || hasCall || car.stops.has(curFloor);

  // also check if we're already at the floor (within tolerance)
  const atFloor = Math.abs(car.pos - curFloor) < 0.05;

  if (atFloor && isStop) {
    car.pos = curFloor;
    car.stops.delete(curFloor);
    clearCallAtFloor(state, elevator.id, curFloor, car.dir);
    car.state = 'doors';
    car.doorOpen = 0;
    car.doorTimer = 0;
    return;
  }

  // move
  const speed = 1.0 / FLOOR_TRAVEL_TIME; // floors per second
  const move = speed * dt;

  if (car.dir === 'up') {
    car.pos += move;
    if (car.pos >= elevator.floorMax) {
      car.pos = elevator.floorMax;
      reverseDirection(car, state, elevator);
    }
  } else if (car.dir === 'down') {
    car.pos -= move;
    if (car.pos <= elevator.floorMin) {
      car.pos = elevator.floorMin;
      reverseDirection(car, state, elevator);
    }
  }

  // scan ahead — add stops for passengers on board
  addPassengerStops(car);

  // scan ahead — add stops for pending calls in current direction
  addCallStops(car, elevator, state);
}

// ── boarding / alighting ───────────────────────────────────────

function alightPassengers(car, state) {
  if (!car.passengers) return;
  const curFloor = Math.round(car.pos);
  const remaining = [];
  for (const p of car.passengers) {
    if (p.destFloor === curFloor) {
      // passenger exits
      if (state._sims && state._sims.has(p.simId)) {
        const sim = state._sims.get(p.simId);
        sim.currentFloor = curFloor;
      }
    } else {
      remaining.push(p);
    }
  }
  car.passengers = remaining;
}

function boardPassengers(car, elevator, state) {
  if (!state._waitingPassengers) return;
  const curFloor = Math.round(car.pos);
  const queue = state._waitingPassengers.filter(w => {
    return w.floor === curFloor && w.shaftId === elevator.id && w.waiting;
  });

  // sort by waiting time (oldest first)
  queue.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  for (const w of queue) {
    if (car.passengers.length >= CAR_CAPACITY) break;

    // check if express shaft restriction applies
    if (elevator.kind === 'express') {
      if (!isExpressStop(car, elevator, w.destFloor)) continue;
    }

    car.passengers.push({ simId: w.simId, destFloor: w.destFloor });
    car.stops.add(w.destFloor);
    w.waiting = false;
  }
}

// ── direction reversal ─────────────────────────────────────────

function reverseDirection(car, state, elevator) {
  // look for unserved calls in the opposite direction
  const calls = getPendingCalls(state, elevator.id);
  const curFloor = Math.round(car.pos);

  const oppositeDir = car.dir === 'up' ? 'down' : 'up';
  const hasOppositeCalls = calls.some(c => {
    if (oppositeDir === 'up') return c.floor > curFloor;
    return c.floor < curFloor;
  });

  // also check passengers wanting to go in opposite direction
  const hasOppositePassengers = car.passengers && car.passengers.some(p => {
    if (oppositeDir === 'up') return p.destFloor > curFloor;
    return p.destFloor < curFloor;
  });

  if (hasOppositeCalls || hasOppositePassengers) {
    car.dir = oppositeDir;
    for (const c of calls) {
      if ((oppositeDir === 'up' && c.floor > curFloor) ||
          (oppositeDir === 'down' && c.floor < curFloor)) {
        car.stops.add(c.floor);
      }
    }
    addPassengerStops(car);
  } else {
    // check for calls/passengers back in original direction
    const origDir = car.dir;
    const hasOrigCalls = calls.some(c => {
      if (origDir === 'up') return c.floor > curFloor;
      return c.floor < curFloor;
    });
    const hasOrigPassengers = car.passengers && car.passengers.some(p => {
      if (origDir === 'up') return p.destFloor > curFloor;
      return p.destFloor < curFloor;
    });

    if (hasOrigCalls || hasOrigPassengers) {
      // keep going, don't reverse
    } else {
      car.dir = 'idle';
      car.state = 'idle';
    }
  }
}

// ── call bookkeeping helpers ───────────────────────────────────

function getPendingCalls(state, shaftId) {
  if (!state._callButtons) return [];
  const calls = [];
  for (const [, call] of state._callButtons) {
    if (call.shaftId === shaftId && !call.served) {
      calls.push(call);
    }
  }
  return calls;
}

function hasPendingCallAtFloor(state, shaftId, floor, dir) {
  if (!state._callButtons) return false;
  const keyUp = carKey(shaftId, floor, 'up');
  const keyDown = carKey(shaftId, floor, 'down');
  const upCall = state._callButtons.get(keyUp);
  const downCall = state._callButtons.get(keyDown);
  if (upCall && !upCall.served && (dir === 'up' || dir === 'idle')) return true;
  if (downCall && !downCall.served && (dir === 'down' || dir === 'idle')) return true;
  return false;
}

function clearCallAtFloor(state, shaftId, floor, dir) {
  if (!state._callButtons) return;
  const keyUp = carKey(shaftId, floor, 'up');
  const keyDown = carKey(shaftId, floor, 'down');
  if (dir === 'up' || dir === 'idle') {
    const c = state._callButtons.get(keyUp);
    if (c && !c.served) c.served = true;
  }
  if (dir === 'down' || dir === 'idle') {
    const c = state._callButtons.get(keyDown);
    if (c && !c.served) c.served = true;
  }
  // also clear any call at this floor regardless of direction
  for (const [key, call] of state._callButtons) {
    if (call.shaftId === shaftId && call.floor === floor && !call.served) {
      call.served = true;
    }
  }
}

// ── stop planning helpers ──────────────────────────────────────

function addPassengerStops(car) {
  if (!car.passengers) return;
  for (const p of car.passengers) {
    car.stops.add(p.destFloor);
  }
}

function addCallStops(car, elevator, state) {
  const calls = getPendingCalls(state, elevator.id);
  const curFloor = Math.round(car.pos);
  for (const call of calls) {
    if (car.dir === 'up' && call.floor >= curFloor) {
      car.stops.add(call.floor);
    } else if (car.dir === 'down' && call.floor <= curFloor) {
      car.stops.add(call.floor);
    }
  }
}
