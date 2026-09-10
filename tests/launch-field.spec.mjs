import { test, expect } from "@playwright/test";
import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

// Keep the fixture in source: evidence/ is ignored in clean checkouts.
const fixtureHtml = `<!doctype html>
<meta charset="utf-8">
<title>Launch-field isolated renderer evidence</title>
<style>html,body{margin:0;background:#020408}canvas{display:block;width:1600px;height:900px}</style>
<canvas id="sky"></canvas>
<script type="module">
import * as THREE from 'three';
import { AfterlightEngine } from '/src/engine/engine.js';
const events = [], errors = [];
const canvas = document.querySelector('canvas');
const engine = new AfterlightEngine(canvas, {quality:'high', onEvent:e=>events.push(e), onError:e=>errors.push(e.message)});
function reset(view, width=1600, height=900) {
  engine.reset(); events.length=0;
  canvas.style.width=width+'px'; canvas.style.height=height+'px';
  engine.setView(view); engine.resize(width,height,1);
}
const project = xyz => new THREE.Vector3(...xyz).project(engine.camera).toArray();
function launchAt(position, options={}) {
  const result = engine.launch({effectId:'chrysanthemum',seed:932,scale:1.6,position,...options});
  if(!result.ok) throw new Error(JSON.stringify(result));
  const s=engine.simulation.lastLaunch;
  return {world:[s.x,s.y,s.z],ndc:project([s.x,s.y,s.z])};
}
function step(seconds) {for(let i=0;i<Math.round(seconds*120);i++) engine.update(1/120); engine.render();}
window.field = {
  engine, errors, reset, launchAt, step,
  measure(view, position, options={}) {
    reset(view,options.width,options.height);
    if(options.orbit) engine.orbit(...options.orbit);
    // A pending cue keeps the isolated later-depth shot in an occupied sky.
    if(options.depth !== undefined) { engine.simulation.pending.push({at:10000}); engine.simulation.launchDepth=options.depth; }
    const launch=launchAt(position, options); step(4.2);
    const burst=events.find(e=>e.kind==='burst');
    if(!burst || !engine.getStats().activeStars) throw new Error('No actual burst stars');
    return {view,position,launch,burst:{world:burst.position,ndc:project(burst.position),time:burst.time},stats:engine.getStats(),errors};
  },
  scene(view,effectId='chrysanthemum',depth=-125,positions=[-1,0,1],options={}) {
    reset(view,options.width,options.height);
    if(options.orbit) engine.orbit(...options.orbit);
    engine.simulation.pending.push({at:10000});
    const launches=positions.map(position=>{engine.simulation.launchDepth=depth; return launchAt(position,{effectId});});
    step(effectId==='willow'?5:4.2);
    return {view,effectId,depth,positions,launches,bursts:events.filter(e=>e.kind==='burst').map(e=>({world:e.position,ndc:project(e.position),time:e.time})),stats:engine.getStats(),errors};
  }
};
engine.render();
</script>`;

// Independent source harness: no build or use of the parent's shared dist.
const root = resolve(import.meta.dirname, "..");
const phase = process.env.LAUNCH_FIELD_PHASE || "after";
const evidence = resolve(root, "evidence/launch-field", phase);
let server, url;
test.use({ trace: "off", screenshot: "off" });
test.beforeAll(async () => {
  await mkdir(evidence, { recursive: true });
  await writeFile(
    resolve(root, "evidence/launch-field/fixture.html"),
    fixtureHtml,
  );
  server = await createServer({
    configFile: false,
    root,
    cacheDir: resolve(tmpdir(), `afterlight-launch-field-vite-${process.pid}`),
    server: {
      host: "127.0.0.1",
      port: 0,
      watch: { ignored: ["**/evidence/**"] },
    },
  });
  await server.listen();
  url = `http://127.0.0.1:${server.httpServer.address().port}/evidence/launch-field/fixture.html`;
});
test.afterAll(async () => {
  await server?.close();
});

