// Shadow Bell: boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast
// one), and the renderer paints what is there. The game moves between six
// screens: title, play, paused, level clear, game over and win.
//
// ?seed=N fixes the shuffle. ?shot=start|play|alert|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld, updateWorld, nextLevel, loadLevel,
  EVENT_PICKUP, EVENT_SPOTTED, EVENT_CAUGHT, EVENT_LEVEL_CLEAR,
  EVENT_WIN, EVENT_GAME_OVER,
} from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_MUTE, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED,
  SCREEN_LEVEL_CLEAR, SCREEN_GAME_OVER, SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

let screen = SCREEN_TITLE;
let best = readBest();
let muted = false;
let time = 0;
let lastStepCount = 0;

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit.
  }
}

function announce(text) {
  status.textContent = text;
}

function handleEvents() {
  for (const event of world.events) {
    if (event === EVENT_PICKUP) audio.pickup();
    if (event === EVENT_SPOTTED) {
      audio.spotted();
      announce('Spotted! Break line of sight!');
    }
    if (event === EVENT_CAUGHT) {
      audio.caught();
      announce('Caught! A life lost.');
    }
  }
  world.events.length = 0;
}

function finishRun(won) {
  if (world.score > best) {
    best = world.score;
    saveBest(best);
  }
  screen = won ? SCREEN_WIN : SCREEN_GAME_OVER;
  if (won) audio.win();
  else audio.gameOver();
}

const input = createInput(canvas, {
  onAction(action) {
    audio.unlock();
    if (action === ACTION_MUTE) {
      muted = audio.toggleMute();
      return;
    }
    if (action === ACTION_PAUSE && (screen === SCREEN_PLAY || screen === SCREEN_PAUSED)) {
      screen = screen === SCREEN_PLAY ? SCREEN_PAUSED : SCREEN_PLAY;
      return;
    }
    if (action !== ACTION_CONFIRM) return;
    if (screen === SCREEN_TITLE) {
      loadLevel(world, 0);
      world.score = 0;
      world.lives = 3;
      world.totalTime = 0;
      screen = SCREEN_PLAY;
      announce('Sneak! Collect the three bells, then reach the exit.');
    } else if (screen === SCREEN_LEVEL_CLEAR) {
      nextLevel(world);
      screen = SCREEN_PLAY;
    } else if (screen === SCREEN_GAME_OVER || screen === SCREEN_WIN) {
      loadLevel(world, 0);
      world.score = 0;
      world.lives = 3;
      world.totalTime = 0;
      screen = SCREEN_PLAY;
    } else if (screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
    }
  },
  onClick(x, y) {
    audio.unlock();
    if (screen === SCREEN_TITLE) {
      loadLevel(world, 0);
      world.score = 0;
      world.lives = 3;
      world.totalTime = 0;
      screen = SCREEN_PLAY;
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    world.clickTarget = { x, y };
  },
});

function runShot(name) {
  const staged = stageShot(name, world);
  screen = staged.screen;
  best = staged.best;
  let painted = 0;
  function paint() {
    time += STEP;
    renderer.draw(world, { screen, best, muted }, time);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    const elapsed = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    time += elapsed;
    if (screen === SCREEN_PLAY) {
      accumulator += elapsed;
      while (accumulator >= STEP) {
        accumulator -= STEP;
        const result = updateWorld(world, input, STEP);
        handleEvents();
        if (result === 'level-clear') {
          if (world.score > best) {
            best = world.score;
            saveBest(best);
          }
          audio.levelClear();
          screen = SCREEN_LEVEL_CLEAR;
          announce('Level clear! Press Enter for the next gallery.');
          break;
        }
        if (result === 'win') {
          finishRun(true);
          break;
        }
        if (result === 'game-over') {
          finishRun(false);
          break;
        }
      }
      // Footsteps: a soft tick each time the stride clock passes a beat.
      const steps = Math.floor(world.player.stepClock);
      if (world.player.moving && steps !== lastStepCount) {
        lastStepCount = steps;
        audio.footstep(world.player.running);
      }
    }
    renderer.draw(world, { screen, best, muted }, time);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
