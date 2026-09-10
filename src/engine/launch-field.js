import { Matrix4 } from "three";
import { clamp, integrateParticle } from "./simulation.js";

// NDC spans -1…1: retain 10% of the viewport on either side for bloom.
// This protects centres, not every tip of a maximum-size nearby canopy.
export const LAUNCH_FIELD_HALF_NDC = 0.8;

/** Place a shell in the current frustum, without changing its trajectory. */
export function launchFieldX(camera, position, shell, airborne, wind) {
  const matrix = new Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse,
  ).elements;
  // Predict the main break using the existing analytic integrator. No random
  // draws or simulation steps: the seeded fuse, velocities and timing survive.
  const end = { ...shell, x: 0 };
  if (airborne) {
    const fuse = shell.effectId === "comet" ? 4.3 : shell.fuse;
    integrateParticle(end, Math.ceil(fuse * 120) / 120, wind * 0.2);
  } else if (shell.effectId === "waterfall") end.y = 103;

  // Invert clipX / clipW for world X at a given height/depth. Unlike a fixed
  // metre width or linear world interpolation, this also honours orbit yaw.
  const xAt = (ndc, { y, z }) => {
    const clipX = matrix[4] * y + matrix[8] * z + matrix[12];
    const clipW = matrix[7] * y + matrix[11] * z + matrix[15];
    const denominator = matrix[0] - ndc * matrix[3];
    // An extreme ultrawide orbit can point an edge ray behind this Z plane.
    if (denominator <= 0) return ndc < 0 ? -Infinity : Infinity;
    return (ndc * clipW - clipX) / denominator;
  };
  const half = LAUNCH_FIELD_HALF_NDC;
  let min = Math.max(xAt(-half, shell), xAt(-half, end) - end.x);
  let max = Math.min(xAt(half, shell), xAt(half, end) - end.x);
  if (Math.abs(matrix[3]) > 1e-10) {
    for (const [point, dx] of [
      [shell, 0],
      [end, end.x],
    ]) {
      const w = matrix[7] * point.y + matrix[11] * point.z + matrix[15];
      const a = (camera.near * 2 - w) / matrix[3] - dx;
      const b = (camera.far * 0.95 - w) / matrix[3] - dx;
      min = Math.max(min, Math.min(a, b));
      max = Math.min(max, Math.max(a, b));
    }
  }
  // Aim the eventual burst at the tapped horizontal coordinate (with inset),
  // but keep the lift origin inside the same field. Once launched, never move
  // existing particles to follow a subsequent camera change.
  return clamp(xAt(position * half, end) - end.x, min, max);
}
