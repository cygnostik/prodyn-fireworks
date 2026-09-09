// Authored luminous colours: traditional metallic trails and varied coloured tips.
export const PALETTES = Object.freeze({
  gold: [
    [1, 0.57, 0.12],
    [1, 0.73, 0.3],
    [1, 0.41, 0.055],
  ],
  silver: [
    [0.8, 0.9, 1],
    [1, 0.96, 0.83],
    [0.67, 0.78, 1],
  ],
  ruby: [
    [1, 0.035, 0.055],
    [1, 0.085, 0.14],
    [1, 0.17, 0.075],
  ],
  jade: [
    [0.09, 1, 0.29],
    [0.35, 1, 0.46],
    [0.045, 0.7, 0.19],
  ],
  azure: [
    [0.07, 0.29, 1],
    [0.18, 0.47, 1],
    [0.31, 0.65, 1],
  ],
  violet: [
    [0.51, 0.1, 1],
    [0.81, 0.22, 1],
    [0.4, 0.25, 1],
  ],
  multicolor: [
    [1, 0.04, 0.08],
    [0.06, 0.68, 1],
    [0.24, 1, 0.22],
    [1, 0.53, 0.075],
    [0.71, 0.15, 1],
  ],
  ember: [
    [1, 0.12, 0.025],
    [1, 0.3, 0.05],
    [1, 0.49, 0.075],
  ],
  patriot: [
    [1, 0.045, 0.07],
    [0.9, 0.94, 1],
    [0.09, 0.28, 1],
  ],
  guatemala: [
    [0.08, 0.32, 0.67],
    [1, 1, 1],
  ],
});
export const SMILEY_COLOURS = Object.freeze({
  ring: [1, 0.85, 0.015],
  eyes: [0.015, 0.16, 1],
  mouth: [1, 0.015, 0.035],
});
const C = {
  gold: PALETTES.gold[0],
  amber: PALETTES.gold[2],
  champagne: [1, 0.8, 0.49],
  paleGold: [1, 0.9, 0.67],
  white: PALETTES.silver[0],
  red: PALETTES.ruby[0],
  green: PALETTES.jade[0],
  blue: PALETTES.azure[0],
  violet: PALETTES.violet[0],
  pink: [1, 0.12, 0.34],
};
const look = (color, trailColor, coreColors, color2) => ({
  colors: Array.isArray(color[0]) ? color : [color],
  trailColor,
  coreColors,
  color2,
});
const flowers = [
  look(C.red),
  look(C.green),
  look(C.violet),
  look(C.blue),
  look(PALETTES.multicolor),
];
const crowns = [
  look(C.gold, C.gold),
  look(C.champagne, C.champagne),
  look(C.red, C.gold),
];
const nested = [
  look(C.red, C.gold, [C.white, C.blue, C.green]),
  look(C.blue, C.white, [C.gold, C.red, C.green]),
  look(C.green, C.gold, [C.violet, C.white, C.red]),
];
const silverGold = [
  look(C.gold, C.gold),
  look(C.white, C.white),
  look(C.amber, C.amber),
];
const signatures = Object.freeze({
  peony: flowers,
  chrysanthemum: [
    look(C.gold, C.gold),
    look(C.white, C.white),
    look(C.red, C.gold),
    look(C.green, C.gold),
    look(C.blue, C.white),
  ],
  dahlia: [
    look(C.violet),
    look(C.red),
    look(C.green),
    look(C.blue),
    look(C.white),
  ],
  diadem: [
    look(C.gold, C.gold, [C.red], C.red),
    look(C.white, C.white, [C.blue], C.blue),
    look(C.champagne, C.gold, [C.green], C.green),
  ],
  pistil: nested,
  "double-pistil": nested,
  "multi-pistil": nested,
  willow: crowns,
  brocade: crowns,
  kamuro: [
    look(C.amber, C.amber),
    look(C.gold, C.gold),
    look(C.champagne, C.gold),
  ],
  nishiki: [
    look(C.champagne, C.champagne),
    look(C.paleGold, C.paleGold),
    look(C.green, C.champagne),
  ],
  palm: [look(C.gold, C.gold), look(C.red, C.gold), look(C.green, C.white)],
  spider: [look(C.white, C.white), look(C.gold, C.gold), look(C.red, C.gold)],
  horsetail: [
    look(C.gold, C.gold),
    look(C.white, C.white),
    look(C.red, C.gold),
  ],
  ring: [look(C.blue), look(C.red), look(C.green)],
  saturn: [
    look(C.violet, undefined, [C.gold]),
    look(C.blue, undefined, [C.red]),
    look(C.gold, undefined, [C.violet]),
  ],
  heart: [look(C.red), look(C.pink)],
  star: [look(C.white), look(C.gold), look(C.blue)],
  spiral: [
    look(C.blue, C.white),
    look(C.violet, C.gold),
    look(C.green, C.white),
  ],
  smiley: [
    look([SMILEY_COLOURS.ring, SMILEY_COLOURS.eyes, SMILEY_COLOURS.mouth]),
  ],
  strobe: [look(C.white), look(C.red), look(C.green)],
  glitter: silverGold,
  crackle: [look(C.gold, C.gold), look(C.white, C.white), look(C.red, C.gold)],
  ghost: [
    look(C.gold, undefined, undefined, C.blue),
    look(C.red, undefined, undefined, C.green),
    look(C.white, undefined, undefined, C.violet),
  ],
  "color-change": [
    look(C.red, undefined, undefined, C.blue),
    look(C.green, undefined, undefined, C.violet),
    look(C.gold, undefined, undefined, C.red),
  ],
  salute: [look(C.white)],
  crossette: [
    look(C.red, C.gold),
    look(C.green, C.gold),
    look(C.white, C.white),
  ],
  "falling-leaves": [look(C.green), look(C.red), look(C.white)],
  bees: silverGold,
  fish: [look(C.blue, C.white), look(C.red, C.gold), look(C.green, C.gold)],
  tourbillon: silverGold,
  "shell-of-shells": [
    look(PALETTES.multicolor, C.gold),
    look([C.red, C.white, C.blue], C.white),
    look([C.green, C.violet, C.gold], C.gold),
  ],
  comet: [look(C.gold, C.gold), look(C.red, C.gold), look(C.green, C.white)],
  mine: flowers,
  fan: [
    look(PALETTES.multicolor, C.gold),
    look([C.red, C.white, C.blue], C.white),
    look([C.green, C.violet, C.gold], C.gold),
  ],
  fountain: silverGold,
  waterfall: [
    look(C.white, C.white),
    look(C.gold, C.gold),
    look(C.champagne, C.champagne),
  ],
  "roman-candle": [
    look(PALETTES.multicolor),
    look([C.red, C.green, C.white]),
    look([C.blue, C.violet, C.gold]),
  ],
  wheel: silverGold,
  "set-piece": [look(C.white), look(C.gold), look(C.red)],
});
export function resolveLook(effectId, palette = "signature", variation = 0) {
  // This pictorial shell has a fixed, readable face, not a palette tint.
  if (effectId === "smiley") return signatures.smiley[0];
  if (palette !== "signature") {
    const colors = Object.hasOwn(PALETTES, palette)
      ? PALETTES[palette]
      : PALETTES.gold;
    return {
      colors,
      coreColors: [
        colors[1 % colors.length],
        colors[2 % colors.length],
        colors[3 % colors.length],
      ],
      color2: colors[1 % colors.length],
    };
  }
  const options = signatures[effectId] || silverGold;
  const index = Number.isInteger(variation)
    ? Math.abs(variation) % options.length
    : 0;
  return options[index];
}
