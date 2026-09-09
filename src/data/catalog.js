// Original geometric pictograms: these show the effect, not a generic category badge.
const f = (n) => Number(n.toFixed(2));
const line = (x, y, a, b, extra = "") =>
  `<path d="M${f(x)} ${f(y)}L${f(a)} ${f(b)}" ${extra}/>`;
const dot = (x, y, r = 1.05) =>
  `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="currentColor" stroke="none"/>`;
const rays = (n, r1, r2, offset = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + offset;
    return line(
      24 + Math.cos(a) * r1,
      23 + Math.sin(a) * r1,
      24 + Math.cos(a) * r2,
      23 + Math.sin(a) * r2,
    );
  }).join("");
const points = (n, r, offset = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + offset;
    return dot(24 + Math.cos(a) * r, 23 + Math.sin(a) * r);
  }).join("");
const droop = (n = 11, length = 18, thick = false) =>
  Array.from({ length: n }, (_, i) => {
    const x = 6 + (i * 36) / (n - 1);
    return `<path d="M24 10 Q${f(x)} ${i % 2 ? 3 : 7} ${f(x)} ${length + 14 - Math.abs(x - 24) * 0.22}" ${thick ? 'stroke-width="1.8"' : ""}/>`;
  }).join("");
const flare = (n = 9, ground = false) =>
  Array.from({ length: n }, (_, i) => {
    const x = 5 + (i * 38) / (n - 1),
      y = 8 + Math.abs(x - 24) * 0.75;
    return `<path d="M24 42 Q${f((x + 24) * 0.5)} ${ground ? 19 : 34} ${f(x)} ${f(y)}"/>${dot(x, y, 0.9)}`;
  }).join("");

