// A fixed plausible local orientation, NOT a date/ephemeris. See docs/sky.md.
export const DEG = Math.PI / 180;
export const SKY_REFERENCE = Object.freeze({
  latitudeDeg: 34,
  longitudeDeg: -118,
  // West/pre-dawn solution: ideal full Moon opposite peak solar longitude
  // 262.2°, beta=0, mean obliquity 23.4393°. Solve its setting hour angle
  // from the unchanged Moon's apparent altitude. See the derivation in docs.
  forwardAzimuthDeg: 264.57618875516647,
  localSiderealDeg: 165.74541814047015,
  radiantRaDeg: 112,
  radiantDecDeg: 33,
  speedKmSeconds: 35,
  populationIndex: 2.6,
  earthRadiusKm: 6371,
  skyRadius: 2200,
  eye: Object.freeze([0, 90, 455]),
});
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const unit = (a) => {
  const n = Math.hypot(...a);
  return a.map((v) => v / n);
};
export const angleDeg = (a, b) =>
  Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) / DEG;

export function equatorialDirection(raDeg, decDeg) {
  const latitude = SKY_REFERENCE.latitudeDeg * DEG;
  const dec = decDeg * DEG;
  const hourAngle = (SKY_REFERENCE.localSiderealDeg - raDeg) * DEG;
  const east = -Math.cos(dec) * Math.sin(hourAngle);
  const north =
    Math.cos(latitude) * Math.sin(dec) -
    Math.sin(latitude) * Math.cos(dec) * Math.cos(hourAngle);
  const up =
    Math.sin(latitude) * Math.sin(dec) +
    Math.cos(latitude) * Math.cos(dec) * Math.cos(hourAngle);
  const forward = SKY_REFERENCE.forwardAzimuthDeg * DEG;
  return [
    east * Math.cos(forward) - north * Math.sin(forward),
    up,
    -east * Math.sin(forward) - north * Math.cos(forward),
  ];
}
export const GEMINID_RADIANT = Object.freeze(
  equatorialDirection(SKY_REFERENCE.radiantRaDeg, SKY_REFERENCE.radiantDecDeg),
);
// Share the exact original shader direction; account for the noncentral eye.
export const MOON_DIRECTION = Object.freeze(unit([0.51, 0.47, -1]));
export const APPARENT_MOON_DIRECTION = Object.freeze(
  unit(
    MOON_DIRECTION.map(
      (v, i) => v * SKY_REFERENCE.skyRadius - SKY_REFERENCE.eye[i],
    ),
  ),
);

export function horizontalDirection(azimuthDeg, altitudeDeg) {
  const az = (azimuthDeg - SKY_REFERENCE.forwardAzimuthDeg) * DEG;
  const alt = altitudeDeg * DEG;
  return [
    Math.cos(alt) * Math.sin(az),
    Math.sin(alt),
    -Math.cos(alt) * Math.cos(az),
  ];
}

// Intersect a sightline with a spherical luminous atmospheric shell in km.
export function slantRangeKm(altitudeDeg, heightKm) {
  const r = SKY_REFERENCE.earthRadiusKm;
  const vertical = r * Math.sin(altitudeDeg * DEG);
  return (
    Math.sqrt(vertical * vertical + 2 * r * heightKm + heightKm * heightKm) -
    vertical
  );
}
export function heightKm(position) {
  const r = SKY_REFERENCE.earthRadiusKm;
  return Math.hypot(position[0], position[1] + r, position[2]) - r;
}

// Map an astronomical sightline onto the ORIGINAL authored sky sphere. Its
// finite radius/parallax is retained consistently with the fixed Moon.
export function toSkyPoint(direction, out) {
  const eye = SKY_REFERENCE.eye;
  const b = dot(eye, direction);
  const radius = SKY_REFERENCE.skyRadius - 2;
  const distance = -b + Math.sqrt(b * b + radius * radius - dot(eye, eye));
  for (let i = 0; i < 3; i++) out[i] = eye[i] + direction[i] * distance;
  return out;
}