test("real rendered launch and burst centres cover the visible field, with large-burst evidence", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1600, height: 900 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.field);
  const measurements = [],
    scenes = [];
  for (const view of ["audience", "close", "wide"]) {
    for (const position of [-1, -0.92, -0.78, 0, 0.78, 0.92, 1]) {
      measurements.push(
        await page.evaluate(
          ({ view, position }) => window.field.measure(view, position),
          { view, position },
        ),
      );
    }
    for (const effectId of ["chrysanthemum", "willow"]) {
      const scene = await page.evaluate(
        ({ view, effectId }) => window.field.scene(view, effectId),
        { view, effectId },
      );
      scenes.push(scene);
      expect(scene.stats.bursts).toBe(3);
      expect(scene.stats.activeStars).toBeGreaterThan(400);
      expect(scene.stats.drawCalls).toBeGreaterThan(0);
      await page
        .locator("#sky")
        .screenshot({ path: resolve(evidence, `${view}-${effectId}-far.png`) });
    }
  }
  await writeFile(
    resolve(evidence, "rendered-coverage.json"),
    JSON.stringify({ measurements, scenes, errors }, null, 2) + "\n",
  );
  expect(errors).toEqual([]);
  for (const view of ["audience", "close", "wide"]) {
    for (const amplitude of [1, 0.78, 0.92]) {
      const left = measurements.find(
        (m) => m.view === view && m.position === -amplitude,
      );
      const right = measurements.find(
        (m) => m.view === view && m.position === amplitude,
      );
      for (const phase of ["launch", "burst"]) {
        const span = (right[phase].ndc[0] - left[phase].ndc[0]) / 2;
        expect
          .soft(
            span,
            `${view} ${phase} ±${amplitude}: ${(100 * span).toFixed(2)}% viewport`,
          )
          .toBeGreaterThanOrEqual(amplitude * 0.72);
        expect.soft(left[phase].ndc[0]).toBeGreaterThanOrEqual(-0.82);
        expect.soft(right[phase].ndc[0]).toBeLessThanOrEqual(0.82);
      }
    }
  }
});

test("near large canopies, narrow resize and orbit render at their requested lateral positions", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(url);
  await page.waitForFunction(() => window.field);
  const scenes = [];
  for (const view of ["audience", "close", "wide"]) {
    for (const variant of [
      { name: "near", depth: 14.9, options: {} },
      { name: "narrow", depth: -125, options: { width: 390, height: 219 } },
      {
        name: "orbit",
        depth: -50,
        options: { width: 1200, height: 675, orbit: [240, 80] },
      },
    ]) {
      const scene = await page.evaluate(
        ({ view, variant }) =>
          window.field.scene(
            view,
            "willow",
            variant.depth,
            [-0.92, 0, 0.92],
            variant.options,
          ),
        { view, variant },
      );
      scenes.push({ ...scene, variant: variant.name });
      expect(scene.stats.backend).toBe("webgl2");
      expect(scene.stats.bursts).toBe(3);
      expect(scene.stats.activeStars).toBeGreaterThan(400);
      expect(scene.stats.drawCalls).toBeGreaterThan(0);
      expect(scene.errors).toEqual([]);
      for (const p of [
        ...scene.launches.map((s) => s.ndc),
        ...scene.bursts.map((s) => s.ndc),
      ]) {
        expect(Math.abs(p[0])).toBeLessThanOrEqual(0.801);
        expect(p[2]).toBeGreaterThan(-1);
        expect(p[2]).toBeLessThan(1);
      }
      await page.locator("#sky").screenshot({
        path: resolve(evidence, `${view}-willow-${variant.name}.png`),
      });
    }
  }
  await writeFile(
    resolve(evidence, "near-resize-orbit.json"),
    JSON.stringify(scenes, null, 2) + "\n",
  );
});
