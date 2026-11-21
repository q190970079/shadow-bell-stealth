// Shadow Bell: the world. It owns the player, the guards, the shards and
// the rules that make sneaking matter: sight, sound, suspicion and the chase.
// The renderer only paints what is here; nothing in here draws anything.
import {
  TILE, COLS, ROWS, PLAYER_RADIUS, PLAYER_WALK_SPEED,
  PLAYER_RUN_SPEED, RUN_NOISE_RADIUS, GUARD_RADIUS, GUARD_PATROL_SPEED,
  GUARD_CHASE_SPEED, GUARD_SIGHT_RANGE, GUARD_HALF_ANGLE,
  GUARD_HEAR_RADIUS, GUARD_CATCH_RADIUS, GUARD_CLOSE_SPOT_RADIUS,
  SUSPECT_RISE_CLOSE, SUSPECT_RISE_FAR, SUSPECT_DECAY,
  ALERT_CHASE_SECONDS, LOSE_SIGHT_SECONDS, RESPAWN_GRACE_SECONDS,
  SHARD_SCORE, LEVEL_BONUS,
} from './config.js';
import { LEVELS, parseLevel, tileCenter } from './levels.js';

export const EVENT_PICKUP = 'pickup';
export const EVENT_SPOTTED = 'spotted';
export const EVENT_CAUGHT = 'caught';
export const EVENT_LEVEL_CLEAR = 'level-clear';
export const EVENT_WIN = 'win';
export const EVENT_GAME_OVER = 'game-over';

function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

// A guard walks its waypoint loop, pausing a beat at each corner, facing
// where it walks. Suspicion is its own: 0 is calm, 100 is the chase.
function createGuard(def) {
  const start = tileCenter(def.spawn[0], def.spawn[1]);
  return {
    x: start.x,
    y: start.y,
    angle: 0,
    waypointIndex: 1 % def.waypoints.length,
    waypoints: def.waypoints.map(([col, row]) => tileCenter(col, row)),
    pauseLeft: 0,
    suspicion: 0,
    alerted: false,
    chaseLeft: 0,
    unseenLeft: 0,
    heardX: null,
    heardY: null,
  };
}

export function createWorld(random) {
  const world = {
    random,
    levelIndex: 0,
    score: 0,
    lives: 3,
    timeLeft: 0,
    levelTime: 0,
    totalTime: 0,
    events: [],
    player: null,
    guards: [],
    shards: [],
    exit: null,
    exitOpen: false,
    solidSet: new Set(),
    bushSet: new Set(),
    playerStart: { x: 0, y: 0 },
    levelName: '',
    levelHint: '',
    graceLeft: 0,
    clickTarget: null,
  };
  loadLevel(world, 0);
  return world;
}

export function loadLevel(world, index) {
  const level = LEVELS[index];
  const parsed = parseLevel(level);
  world.levelIndex = index;
  world.levelName = level.name;
  world.levelHint = level.hint;
  world.solidSet = new Set(parsed.solid.map(([c, r]) => `${c},${r}`));
  world.crateSet = new Set(parsed.crates.map(([c, r]) => `${c},${r}`));
  world.bushSet = new Set(parsed.bushes.map(([c, r]) => `${c},${r}`));
  world.shards = parsed.shards.map((shard) => ({ ...shard }));
  world.exit = { ...parsed.exit };
  world.exitOpen = false;
  world.playerStart = { ...parsed.playerStart };
  const start = tileCenter(parsed.playerStart.x, parsed.playerStart.y);
  world.player = {
    x: start.x, y: start.y, angle: -Math.PI / 2,
    moving: false, running: false, hidden: false, stepClock: 0,
  };
  world.guards = level.guards.map(createGuard);
  world.levelTime = 0;
  world.graceLeft = RESPAWN_GRACE_SECONDS;
  world.clickTarget = null;
  world.events.length = 0;
}

export function tileAt(world, col, row) {
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return true;
  return world.solidSet.has(`${col},${row}`);
}

export function solidAtPixel(world, x, y) {
  return tileAt(world, Math.floor(x / TILE), Math.floor(y / TILE));
}

function isBushAtPixel(world, x, y) {
  return world.bushSet.has(`${Math.floor(x / TILE)},${Math.floor(y / TILE)}`);
}

