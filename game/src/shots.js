// Shadow Bell: staged scenes for screenshots. ?shot=start|play|alert|end
// (with &seed=N) paints one fixed scene instead of running the game, so a
// screenshot always shows the same moment. Nothing here runs in normal play.
import { SCREEN_TITLE, SCREEN_LEVEL_CLEAR, SCREEN_WIN } from './render.js';
import { loadLevel } from './world.js';
import { tileCenter } from './levels.js';

function placePlayer(world, col, row) {
  const spot = tileCenter(col, row);
  world.player.x = spot.x;
  world.player.y = spot.y;
  world.player.angle = 0;
}

function placeGuard(world, index, col, row, angle) {
  const guard = world.guards[index];
  if (!guard) return;
  const spot = tileCenter(col, row);
  guard.x = spot.x;
  guard.y = spot.y;
  guard.angle = angle;
  guard.pauseLeft = 99;
}

export function stageShot(name, world) {
  if (name === 'start') {
    loadLevel(world, 0);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    // Mid-sneak on level two: you crouch in a bush while a patrol sweeps
    // past with its cone, two bells still to grab, exit still asleep.
    loadLevel(world, 1);
    placePlayer(world, 2, 2);
    world.player.hidden = true;
    placeGuard(world, 0, 10, 2, Math.PI / 2);
    world.guards[0].suspicion = 48;
    placeGuard(world, 1, 16, 4, Math.PI);
    placeGuard(world, 2, 6, 8, -Math.PI / 2);
    world.shards[0].taken = true;
    world.score = 100;
    return { screen: 'play', best: 100 };
  }
  if (name === 'alert') {
    // Caught in the open on level one: the guard is sure, the cone is red,
    // and the meter is one blink from the chase.
    loadLevel(world, 0);
    placePlayer(world, 15, 3);
    world.player.angle = Math.PI;
    placeGuard(world, 0, 17, 3, Math.PI);
    world.guards[0].suspicion = 92;
    placeGuard(world, 1, 5, 6, 0);
    return { screen: 'play', best: 0 };
  }
  if (name === 'end') {
    // The gallery cleared: every bell taken, the exit awake, score banked.
    loadLevel(world, 0);
    for (const shard of world.shards) shard.taken = true;
    world.exitOpen = true;
    world.score = 650;
    placePlayer(world, 15, 9);
    placeGuard(world, 0, 17, 5, -Math.PI / 2);
    return { screen: SCREEN_LEVEL_CLEAR, best: 650 };
  }
  if (name === 'win') {
    loadLevel(world, 2);
    for (const shard of world.shards) shard.taken = true;
    world.exitOpen = true;
    world.score = 1950;
    return { screen: SCREEN_WIN, best: 1950 };
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
