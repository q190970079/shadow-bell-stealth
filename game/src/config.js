// Shadow Bell: shared numbers for the whole game. One place, so tuning the
// feel (speeds, sight, suspicion) never means hunting through other files.
export const TILE = 56;
export const COLS = 20;
export const ROWS = 11;
export const HUD_H = 64;
export const PLAY_W = COLS * TILE; // 1120
export const PLAY_H = ROWS * TILE; // 616
export const VIEW_W = PLAY_W; // 1120
export const VIEW_H = HUD_H + PLAY_H; // 680
export const STEP = 1 / 60;

export const PLAYER_RADIUS = 14;
export const PLAYER_WALK_SPEED = 150;
export const PLAYER_RUN_SPEED = 250;
export const RUN_NOISE_RADIUS = 130;

export const GUARD_RADIUS = 15;
export const GUARD_PATROL_SPEED = 62;
export const GUARD_CHASE_SPEED = 132;
export const GUARD_SIGHT_RANGE = 205;
export const GUARD_HALF_ANGLE = 0.61; // ~35 degrees each side
export const GUARD_HEAR_RADIUS = 130;
export const GUARD_CATCH_RADIUS = 22;
export const GUARD_CLOSE_SPOT_RADIUS = 42; // sees a hidden player this close

export const SUSPECT_RISE_CLOSE = 1.15; // seconds of staring, up close
export const SUSPECT_RISE_FAR = 1.9; // seconds of staring, at full range
export const SUSPECT_DECAY = 34; // points per second while unseen
export const ALERT_CHASE_SECONDS = 4.5;
export const LOSE_SIGHT_SECONDS = 3;
export const RESPAWN_GRACE_SECONDS = 2;

export const BEST_KEY = 'shadow-bell-best';
export const SHARD_SCORE = 100;
export const LEVEL_BONUS = 250;