// Sight is a straight line sampled every few pixels: a wall or a crate
// anywhere along it breaks the guard's view.
export function hasLineOfSight(world, ax, ay, bx, by) {
  const dist = distance(ax, ay, bx, by);
  const steps = Math.max(1, Math.ceil(dist / 7));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (solidAtPixel(world, ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
  }
  return true;
}

function angleDifference(a, b) {
  let diff = a - b;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

// Can this guard see the player right now? Inside a bush you are hidden
// unless the guard is almost on top of you; otherwise you need to be in
// the cone, in range, and in a clear line of sight.
export function guardSeesPlayer(world, guard) {
  const player = world.player;
  const dist = distance(guard.x, guard.y, player.x, player.y);
  if (player.hidden && dist > GUARD_CLOSE_SPOT_RADIUS) return false;
  if (dist > GUARD_SIGHT_RANGE) return false;
  const toPlayer = Math.atan2(player.y - guard.y, player.x - guard.x);
  if (Math.abs(angleDifference(toPlayer, guard.angle)) > GUARD_HALF_ANGLE) return false;
  return hasLineOfSight(world, guard.x, guard.y, player.x, player.y);
}

function moveWithCollision(world, body, dx, dy, radius) {
  const tryX = body.x + dx;
  if (!circleHitsSolid(world, tryX, body.y, radius)) body.x = tryX;
  const tryY = body.y + dy;
  if (!circleHitsSolid(world, body.x, tryY, radius)) body.y = tryY;
}

function circleHitsSolid(world, x, y, radius) {
  const left = Math.floor((x - radius) / TILE);
  const right = Math.floor((x + radius) / TILE);
  const top = Math.floor((y - radius) / TILE);
  const bottom = Math.floor((y + radius) / TILE);
  for (let col = left; col <= right; col++) {
    for (let row = top; row <= bottom; row++) {
      if (!tileAt(world, col, row)) continue;
      const nearestX = clamp(x, col * TILE, (col + 1) * TILE);
      const nearestY = clamp(y, row * TILE, (row + 1) * TILE);
      if ((x - nearestX) ** 2 + (y - nearestY) ** 2 < radius * radius) return true;
    }
  }
  return false;
}

function moveGuard(world, guard, dt, targetX, targetY, speed) {
  const dx = targetX - guard.x;
  const dy = targetY - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const step = Math.min(dist, speed * dt);
  const nx = guard.x + (dx / dist) * step;
  const ny = guard.y + (dy / dist) * step;
  if (!circleHitsSolid(world, nx, guard.y, GUARD_RADIUS)) guard.x = nx;
  if (!circleHitsSolid(world, guard.x, ny, GUARD_RADIUS)) guard.y = ny;
  guard.angle = Math.atan2(dy, dx);
  return Math.hypot(targetX - guard.x, targetY - guard.y) < 4;
}

function updateGuard(world, guard, dt) {
  const player = world.player;
  const sees = guardSeesPlayer(world, guard);

  if (sees) {
    // The closer you are, the faster the guard is sure it is you.
    const dist = distance(guard.x, guard.y, player.x, player.y);
    const riseTime = SUSPECT_RISE_CLOSE + (SUSPECT_RISE_FAR - SUSPECT_RISE_CLOSE) * (dist / GUARD_SIGHT_RANGE);
    const before = guard.suspicion;
    guard.suspicion = clamp(guard.suspicion + (100 / riseTime) * dt, 0, 100);
    guard.unseenLeft = LOSE_SIGHT_SECONDS;
    if (before < 100 && guard.suspicion >= 100) {
      guard.alerted = true;
      guard.chaseLeft = ALERT_CHASE_SECONDS;
      world.events.push(EVENT_SPOTTED);
    }
  } else {
    guard.suspicion = clamp(guard.suspicion - SUSPECT_DECAY * dt, 0, 100);
    guard.unseenLeft -= dt;
  }

  // Running is loud: a guard near the noise turns to look at it.
  if (player.running && player.moving) {
    const dist = distance(guard.x, guard.y, player.x, player.y);
    if (dist < GUARD_HEAR_RADIUS && !guard.alerted) {
      guard.heardX = player.x;
      guard.heardY = player.y;
      guard.suspicion = clamp(guard.suspicion + 26 * dt, 0, 99);
    }
  }

  if (guard.alerted) {
    guard.chaseLeft -= dt;
    moveGuard(world, guard, dt, player.x, player.y, GUARD_CHASE_SPEED);
    if (!sees && guard.unseenLeft <= 0) {
      guard.alerted = false;
      guard.suspicion = 55;
      guard.chaseLeft = 0;
    } else if (guard.chaseLeft <= 0 && !sees) {
      guard.alerted = false;
      guard.suspicion = 55;
    }
    if (distance(guard.x, guard.y, player.x, player.y) < GUARD_CATCH_RADIUS && world.graceLeft <= 0) {
      return 'caught';
    }
    return 'ok';
  }

  // A guard that heard something walks over to check, then goes back.
  if (guard.heardX !== null) {
    const arrived = moveGuard(world, guard, dt, guard.heardX, guard.heardY, GUARD_PATROL_SPEED * 1.25);
    if (arrived) {
      guard.heardX = null;
      guard.heardY = null;
      guard.pauseLeft = 0.9;
    }
    return 'ok';
  }

  if (guard.pauseLeft > 0) {
    guard.pauseLeft -= dt;
    return 'ok';
  }
  const target = guard.waypoints[guard.waypointIndex];
  const arrived = moveGuard(world, guard, dt, target.x, target.y, GUARD_PATROL_SPEED);
  if (arrived) {
    guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
    guard.pauseLeft = 0.8;
  }
  return 'ok';
}

function movePlayer(world, input, dt) {
  const player = world.player;
  let dx = 0;
  let dy = 0;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (dx !== 0 || dy !== 0) {
    const length = Math.hypot(dx, dy);
    dx /= length;
    dy /= length;
    world.clickTarget = null;
  } else if (world.clickTarget) {
    const tx = world.clickTarget.x - player.x;
    const ty = world.clickTarget.y - player.y;
    const dist = Math.hypot(tx, ty);
    if (dist < 6) {
      world.clickTarget = null;
    } else {
      dx = tx / dist;
      dy = ty / dist;
    }
  }
  player.moving = dx !== 0 || dy !== 0;
  player.running = Boolean(input.run) && player.moving;
  const speed = player.running ? PLAYER_RUN_SPEED : PLAYER_WALK_SPEED;
  if (player.moving) {
    moveWithCollision(world, player, dx * speed * dt, dy * speed * dt, PLAYER_RADIUS);
    player.angle = Math.atan2(dy, dx);
    player.stepClock += dt * (player.running ? 2.1 : 1.4);
  }
  player.hidden = isBushAtPixel(world, player.x, player.y);
}

// One fixed step of the game. Returns 'caught', 'level-clear', 'win',
// 'game-over', or 'ok'. The caller owns lives and level changes.
export function updateWorld(world, input, dt) {
  world.levelTime += dt;
  world.totalTime += dt;
  if (world.graceLeft > 0) world.graceLeft -= dt;
  movePlayer(world, input, dt);

  for (const guard of world.guards) {
    if (updateGuard(world, guard, dt) === 'caught') {
      world.lives -= 1;
      world.events.push(EVENT_CAUGHT);
      if (world.lives <= 0) {
        world.events.push(EVENT_GAME_OVER);
        return 'game-over';
      }
      const start = tileCenter(world.playerStart.x, world.playerStart.y);
      world.player.x = start.x;
      world.player.y = start.y;
      world.clickTarget = null;
      world.graceLeft = RESPAWN_GRACE_SECONDS;
      // Everyone resets: the guards walk back to their posts, calm again.
      for (const other of world.guards) {
        const home = other.waypoints[0];
        other.x = home.x;
        other.y = home.y;
        other.waypointIndex = 1 % other.waypoints.length;
        other.pauseLeft = 0;
        other.suspicion = 0;
        other.alerted = false;
        other.chaseLeft = 0;
        other.unseenLeft = 0;
        other.heardX = null;
        other.heardY = null;
      }
      return 'caught';
    }
  }

  for (const shard of world.shards) {
    if (shard.taken) continue;
    const center = tileCenter(shard.col, shard.row);
    if (distance(world.player.x, world.player.y, center.x, center.y) < 26) {
      shard.taken = true;
      world.score += SHARD_SCORE;
      world.events.push(EVENT_PICKUP);
      if (world.shards.every((item) => item.taken)) world.exitOpen = true;
    }
  }

  if (world.exitOpen) {
    const center = tileCenter(world.exit.x, world.exit.y);
    if (distance(world.player.x, world.player.y, center.x, center.y) < 26) {
      const bonus = LEVEL_BONUS + Math.max(0, Math.round(120 - world.levelTime));
      world.score += bonus;
      if (world.levelIndex + 1 >= LEVELS.length) {
        world.events.push(EVENT_WIN);
        return 'win';
      }
      world.events.push(EVENT_LEVEL_CLEAR);
      return 'level-clear';
    }
  }
  return 'ok';
}

export function nextLevel(world) {
  loadLevel(world, world.levelIndex + 1);
}

export function highestSuspicion(world) {
  return world.guards.reduce((top, guard) => Math.max(top, guard.suspicion), 0);
}

export function anyGuardAlerted(world) {
  return world.guards.some((guard) => guard.alerted);
}
