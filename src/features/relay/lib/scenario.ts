import type { Hold, HoldKind } from '../../../shared/types';
import type { RelayScenario } from './types';

// [id, x, y, kind, angle]
const layout: Array<[string, number, number, HoldKind, number]> = [
  // —— 甲的起势（左下）——
  ['a1', 96, 478, 'step', -8], ['a2', 214, 472, 'step', 10],
  ['a3', 104, 408, 'jug', 12], ['a4', 218, 402, 'edge', -14],
  // —— 甲的上行梯（手脚点交替，保证三肢持包攀爬可连续）——
  ['a8', 128, 352, 'step', -6], ['a9', 246, 346, 'step', 8],
  ['a5', 96, 300, 'jug', -10], ['a6', 214, 292, 'edge', 6], ['a7', 300, 286, 'jug', 10],
  ['af2', 170, 262, 'step', -4], ['af3', 286, 258, 'step', 6],
  ['h1', 296, 246, 'jug', -8],
  // —— 交接区岩点（两边互不重叠，把位悬空在两人之间）——
  ['h2', 372, 240, 'edge', 4],
  ['h3', 424, 246, 'jug', -6],
  ['h4', 318, 300, 'step', 8], ['h5', 438, 300, 'step', -8],
  // —— 乙的上行梯（镜像）——
  ['b7', 420, 286, 'edge', -10], ['b6', 506, 292, 'jug', -6], ['b5', 624, 300, 'jug', 10],
  ['bf3', 434, 258, 'step', -6], ['bf2', 550, 262, 'step', 4],
  ['b8', 592, 352, 'step', 6], ['b9', 474, 346, 'step', -8],
  // —— 乙的起势（右下）——
  ['b4', 502, 402, 'edge', 14], ['b3', 616, 408, 'jug', -12],
  ['b2', 506, 472, 'step', -10], ['b1', 624, 478, 'step', 8],
  // —— 交接后通往终点挂点的右上路梯 ——
  ['f1', 560, 216, 'step', 8], ['u1', 520, 196, 'edge', -8],
  ['f3', 632, 180, 'step', 6], ['u2', 590, 172, 'jug', 6],
  ['f2', 588, 132, 'step', -6], ['u3', 628, 128, 'slope', 16],
  ['u4', 556, 88, 'edge', -6], ['u5', 612, 64, 'jug', 4],
];

const holds: Hold[] = layout.map(([id, x, y, kind, angle]) => ({ id, x, y, kind, angle }));

export const relayScenario: RelayScenario = {
  wall: { width: 720, height: 555 },
  tilt: 12,
  startEnergy: 100,
  holds,
  hooks: [
    { id: 'hk-start', name: '起包挂点', x: 66, y: 414, finish: false },
    { id: 'hk-mid', name: '途中挂点', x: 150, y: 330, finish: false },
    { id: 'hk-finish', name: '终点挂点', x: 610, y: 44, finish: true },
  ],
  handoff: { y: 232, fromX: 300, toX: 444, step: 24 },
  starts: {
    A: { lh: 'a3', rh: 'a4', lf: 'a1', rf: 'a2' },
    B: { lh: 'b4', rh: 'b3', lf: 'b2', rf: 'b1' },
  },
  initialBagHook: 'hk-start',
};
