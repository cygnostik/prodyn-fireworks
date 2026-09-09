import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { FireworkSimulation, EFFECT_IDS, clamp } from "./simulation.js";
import { createEnvironment } from "./environment.js";
import { ParticleRenderer } from "./particles.js";

const QUALITY = Object.freeze({
  low: { density: 0.52, dpr: 1.25, reflection: 640, samples: 0 },
  balanced: { density: 0.8, dpr: 1.5, reflection: 960, samples: 2 },
  high: { density: 1, dpr: 2, reflection: 1440, samples: 4 },
});
const VIEWS = Object.freeze({
  audience: {
    position: [0, 90, 455],
    target: [0, 112, -55],
    fov: 48,
    launchHalfWidth: 220,
  },
  close: {
    position: [12, 89, 342],
    target: [0, 160, -55],
    fov: 48,
    launchHalfWidth: 150,
  },
  wide: {
    position: [35, 95, 680],
    target: [0, 138, -55],
    fov: 46,
    launchHalfWidth: 310,
  },
});

/** Original WebGL2 fireworks instrument. The caller owns all scheduling/RAF. */
export class AfterlightEngine {
  constructor(
    canvas,
    {
      onEvent = () => {},
      onError = () => {},
      quality = "auto",
      reducedMotion = false,
    } = {},
  ) {
    if (!canvas || typeof canvas.getContext !== "function")
      throw new TypeError("AfterlightEngine requires a canvas.");
    this.canvas = canvas;
    this.onError = onError;
    this.disposed = false;
    this.contextLost = false;
    this.frame = 0;
    this.options = {
      quality,
      wind: 1.8,
      exposure: 1.05,
      reducedMotion: !!reducedMotion,
      reflections: true,
    };
    this.quality = this.resolveQuality(quality);
    this.profile = QUALITY[this.quality];
    this.target = new THREE.Vector3();
    this.view = "audience";
    try {
      const context = canvas.getContext("webgl2", {
        alpha: false,
        antialias: false,
        powerPreference: "high-performance",
        preserveDrawingBuffer: true,
        depth: true,
      });
      if (!context)
        throw new Error(
          "Afterlight needs WebGL 2. This browser or graphics device did not provide a WebGL 2 context.",
        );
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        context,
        alpha: false,
        antialias: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = this.options.exposure;
      this.renderer.info.autoReset = false;
      this.renderer.setClearColor(0x020408, 1);
      this.renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
        const message = [
          "Afterlight shader compilation failed.",
          gl.getProgramInfoLog(program),
          gl.getShaderInfoLog(vertex),
          gl.getShaderInfoLog(fragment),
        ]
          .filter(Boolean)
          .join("\n");
        this.contextLost = true;
        this.onError(new Error(message));
      };
      this.scene = new THREE.Scene();
      this.scene.name = "Afterlight / original procedural lakeside";
      this.camera = new THREE.PerspectiveCamera(48, 16 / 9, 1, 3600);
      this.simulation = new FireworkSimulation({
        onEvent,
        density: this.profile.density,
        reducedMotion: this.options.reducedMotion,
      });
      this.environment = createEnvironment(this.scene, {
        reflectionSize: this.profile.reflection,
      });
      this.particles = new ParticleRenderer(this.scene, this.simulation);
      const target = new THREE.WebGLRenderTarget(16, 16, {
        type: THREE.HalfFloatType,
        samples: this.profile.samples,
        depthBuffer: true,
      });
      this.composer = new EffectComposer(this.renderer, target);
      this.renderPass = new RenderPass(this.scene, this.camera);
      this.bloom = new UnrealBloomPass(
        new THREE.Vector2(640, 360),
        0.31,
        0,
        1.02,
      );
      this.output = new OutputPass();
      this.composer.addPass(this.renderPass);
      this.composer.addPass(this.bloom);
      this.composer.addPass(this.output);
      this.setView("audience");
      this._lost = (event) => {
        event.preventDefault();
        this.contextLost = true;
        this.onError(
          new Error(
            "The WebGL graphics context was lost. Reload the renderer to continue.",
          ),
        );
      };
      this._restored = () => {
        if (!this.disposed) {
          this.contextLost = false;
          this.resize(this.width, this.height, this.requestedDpr);
        }
      };
      canvas.addEventListener("webglcontextlost", this._lost);
      canvas.addEventListener("webglcontextrestored", this._restored);
      this.resize(
        canvas.clientWidth || 1280,
        canvas.clientHeight || 720,
        globalThis.devicePixelRatio || 1,
      );
    } catch (error) {
      this.onError(error);
      this.dispose();
      throw error;
    }
  }
  resolveQuality(quality) {
    if (quality === "medium") return "balanced";
    if (QUALITY[quality]) return quality;
    // Conservative fixed auto profile, not an unstable frame-rate feedback loop.
    const mobile =
      typeof navigator !== "undefined" &&
      ((navigator.deviceMemory && navigator.deviceMemory <= 4) ||
        (navigator.maxTouchPoints > 1 &&
          (globalThis.innerWidth || 1280) < 850));
    return mobile ? "low" : "balanced";
  }
  launch(options = {}) {
    if (this.disposed || this.contextLost)
      return {
        ok: false,
        reason: this.disposed ? "disposed" : "context-lost",
        effectId: options.effectId,
      };
    return this.simulation.launch(options);
  }
  update(dtSeconds) {
    if (!this.disposed && !this.contextLost) this.simulation.update(dtSeconds);
  }
  render() {
    if (this.disposed || this.contextLost) return false;
    this.environment.update(this.simulation.time, this.options.reducedMotion);
    this.particles.sync();
    this.renderer.info.reset();
    this.composer.render(0);
    this.frame++;
    return !this.contextLost;
  }
  resize(widthCss, heightCss, dpr = 1) {
    if (this.disposed || !this.renderer) return;
    if (
      !Number.isFinite(widthCss) ||
      !Number.isFinite(heightCss) ||
      widthCss <= 0 ||
      heightCss <= 0
    )
      return;
    this.width = Math.max(1, Math.round(widthCss));
    this.height = Math.max(1, Math.round(heightCss));
    this.requestedDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
    this.dpr = Math.min(this.requestedDpr, this.profile.dpr);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.composer.setPixelRatio(this.dpr);
    this.composer.setSize(this.width, this.height);
    // Fixed-pixel blur kernels become sky-sized on a small canvas. Keep only
    // localized bloom there; the broad default mip weights create a tan veil.
    const bloomScale = Math.min(1, (this.height * this.dpr) / 650);
    this.bloom.compositeMaterial.uniforms.bloomFactors.value = [
      1,
      0.6 * bloomScale,
      0.28 * bloomScale ** 2,
      0.07 * bloomScale ** 3,
      0.015 * bloomScale ** 4,
    ];
    this.environment.resize(
      this.profile.reflection,
      Math.max(64, Math.round(this.profile.reflection / this.camera.aspect)),
    );
    this.particles.resize(this.height, this.dpr, this.camera.fov);
  }
  setOptions(options = {}) {
    if (this.disposed) return;
    if (options.quality !== undefined) {
      this.options.quality = options.quality;
      this.quality = this.resolveQuality(options.quality);
      this.profile = QUALITY[this.quality];
      this.simulation.density = this.profile.density;
      // Allocated pools stay stable; render target sample changes reallocate only on quality changes.
      for (const target of [
        this.composer.renderTarget1,
        this.composer.renderTarget2,
      ]) {
        if (target.samples !== this.profile.samples) {
          target.samples = this.profile.samples;
          target.dispose();
        }
      }
      if (this.width) this.resize(this.width, this.height, this.requestedDpr);
    }
    if (Number.isFinite(options.wind)) {
      this.options.wind = clamp(options.wind, -12, 12);
      this.simulation.wind = this.options.wind;
    }
    if (Number.isFinite(options.exposure)) {
      this.options.exposure = clamp(options.exposure, 0.35, 2.3);
      this.renderer.toneMappingExposure = this.options.exposure;
    }
    if (options.reducedMotion !== undefined) {
      this.options.reducedMotion = !!options.reducedMotion;
      this.simulation.reducedMotion = !!options.reducedMotion;
    }
    if (options.reflections !== undefined) {
      this.options.reflections = !!options.reflections;
      this.environment.reflections(this.options.reflections);
    }
  }
  setView(view) {
    if (this.disposed || !VIEWS[view]) return false;
    this.view = view;
    const preset = VIEWS[view];
    this.simulation.launchHalfWidth = preset.launchHalfWidth;
    this.camera.position.fromArray(preset.position);
    this.target.fromArray(preset.target);
    this.camera.fov = preset.fov;
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    if (this.particles && this.height)
      this.particles.resize(this.height, this.dpr, this.camera.fov);
    return true;
  }
  /** Optional drag orbit: dx/dy are CSS-pixel gesture deltas, not radians. */
  orbit(dx, dy) {
    if (this.disposed || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const offset = this.camera.position.clone().sub(this.target),
      spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta = clamp(spherical.theta - dx * 0.002, -0.52, 0.52);
    spherical.phi = clamp(spherical.phi + dy * 0.0015, 1.32, 1.76);
    this.camera.position
      .copy(this.target)
      .add(new THREE.Vector3().setFromSpherical(spherical));
    this.camera.position.y = Math.max(12, this.camera.position.y);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }
  reset() {
    if (this.disposed) return;
    this.simulation.reset();
    this.frame = 0;
    this.environment.update(0, this.options.reducedMotion);
    this.particles.sync();
  }
  getCameraPosition() {
    return this.camera ? this.camera.position.toArray() : [0, 0, 0];
  }
  getStats() {
    const s = this.simulation,
      info = this.renderer?.info;
    return {
      time: s?.time || 0,
      activeParticles: (s?.stars.count || 0) + (s?.sparks.count || 0),
      activeStars: s?.stars.count || 0,
      activeShells: s?.shells.length || 0,
      activeEmitters: s?.emitters.length || 0,
      activePending: s?.pending.length || 0,
      activeSmoke: s?.smoke.count || 0,
      drawCalls: info?.render.calls || 0,
      quality: this.quality,
      view: this.view,
      launchHalfWidth: s?.launchHalfWidth || 0,
      launchDepth: s?.launchDepth ?? -125,
      lastLaunch: s?.lastLaunch
        ? {
            ...s.lastLaunch,
            colors: s.lastLaunch.colors.map((c) => [...c]),
            trailColor: s.lastLaunch.trailColor
              ? [...s.lastLaunch.trailColor]
              : null,
          }
        : null,
      backend: "webgl2",
      frame: this.frame,
      width: this.width || 0,
      height: this.height || 0,
      pixelRatio: this.dpr || 1,
      triangles: info?.render.triangles || 0,
      renderedSegments: this.particles?.renderedSegments || 0,
      geometries: info?.memory.geometries || 0,
      textures: info?.memory.textures || 0,
      launched: s?.metrics.launched || 0,
      bursts: s?.metrics.bursts || 0,
      droppedParticles: s?.metrics.droppedParticles || 0,
      reflections: this.options.reflections,
      reducedMotion: this.options.reducedMotion,
      contextLost: this.contextLost,
      disposed: this.disposed,
      threeRevision: THREE.REVISION,
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this._lost)
      this.canvas.removeEventListener("webglcontextlost", this._lost);
    if (this._restored)
      this.canvas.removeEventListener("webglcontextrestored", this._restored);
    this.simulation?.reset();
    this.particles?.dispose();
    this.environment?.dispose();
    this.bloom?.dispose();
    this.output?.dispose();
    this.composer?.dispose();
    this.renderer?.dispose();
  }
}
export { EFFECT_IDS };