export function pictogram(id, className = "") {
  let p = "";
  switch (id) {
    case "peony":
      p = points(14, 16) + points(9, 10, 0.2) + points(5, 5);
      break;
    case "chrysanthemum":
      p = rays(22, 3, 18) + points(22, 18);
      break;
    case "dahlia":
      p =
        points(8, 16) +
        Array.from({ length: 8 }, (_, i) => {
          let a = (i * Math.PI) / 4;
          return dot(24 + Math.cos(a) * 16, 23 + Math.sin(a) * 16, 2.1);
        }).join("") +
        points(4, 7);
      break;
    case "diadem":
      p = rays(13, 4, 16) + points(13, 18) + points(7, 8);
      break;
    case "pistil":
      p = points(18, 18) + rays(9, 2, 8);
      break;
    case "double-pistil":
      p = points(20, 19) + points(13, 12) + points(7, 5);
      break;
    case "multi-pistil":
      p = points(24, 21) + points(18, 15) + points(12, 9) + points(6, 3);
      break;
    case "willow":
      p = droop(13, 23);
      break;
    case "brocade":
      p = droop(17, 15) + points(13, 12);
      break;
    case "kamuro":
      p = droop(9, 26) + line(24, 10, 24, 43);
      break;
    case "nishiki":
      p =
        droop(17, 22) +
        [9, 15, 21, 27, 33, 39]
          .map((x) => dot(x, 34 + Math.sin(x) * 4, 0.8))
          .join("");
      break;
    case "palm":
      p = droop(6, 12, true) + line(24, 13, 24, 43);
      break;
    case "spider":
      p = rays(9, 3, 20) + points(9, 20);
      break;
    case "horsetail":
      p = Array.from(
        { length: 8 },
        (_, i) =>
          `<path d="M18 11Q${29 + i} ${2 + i} ${25 + i * 2} ${32 + i}"/>`,
      ).join("");
      break;
    case "ring":
      p = points(20, 17);
      break;
    case "saturn":
      p =
        '<ellipse cx="24" cy="23" rx="22" ry="8" transform="rotate(-25 24 23)"/>' +
        points(12, 10);
      break;
    case "heart":
      p =
        '<path d="M24 39C15 32 3 21 9 12C14 5 23 11 24 16C28 5 39 7 41 15C44 24 31 35 24 39Z" stroke-dasharray="1 4" stroke-width="2.4"/>';
      break;
    case "star":
      p =
        '<path d="M24 4L29 17L44 18L32 27L36 42L24 33L12 42L16 27L4 18L19 17Z" stroke-dasharray="1 3" stroke-width="2"/>';
      break;
    case "spiral":
      p =
        '<path d="M24 23C29 15 32 25 28 29C21 36 11 27 14 18C18 6 37 9 39 24C42 43 15 47 6 28" stroke-dasharray="1 3" stroke-width="2"/>';
      break;
    case "smiley":
      p =
        points(22, 19) +
        '<circle cx="17" cy="18" r="2.1"/><circle cx="31" cy="18" r="2.1"/>' +
        '<path d="M14 28Q24 40 34 28"/>';
      break;
    case "strobe":
      p = [
        [-12, -8],
        [0, -13],
        [12, -5],
        [-9, 9],
        [7, 12],
        [2, 0],
      ]
        .map(
          ([x, y]) =>
            line(22 + x, 23 + y, 26 + x, 23 + y) +
            line(24 + x, 21 + y, 24 + x, 25 + y),
        )
        .join("");
      break;
    case "glitter":
      p = rays(12, 4, 15, "") + points(12, 18) + points(8, 12, 0.25);
      break;
    case "crackle":
      p = Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2,
          x = 24 + Math.cos(a) * 13,
          y = 23 + Math.sin(a) * 13;
        return (
          line(x - 3, y, x + 3, y) + line(x, y - 3, x, y + 3) + dot(x, y, 1.4)
        );
      }).join("");
      break;
    case "ghost":
      p =
        points(9, 17) +
        '<path d="M10 31A18 18 0 0 0 39 15" stroke-dasharray="1 4" opacity=".4"/>' +
        points(6, 7);
      break;
    case "color-change":
      p = rays(12, 3, 9) + rays(12, 13, 19) + points(12, 20);
      break;
    case "salute":
      p = rays(8, 6, 16) + rays(8, 18, 22) + dot(24, 23, 4);
      break;
    case "crossette":
      p = [
        [-11, -11],
        [11, -11],
        [-11, 11],
        [11, 11],
      ]
        .map(
          ([x, y]) =>
            line(24, 23, 24 + x * 0.7, 23 + y * 0.7) +
            line(20 + x, 23 + y, 28 + x, 23 + y) +
            line(24 + x, 19 + y, 24 + x, 27 + y),
        )
        .join("");
      break;
    case "falling-leaves":
      p = [8, 16, 24, 32, 40]
        .map(
          (x, i) =>
            `<path d="M${x} ${9 + (i % 3) * 3}q-4 6 0 11t0 12" stroke-dasharray="1 3"/>`,
        )
        .join("");
      break;
    case "bees":
      p = [
        [-12, -8],
        [10, -12],
        [-9, 12],
        [12, 8],
      ]
        .map(
          ([x, y]) =>
            `<path d="M${24 + x} ${23 + y}q8 -7 3 -11t-5 2"/>` +
            dot(24 + x, 23 + y, 1.5),
        )
        .join("");
      break;
    case "fish":
      p = [0, 1, 2, 3, 4]
        .map((i) => `<path d="M${7 + i * 8} 37q-9 -8 0 -14t0 -13"/>`)
        .join("");
      break;
    case "tourbillon":
      p =
        rays(8, 9, 19, 0.3) +
        '<path d="M15 19a10 10 0 1 1 6 13M15 19l-1 -7m1 7l7 -2"/>';
      break;
    case "shell-of-shells":
      p =
        [
          [-13, -9],
          [12, -9],
          [0, 14],
        ]
          .map(([x, y]) =>
            Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2;
              return line(
                24 + x + Math.cos(a) * 2,
                23 + y + Math.sin(a) * 2,
                24 + x + Math.cos(a) * 8,
                23 + y + Math.sin(a) * 8,
              );
            }).join(""),
          )
          .join("") + rays(3, 2, 9, -Math.PI / 2);
      break;
    case "comet":
      p =
        '<path d="M12 42Q14 20 31 7M16 41Q18 23 29 12M10 35Q14 21 26 14"/>' +
        dot(32, 6, 2);
      break;
    case "mine":
      p = flare(14, true) + line(8, 44, 40, 44);
      break;
    case "fan":
      p = flare(5) + line(8, 44, 40, 44);
      break;
    case "fountain":
      p = flare(13, true) + '<path d="M20 44L24 35L28 44"/>';
      break;
    case "waterfall":
      p =
        line(5, 8, 43, 8) +
        [7, 12, 17, 22, 27, 32, 37, 42]
          .map((x, i) => line(x, 8, x - 3, 34 + (i % 3) * 4))
          .join("");
      break;
    case "roman-candle":
      p =
        '<path d="M21 44V33H27V44M24 30V26"/>' +
        dot(24, 21, 2) +
        dot(24, 12, 2) +
        dot(24, 4, 2);
      break;
    case "wheel":
      p =
        '<circle cx="24" cy="23" r="9"/><path d="M24 32V44M24 14Q42 6 44 20M33 23Q40 40 25 44M24 32Q5 42 4 27M15 23Q5 6 22 3"/>' +
        dot(24, 23, 2);
      break;
    case "set-piece":
      p =
        '<path d="M24 5L29 17L42 18L32 27L35 40L24 33L13 40L16 27L6 18L19 17Z" stroke-dasharray="1 3" stroke-width="2"/><path d="M13 44H35M24 34V44"/>';
      break;
    default:
      p = rays(12, 4, 18);
  }
  return `<svg class="${className}" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}

export const GROUPS = [
  { id: "blooms", name: "Blooms", icon: "chrysanthemum" },
  { id: "canopies", name: "Canopies", icon: "willow" },
  { id: "shapes", name: "Figures", icon: "saturn" },
  { id: "textures", name: "Textures", icon: "crackle" },
  { id: "alive", name: "Living", icon: "crossette" },
  { id: "ground", name: "Ground", icon: "fan" },
];

const rows = [
  [
    "peony",
    "Peony",
    "blooms",
    "Clean, coloured stars. A perfect sphere without a trailing tail.",
    "ruby",
  ],
  [
    "chrysanthemum",
    "Chrysanthemum",
    "blooms",
    "A full sphere of fine, sparkling radial trails.",
    "gold",
  ],
  [
    "dahlia",
    "Dahlia",
    "blooms",
    "Fewer, brighter stars; a broad, open flower.",
    "violet",
  ],
  [
    "diadem",
    "Diadem",
    "blooms",
    "A compact, bright core sits within an open outer flower.",
    "silver",
  ],
  [
    "pistil",
    "Pistil",
    "blooms",
    "A smaller central bloom nested inside a larger shell.",
    "multicolor",
  ],
  [
    "double-pistil",
    "Double pistil",
    "blooms",
    "Three nested spheres opening around a shared centre.",
    "multicolor",
  ],
  [
    "multi-pistil",
    "Multi pistil",
    "blooms",
    "An outer flower and three inner cores open as four concentric spheres.",
    "multicolor",
  ],
  [
    "willow",
    "Willow",
    "canopies",
    "Long-burning gold trails turn downward into a wide curtain.",
    "gold",
  ],
  [
    "brocade",
    "Brocade",
    "canopies",
    "A dense, glittering gold canopy with a woven texture.",
    "gold",
  ],
  [
    "kamuro",
    "Kamuro",
    "canopies",
    "A hanging crown of long, fine golden trails.",
    "gold",
  ],
  [
    "nishiki",
    "Nishiki",
    "canopies",
    "A full, sparkling golden canopy that lingers.",
    "gold",
  ],
  [
    "palm",
    "Palm",
    "canopies",
    "A few thick branches spread above a rising trunk.",
    "gold",
  ],
  [
    "spider",
    "Spider",
    "canopies",
    "Fast, straight arms spread wide, then slow and fall.",
    "ember",
  ],
  [
    "horsetail",
    "Horsetail",
    "canopies",
    "A soft, compact plume turns over into a close fall of parallel tails.",
    "gold",
  ],
  [
    "ring",
    "Ring",
    "shapes",
    "A single expanding circle of stars in a plane.",
    "azure",
  ],
  [
    "saturn",
    "Saturn",
    "shapes",
    "A bright central sphere encircled by a tilted ring.",
    "violet",
  ],
  [
    "heart",
    "Heart",
    "shapes",
    "An expanding heart drawn in individual stars.",
    "ruby",
  ],
  [
    "star",
    "Star pattern",
    "shapes",
    "A five-pointed figure picked out in light. An authored pattern interpretation.",
    "silver",
  ],
  [
    "spiral",
    "Spiral",
    "shapes",
    "Stars trace an expanding spiral. An authored pattern variation.",
    "azure",
  ],
  [
    "smiley",
    "Smiley",
    "shapes",
    "A circle, two eyes and a curved smile, best seen head-on.",
    "gold",
  ],
  [
    "strobe",
    "Strobe",
    "textures",
    "Individual stars blink independently across the burst.",
    "silver",
  ],
  [
    "glitter",
    "Glitter",
    "textures",
    "A fine succession of delayed sparkles along the trails.",
    "gold",
  ],
  [
    "crackle",
    "Crackle",
    "textures",
    "A burst ends in small branching flashes and sharp snaps.",
    "gold",
  ],
  [
    "ghost",
    "Ghost",
    "textures",
    "A wave of colour moves across sectors of an expanding shell.",
    "violet",
  ],
  [
    "color-change",
    "Colour change",
    "textures",
    "Stars change colour during the same flight.",
    "multicolor",
  ],
  [
    "salute",
    "Salute",
    "textures",
    "A short white flash and a strong report, with few stars.",
    "silver",
  ],
  [
    "crossette",
    "Crossette",
    "alive",
    "Each travelling star splits into four smaller arms.",
    "ruby",
  ],
  [
    "falling-leaves",
    "Falling leaves",
    "alive",
    "Soft points drift downward without a hard expanding break.",
    "jade",
  ],
  [
    "bees",
    "Bees",
    "alive",
    "Tiny self-propelled lights dart away from the centre.",
    "gold",
  ],
  [
    "fish",
    "Fish",
    "alive",
    "Short-lived stars swim through small curling paths.",
    "azure",
  ],
  [
    "tourbillon",
    "Tourbillon",
    "alive",
    "Spinning, spark-shedding elements swirl through the air.",
    "silver",
  ],
  [
    "shell-of-shells",
    "Shell of shells",
    "alive",
    "A parent shell releases a constellation of smaller breaks.",
    "multicolor",
  ],
  [
    "comet",
    "Comet",
    "ground",
    "One rising star draws a thick tail; no aerial burst.",
    "gold",
  ],
  [
    "mine",
    "Mine",
    "ground",
    "A sudden fan of stars lifts directly from the ground.",
    "ruby",
  ],
  [
    "fan",
    "Fan",
    "ground",
    "A coordinated spread of angled comets across the sky.",
    "multicolor",
  ],
  [
    "fountain",
    "Fountain",
    "ground",
    "A sustained low spray of sparks and a gentle hiss.",
    "gold",
  ],
  [
    "waterfall",
    "Waterfall curtain",
    "ground",
    "A suspended line sheds a curtain of falling sparks.",
    "silver",
  ],
  [
    "roman-candle",
    "Roman candle",
    "ground",
    "A timed succession of rising stars from one position.",
    "multicolor",
  ],
  [
    "wheel",
    "Wheel",
    "ground",
    "A fixed ground wheel rotates, casting curved streams of sparks.",
    "gold",
  ],
  [
    "set-piece",
    "Set piece",
    "ground",
    "A fixed outline lights up in small, steady points.",
    "silver",
  ],
];
export const EFFECTS = rows.map(([id, name, group, description, palette]) => ({
  id,
  name,
  group,
  description,
  palette,
  icon: pictogram(id),
}));
export const EFFECT_BY_ID = Object.fromEntries(EFFECTS.map((e) => [e.id, e]));
export const PALETTES = [
  { id: "signature", name: "Signature", color: "var(--pd-ivory)" },
  { id: "gold", name: "Gold", color: "#ffcb6b" },
  { id: "silver", name: "Silver", color: "#eaf7ff" },
  { id: "ruby", name: "Ruby", color: "#ff4060" },
  { id: "jade", name: "Jade", color: "#48f6a3" },
  { id: "azure", name: "Azure", color: "#438dff" },
  { id: "violet", name: "Violet", color: "#c183ff" },
  {
    id: "multicolor",
    name: "Spectrum",
    color: "conic-gradient(#ff4060,#ffcb6b,#48f6a3,#438dff,#c183ff,#ff4060)",
  },
  { id: "ember", name: "Ember", color: "#ff8948" },
  {
    id: "patriot",
    name: "Red / white / blue",
    color: "linear-gradient(90deg,#ff4060 33%,#eaf7ff 33% 66%,#438dff 66%)",
  },
  {
    id: "guatemala",
    name: "Guatemala",
    color: "linear-gradient(90deg,#4997d0 33%,#ffffff 33% 66%,#4997d0 66%)",
  },
];
