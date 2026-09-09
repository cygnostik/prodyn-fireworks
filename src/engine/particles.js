import * as THREE from "three";
import { NOISE } from "./environment.js";
import { clamp, EFFECT_IDS } from "./simulation.js";
const SMILEY_EFFECT = EFFECT_IDS.indexOf("smiley");

function attribute(geometry, name, array, itemSize) {
  const a = new THREE.BufferAttribute(array, itemSize).setUsage(
    THREE.DynamicDrawUsage,
  );
  geometry.setAttribute(name, a);
  return a;
}
function upload(geometry, count) {
  geometry.setDrawRange(0, count);
  for (const a of Object.values(geometry.attributes)) {
    a.clearUpdateRanges();
    a.addUpdateRange(0, count * a.itemSize);
    a.needsUpdate = true;
  }
}

export class ParticleRenderer {
  constructor(scene, simulation) {
    this.simulation = simulation;
    this.scene = scene;
    const capacity =
      simulation.stars.capacity + simulation.sparks.capacity + 80;
    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);
    this.energies = new Float32Array(capacity);
    this.coreWhitening = new Float32Array(capacity);
    const g = new THREE.BufferGeometry();
    attribute(g, "position", this.positions, 3);
    attribute(g, "color", this.colors, 3);
    attribute(g, "aSize", this.sizes, 1);
    attribute(g, "aEnergy", this.energies, 1);
    attribute(g, "aCoreWhitening", this.coreWhitening, 1);
    g.setDrawRange(0, 0);
    this.points = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        name: "AfterlightHotStarCores",
        uniforms: {
          uProjectionScale: { value: 800 },
          uPixelRatio: { value: 1 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        vertexShader: /* glsl */ `
      attribute vec3 color;attribute float aSize,aEnergy,aCoreWhitening;uniform float uProjectionScale,uPixelRatio;varying vec3 vColor;varying float vEnergy,vCoreWhitening;
      void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*uProjectionScale/max(1.,-mv.z)*5.8,1.45*uPixelRatio,46.*uPixelRatio);vColor=color;vEnergy=aEnergy;vCoreWhitening=aCoreWhitening;}
      `,
        fragmentShader: /* glsl */ `
      varying vec3 vColor;varying float vEnergy,vCoreWhitening;
      void main(){vec2 uv=gl_PointCoord*2.-1.;float r2=dot(uv,uv);if(r2>1.)discard;
        float halo=exp(-r2*5.8)*.10,ember=exp(-r2*16.)*1.45,core=exp(-r2*42.)*3.3;
        vec3 hot=mix(vColor,vec3(1.,.96,.86),vCoreWhitening);vec3 radiance=(vColor*(halo+ember)+hot*core)*vEnergy;
        gl_FragColor=vec4(radiance,1.);
      }`,
      }),
    );
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    scene.add(this.points);
    const maxLines =
      simulation.sparks.capacity + simulation.stars.capacity + 2500;
    this.linePositions = new Float32Array(maxLines * 6);
    this.lineColors = new Float32Array(maxLines * 6);
    const lg = new THREE.BufferGeometry();
    attribute(lg, "position", this.linePositions, 3);
    attribute(lg, "color", this.lineColors, 3);
    lg.setDrawRange(0, 0);
    this.lines = new THREE.LineSegments(
      lg,
      new THREE.ShaderMaterial({
        name: "AfterlightPersistentFilaments",
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        vertexShader: /* glsl */ `attribute vec3 color;varying vec3 vColor;void main(){vColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: /* glsl */ `varying vec3 vColor;void main(){gl_FragColor=vec4(vColor,1.);}`,
      }),
    );
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 3;
    scene.add(this.lines);
    this.lightPositions = Array.from({ length: 8 }, () => new THREE.Vector4());
    this.lightColors = Array.from({ length: 8 }, () => new THREE.Vector3());
    this.lightWeights = new Float32Array(8);
    const sg = new THREE.InstancedBufferGeometry();
    sg.setIndex([0, 1, 2, 0, 2, 3]);
    sg.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
        3,
      ),
    );
    this.smokePositions = new Float32Array(simulation.smoke.capacity * 3);
    this.smokeData = new Float32Array(simulation.smoke.capacity * 4);
    sg.setAttribute(
      "iPosition",
      new THREE.InstancedBufferAttribute(this.smokePositions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    sg.setAttribute(
      "iData",
      new THREE.InstancedBufferAttribute(this.smokeData, 4).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    sg.instanceCount = 0;
    this.smoke = new THREE.Mesh(
      sg,
      new THREE.ShaderMaterial({
        name: "AfterlightIlluminatedSmoke",
        uniforms: {
          uTime: { value: 0 },
          uLightPosition: { value: this.lightPositions },
          uLightColor: { value: this.lightColors },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
        vertexShader: /* glsl */ `
      attribute vec3 iPosition;attribute vec4 iData;varying vec2 vUv;varying vec3 vWorld;varying vec3 vData;
      void main(){vec4 mv=viewMatrix*vec4(iPosition,1.);mv.xy+=position.xy*iData.x;gl_Position=projectionMatrix*mv;vUv=position.xy;vWorld=iPosition;vData=iData.yzw;}
      `,
        fragmentShader: /* glsl */ `
      uniform float uTime;uniform vec4 uLightPosition[8];uniform vec3 uLightColor[8];varying vec2 vUv;varying vec3 vWorld;varying vec3 vData;
      ${NOISE}
      void main(){float edge=1.-dot(vUv,vUv);if(edge<=0.)discard;
        float rot=vData.z+vData.y*.035;vec2 p=mat2(cos(rot),-sin(rot),sin(rot),cos(rot))*vUv;
        float n=fbm(p*2.9+vec2(vData.z,vData.y*.022));float wisps=fbm(p*6.7+n*2.+vData.z);
        float alpha=pow(edge,1.5)*smoothstep(.17,.72,n*.77+wisps*.23)*vData.x;
        vec3 illumination=vec3(.010,.015,.022);
        for(int i=0;i<8;i++){vec3 delta=vWorld-uLightPosition[i].xyz;float falloff=1./(1.+dot(delta,delta)*.0018);illumination+=uLightColor[i]*uLightPosition[i].w*falloff*.075;}
        illumination*=.7+n*.5;
        gl_FragColor=vec4(illumination,alpha);
      }`,
      }),
    );
    this.smoke.frustumCulled = false;
    this.smoke.renderOrder = 2;
    scene.add(this.smoke);
  }
  resize(height, dpr, fov) {
    this.points.material.uniforms.uProjectionScale.value =
      (height * dpr) / (2 * Math.tan((fov * Math.PI) / 360));
    this.points.material.uniforms.uPixelRatio.value = dpr;
  }
  point(index, x, y, z, r, g, b, size, energy, coreWhitening = 0.72) {
    const j = index * 3;
    this.positions[j] = x;
    this.positions[j + 1] = y;
    this.positions[j + 2] = z;
    this.colors[j] = r;
    this.colors[j + 1] = g;
    this.colors[j + 2] = b;
    this.sizes[index] = size;
    this.energies[index] = energy;
    this.coreWhitening[index] = coreWhitening;
  }
  line(index, x, y, z, px, py, pz, r, g, b, energy) {
    const j = index * 6;
    this.linePositions[j] = px;
    this.linePositions[j + 1] = py;
    this.linePositions[j + 2] = pz;
    this.linePositions[j + 3] = x;
    this.linePositions[j + 4] = y;
    this.linePositions[j + 5] = z;
    this.lineColors[j] = r * energy * 0.81;
    this.lineColors[j + 1] = g * energy * 0.81;
    this.lineColors[j + 2] = b * energy * 0.81;
    this.lineColors[j + 3] = r * energy;
    this.lineColors[j + 4] = g * energy;
    this.lineColors[j + 5] = b * energy;
  }
  light(x, y, z, r, g, b, energy) {
    const bin = clamp(Math.floor((x + 320) / 80), 0, 7),
      w = Math.max(0.001, energy);
    this.lightPositions[bin].x += x * w;
    this.lightPositions[bin].y += y * w;
    this.lightPositions[bin].z += z * w;
    this.lightColors[bin].x += r * w;
    this.lightColors[bin].y += g * w;
    this.lightColors[bin].z += b * w;
    this.lightWeights[bin] += w;
  }
  sync() {
    const s = this.simulation,
      p = s.stars;
    let points = 0,
      lines = 0;
    this.lightWeights.fill(0);
    for (let i = 0; i < 8; i++) {
      this.lightPositions[i].set(0, 0, 0, 0);
      this.lightColors[i].set(0, 0, 0);
    }
    for (let i = 0; i < p.count; i++) {
      const age = p.age[i],
        t = age / p.life[i],
        seed = p.seed[i],
        mode = p.mode[i],
        face = p.effect[i] === SMILEY_EFFECT;
      let r = p.r[i],
        g = p.g[i],
        b = p.b[i],
        energy =
          (0.82 + 0.18 * Math.sin(seed + age * 13)) *
          Math.pow(1 - t, 0.44) *
          p.brightness[i];
      energy *=
        Math.min(1, age * 30 + 0.3) * clamp((p.life[i] - age) * 2, 0, 1);
      if (mode === 11)
        energy =
          (0.96 + 0.04 * Math.sin(seed + age * 8)) *
          p.brightness[i] *
          Math.min(1, age * 5) *
          clamp(p.life[i] - age, 0, 1);
      if (mode === 1) {
        const blink = Math.sin(age * (s.reducedMotion ? 4 : 11) + seed);
        energy *= blink > 0.52 ? 1.8 : 0.018;
      }
      // Glitter scintillates in the residue, not by strobing the burning head.
      if (mode === 3) {
        const band = p.phase[i],
          hidden = age > 0.62 + band * 0.38 && age < 1.45 + band * 1.35;
        energy *= hidden ? 0.006 : 1;
        if (age > 1.2) {
          r = p.r2[i];
          g = p.g2[i];
          b = p.b2[i];
        }
      }
      if (mode === 10) {
        const f = clamp((age - p.splitAt[i]) / 0.2, 0, 1);
        r += (p.r2[i] - r) * f;
        g += (p.g2[i] - g) * f;
        b += (p.b2[i] - b) * f;
      }
      const colouredTip =
        p.fixedTrailColor[i] &&
        Math.max(
          Math.abs(r - p.trailR[i]),
          Math.abs(g - p.trailG[i]),
          Math.abs(b - p.trailB[i]),
        ) > 0.12;
      // Metallic stars cool toward copper; saturated composition colors stay legible.
      if (r > 0.8 && g > 0.32 && g < 0.83 && b < 0.35) {
        g *= 1 - t * 0.42;
        b *= 1 - t * 0.73;
      }
      this.point(
        points++,
        p.x[i],
        p.y[i],
        p.z[i],
        r,
        g,
        b,
        p.size[i] * (p.trail[i] === 0 ? 1.16 : 1) * (face ? 1.12 : 1),
        // Slightly broader, lower-radiance face cores retain their hues through
        // filmic output, instead of clipping yellow/blue/red toward white.
        energy *
          (p.trail[i] === 0 ? 1.15 : 1) *
          (face ? (p.layer[i] === 0 ? 0.3 : 0.45) : colouredTip ? 0.6 : 1),
        face || colouredTip ? 0 : 0.72,
      );
      this.light(p.x[i], p.y[i], p.z[i], r, g, b, energy);
      if (p.trail[i] > 0)
        this.line(
          lines++,
          p.x[i],
          p.y[i],
          p.z[i],
          p.lastX[i],
          p.lastY[i],
          p.lastZ[i],
          p.fixedTrailColor[i] ? p.trailR[i] : r,
          p.fixedTrailColor[i] ? p.trailG[i] : g,
          p.fixedTrailColor[i] ? p.trailB[i] : b,
          energy * 0.55 * Math.min(1.5, p.trail[i]),
        );
    }
    const q = s.sparks;
    for (let i = 0; i < q.count; i++) {
      const t = q.age[i] / q.life[i],
        fade = Math.pow(1 - t, 1.25),
        flicker =
          0.55 +
          0.45 *
            Math.pow(
              Math.max(0, Math.sin(q.seed[i] * 11.1 + q.age[i] * 71)),
              8,
            );
      let energy = fade * q.brightness[i],
        r = q.r[i],
        g = q.g[i],
        b = q.b[i];
      if (r > 0.8 && g > 0.32 && b < 0.35) {
        g *= 1 - t * 0.58;
        b *= 1 - t * 0.9;
      }
      const twinkle =
        q.glitter[i] > 0.5
          ? 0.3 +
            2.7 * Math.pow(Math.max(0, Math.sin(q.seed[i] + q.age[i] * 35)), 18)
          : flicker;
      this.point(
        points++,
        q.x[i],
        q.y[i],
        q.z[i],
        r,
        g,
        b,
        q.size[i],
        energy * twinkle * 0.67,
      );
      this.line(
        lines++,
        q.x[i],
        q.y[i],
        q.z[i],
        q.px[i],
        q.py[i],
        q.pz[i],
        r,
        g,
        b,
        energy * (q.glitter[i] > 0.5 ? 0.38 : 0.52),
      );
    }
    for (const shell of s.shells) {
      const trunk = shell.effectId === "comet" || shell.effectId === "palm",
        c = trunk ? shell.colors[0] : [1, 0.6, 0.19];
      this.point(
        points++,
        shell.x,
        shell.y,
        shell.z,
        ...c,
        shell.effectId === "comet" ? 1.05 : 0.65,
        1.4,
      );
      this.light(shell.x, shell.y, shell.z, ...c, 2);
    }
    for (const fixture of s.emitters)
      if (fixture.effectId === "wheel") {
        const x = fixture.x,
          y = fixture.y,
          z = fixture.z + 0.1,
          radius = 7.5 * fixture.scale;
        this.line(lines++, x, y, z, x, 1, z, 0.02, 0.026, 0.031, 1);
        this.line(lines++, x - 5, 1, z, x + 5, 1, z, 0.02, 0.026, 0.031, 1);
        for (let i = 0; i < 32; i++) {
          const a = (i / 32) * Math.PI * 2,
            b = ((i + 1) / 32) * Math.PI * 2;
          this.line(
            lines++,
            x + Math.cos(a) * radius,
            y + Math.sin(a) * radius,
            z,
            x + Math.cos(b) * radius,
            y + Math.sin(b) * radius,
            z,
            0.024,
            0.03,
            0.038,
            1,
          );
        }
        for (let i = 0; i < 3; i++) {
          const a = fixture.rotation + (i * Math.PI * 2) / 3;
          this.line(
            lines++,
            x,
            y,
            z,
            x + Math.cos(a) * radius,
            y + Math.sin(a) * radius,
            z,
            0.028,
            0.035,
            0.042,
            1,
          );
        }
      }
    for (const flash of s.flashes) {
      const f = Math.max(0, 1 - flash.age / 0.13);
      if (f > 0)
        this.point(
          points++,
          flash.x,
          flash.y,
          flash.z,
          ...flash.color,
          5 * flash.power,
          f * f * (s.reducedMotion ? 0.45 : 1.2),
        );
      this.light(
        flash.x,
        flash.y,
        flash.z,
        ...flash.color,
        Math.exp(-flash.age * 7) * flash.power * 90,
      );
    }
    upload(this.points.geometry, points);
    upload(this.lines.geometry, lines * 2);
    for (let i = 0; i < 8; i++) {
      const w = this.lightWeights[i];
      if (w > 0) {
        this.lightPositions[i].divideScalar(w);
        this.lightPositions[i].w = Math.min(3.5, Math.sqrt(w) * 0.17);
        this.lightColors[i].divideScalar(w);
      }
    }
    const m = s.smoke;
    for (let i = 0; i < m.count; i++) {
      const j = i * 3,
        k = i * 4,
        t = m.age[i] / m.life[i];
      this.smokePositions[j] = m.x[i];
      this.smokePositions[j + 1] = m.y[i];
      this.smokePositions[j + 2] = m.z[i];
      this.smokeData[k] = m.size[i] * (1 + m.age[i] * 0.12);
      this.smokeData[k + 1] =
        m.opacity[i] * Math.min(1, m.age[i] * 2 + 0.18) * Math.pow(1 - t, 1.6);
      this.smokeData[k + 2] = m.age[i];
      this.smokeData[k + 3] = m.seed[i];
    }
    this.smoke.geometry.instanceCount = m.count;
    for (const name of ["iPosition", "iData"]) {
      const a = this.smoke.geometry.attributes[name];
      a.clearUpdateRanges();
      a.addUpdateRange(0, m.count * a.itemSize);
      a.needsUpdate = true;
    }
    this.smoke.material.uniforms.uTime.value = s.time;
    this.renderedPoints = points;
    this.renderedSegments = lines;
  }
  dispose() {
    for (const o of [this.points, this.lines, this.smoke]) {
      this.scene.remove(o);
      o.geometry.dispose();
      o.material.dispose();
    }
  }
}
