// Shadow Bell: the three levels. Each map is 20 by 11 tiles:
//   # wall (blocks sight and movement)   . open floor
//   B bush (walk in to hide; guards cannot see you inside unless very close)
//   C crate (cover: blocks sight and movement, but you can slip around it)
//   * moon shard (collect all three to wake the exit)
//   E exit (locked until every shard is collected)   P where you start
// Guards patrol the waypoint loops beside their map. Every straight leg of a
// patrol runs through open floor only, never through a wall or a crate.

export const LEVELS = [
  {
    name: 'Moonlit Gallery',
    hint: 'Slip past the patrols. Bushes hide you; crates block their sight.',
    map: [
      '####################',
      '#P....C....*.......#',
      '#..B......###......#',
      '#......#......B....#',
      '#.###..#..C....#...#',
      '#.....##......##.*.#',
      '#..B......#........#',
      '#....C....#...C....#',
      '#......B.....###...#',
      '#..*......B......E.#',
      '####################',
    ],
    guards: [
      { spawn: [17, 1], waypoints: [[17, 1], [17, 5]] },
      { spawn: [3, 6], waypoints: [[3, 6], [9, 6]] },
    ],
  },
  {
    name: 'The Courtyard',
    hint: 'Three patrols now. Run only when no guard is near: running is loud.',
    map: [
      '####################',
      '#...C......*.......#',
      '#.B....###....B....#',
      '#......#....C......#',
      '#..##.....##.......#',
      '#P....B......*.....#',
      '#.####...C....##...#',
      '#......B....#......#',
      '#..C.....##....B...#',
      '#.....*.....C....E.#',
      '####################',
    ],
    guards: [
      { spawn: [10, 1], waypoints: [[10, 1], [10, 3]] },
      { spawn: [16, 2], waypoints: [[16, 2], [16, 5]] },
      { spawn: [4, 8], waypoints: [[4, 8], [8, 8]] },
    ],
  },
  {
    name: 'The Bell Tower',
    hint: 'The last bell is behind four patrols. Patience wins this one.',
    map: [
      '####################',
      '#P..#....*...#.....#',
      '#...#..B.....#..*..#',
      '#.B....###....#....#',
      '#..C......#..C.....#',
      '###..##......##....#',
      '#....B....#........#',
      '#..##....###..B....#',
      '#......C.....#..*..#',
      '#..B.....#....#..E.#',
      '####################',
    ],
    guards: [
      { spawn: [12, 1], waypoints: [[12, 1], [12, 7]] },
      { spawn: [6, 2], waypoints: [[6, 2], [6, 4]] },
      { spawn: [16, 6], waypoints: [[16, 6], [16, 8]] },
      { spawn: [3, 6], waypoints: [[3, 6], [8, 6]] },
    ],
  },
];

// Turn a level's text map into the tiles the game walks on, plus the spots
// where the player, the shards and the exit begin. Walls and crates are
// solid; bushes, shards and the exit are floor you can stand on.
export function parseLevel(level) {
  const solid = [];
  const crates = [];
  const bushes = [];
  const shards = [];
  let playerStart = { x: 0, y: 0 };
  let exit = { x: 0, y: 0 };
  level.map.forEach((row, rowIndex) => {
    [...row].forEach((cell, colIndex) => {
      if (cell === '#') solid.push([colIndex, rowIndex]);
      if (cell === 'C') {
        solid.push([colIndex, rowIndex]);
        crates.push([colIndex, rowIndex]);
      }
      if (cell === 'B') bushes.push([colIndex, rowIndex]);
      if (cell === '*') shards.push({ col: colIndex, row: rowIndex, taken: false });
      if (cell === 'P') playerStart = { x: colIndex, y: rowIndex };
      if (cell === 'E') exit = { x: colIndex, y: rowIndex };
    });
  });
  return { solid, crates, bushes, shards, playerStart, exit };
}

export function tileCenter(col, row) {
  return { x: (col + 0.5) * 56, y: (row + 0.5) * 56 };
}
