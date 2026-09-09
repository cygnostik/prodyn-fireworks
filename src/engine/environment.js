import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { seededRandom } from "./simulation.js";

export const NOISE = /* glsl */ `
float hash21(vec2 p) { p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y); }
float noise2(vec2 p) {vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p) {float v=0.,a=.5;for(int i=0;i<4;i++){v+=noise2(p)*a;p=mat2(.8,-.6,.6,.8)*p*2.07+13.1;a*=.5;}return v;}
`;

const WATER_SHADER = {
  name: "AfterlightRoughLake",
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uTime: { value: 0 },
    uReflections: { value: 1 },
    uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 512) },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix; varying vec4 vProject; varying vec3 vWorld;
    void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;vProject=textureMatrix*vec4(position,1.);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;uniform float uTime,uReflections;uniform vec2 uTexel;varying vec4 vProject;varying vec3 vWorld;
    ${NOISE}
    void main(){
      vec2 uv=vProject.xy/vProject.w;
      float d=length(cameraPosition-vWorld), nearFactor=smoothstep(200.,850.,d);
      float a=sin(vWorld.z*1.23+uTime*.75+sin(vWorld.x*.038)*2.);
      float b=sin(vWorld.z*.41-uTime*.6+vWorld.x*.055);
      float c=noise2(vec2(vWorld.x*.025+uTime*.018,vWorld.z*1.9));
      vec2 ripple=vec2((a*.65+b*.35)*.0014,(c-.5)*.0028+a*.00038)*(1.25-nearFactor*.65);
      uv+=ripple;
      vec3 reflected=texture2D(tDiffuse,uv).rgb*.30;
      reflected+=texture2D(tDiffuse,uv+vec2(uTexel.x*1.3,0.)).rgb*.19;
      reflected+=texture2D(tDiffuse,uv-vec2(uTexel.x*1.3,0.)).rgb*.19;
      reflected+=texture2D(tDiffuse,uv+vec2(uTexel.x*3.2,uTexel.y*.45)).rgb*.11;
      reflected+=texture2D(tDiffuse,uv-vec2(uTexel.x*3.2,uTexel.y*.45)).rgb*.11;
      reflected+=texture2D(tDiffuse,uv+vec2(0.,uTexel.y*1.5)).rgb*.10;
      float facets=.29+.71*smoothstep(.14,.89,c*.58+(a*.5+.5)*.42);
      float fresnel=.26+.29*pow(1.-max(0.,normalize(cameraPosition-vWorld).y),3.);
      vec3 deep=vec3(.00085,.0020,.0037);
      vec3 wave=vec3(.00050,.00090,.00130)*(a*.5+.5)*(.2+.8*c);
      gl_FragColor=vec4(deep+wave+reflected*fresnel*facets*uReflections,1.);
    }
  `,
};

export function createEnvironment(scene, { reflectionSize = 1024 } = {}) {
  const owned = [];
  const own = (mesh) => {
    scene.add(mesh);
    owned.push(mesh);
    return mesh;
  };
  const sky = own(
    new THREE.Mesh(
      new THREE.SphereGeometry(2200, 32, 16),
      new THREE.ShaderMaterial({
        name: "AfterlightNightAtmosphere",
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: /* glsl */ `
      varying vec3 vDirection;uniform float uTime;${NOISE}
      void main(){
        vec3 d=normalize(vDirection);float h=max(d.y,0.);
        vec3 col=mix(vec3(.0075,.0120,.0200),vec3(.0008,.0015,.0040),smoothstep(-.03,.5,d.y));
        float haze=fbm(d.xz*4.+vec2(0.,uTime*.0009));col+=vec3(.0010,.0015,.0022)*haze*exp(-h*6.);
        vec2 st=vec2(atan(d.z,d.x),asin(d.y))*vec2(820.,820.);
        vec2 cell=floor(st), f=fract(st);float star=hash21(cell);
        vec2 center=vec2(hash21(cell+41.),hash21(cell+83.))*.6+.2;
        float dotStar=exp(-dot(f-center,f-center)*170.);
        float twinkle=.92+.08*sin(uTime*.42+star*231.);
        col+=vec3(.22,.27,.36)*dotStar*step(.9988,star)*smoothstep(.06,.45,h)*twinkle;
        vec3 moonDir=normalize(vec3(.51,.47,-1.));float md=length(d-moonDir);
        float disk=1.-smoothstep(.0104,.0112,md);
        float crater=fbm(d.xz*740.)*.22+.78;
        col+=vec3(.45,.49,.53)*disk*crater;
        col+=vec3(.020,.025,.033)*exp(-md*70.)+vec3(.002,.003,.005)*exp(-md*12.);
        gl_FragColor=vec4(col,1.);
      }
    `,
      }),
    ),
  );
  sky.renderOrder = -100;
  const rng = seededRandom(0xaf7e211),
    ridge = (x, layer) => {
      const s = x * 0.0027 + layer * 5;
      return (
        23 +
        layer * 17 +
        Math.pow(
          Math.abs(
            Math.sin(s) * 0.52 +
              Math.sin(s * 2.17 + 0.8) * 0.27 +
              Math.sin(s * 4.87) * 0.14 +
              Math.sin(s * 12.7) * 0.055,
          ),
          1.25,
        ) *
          (80 + layer * 23)
      );
    };
  for (let layer = 2; layer >= 0; layer--) {
    const positions = [],
      colors = [],
      n = 200,
      z = -260 - layer * 230;
    for (let i = 0; i < n; i++) {
      const x0 = -2200 + (i * 4400) / n,
        x1 = -2200 + ((i + 1) * 4400) / n;
      const h0 = ridge(x0, layer),
        h1 = ridge(x1, layer);
      const shade = 0.86 + rng() * 0.22;
      const verts = [
        [x0, -2, z + 75],
        [x1, -2, z + 75],
        [x1, h1, z],
        [x0, -2, z + 75],
        [x1, h1, z],
        [x0, h0, z],
      ];
      for (const v of verts) {
        positions.push(...v);
        const top = v[1] > 0 ? 1 : 0.8;
        colors.push(
          (0.002 + layer * 0.0014) * shade * top,
          (0.0043 + layer * 0.002) * shade * top,
          (0.0067 + layer * 0.003) * shade * top,
        );
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    own(
      new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          vertexColors: true,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      ),
    );
  }
  // The land apron closes the sky gap between the bank and distant ridges.
  const land = own(
    new THREE.Mesh(
      new THREE.PlaneGeometry(4400, 1000),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.001, 0.0019, 0.0025),
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    ),
  );
  land.rotation.x = -Math.PI / 2;
  land.position.set(0, 0.35, -561);
  // An irregular far bank and one merged conifer silhouette, never one mesh/tree.
  const bankVertices = [],
    treeVertices = [];
  for (let i = 0; i < 250; i++) {
    const x = -1800 + i * 14.4,
      xn = x + 14.4,
      h = 2 + Math.sin(x * 0.018) * 0.65 + Math.sin(x * 0.053) * 0.28;
    bankVertices.push(
      x,
      0,
      -64,
      xn,
      0,
      -64,
      xn,
      h,
      -72,
      x,
      0,
      -64,
      xn,
      h,
      -72,
      x,
      h,
      -72,
    );
  }
  for (let i = 0; i < 370; i++) {
    const x = (rng() - 0.5) * 3200,
      z = -96 - rng() * 24,
      height = 2 + rng() * 8,
      width = height * 0.19;
    for (let j = 0; j < 3; j++) {
      const y = height * (0.2 + j * 0.19),
        w = width * (1 - j * 0.23);
      treeVertices.push(x - w, y, z, x + w, y, z, x, y + height * 0.5, z);
    }
  }
  for (const verts of [bankVertices, treeVertices]) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    own(
      new THREE.Mesh(
        g,
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(0.0012, 0.0022, 0.0027),
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      ),
    );
  }
  const water = new Reflector(new THREE.PlaneGeometry(4400, 2300), {
    textureWidth: reflectionSize,
    textureHeight: Math.round(reflectionSize * 0.5625),
    clipBias: 0.003,
    multisample: 0,
    shader: WATER_SHADER,
  });
  water.name = "Moonlit lake / rough planar reflection";
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0, 1088);
  water.material.toneMapped = false;
  own(water);
  const reflectRender = water.onBeforeRender;
  water.onBeforeRender = function (renderer, s, camera, ...rest) {
    if (this.material.uniforms.uReflections.value > 0)
      reflectRender.call(this, renderer, s, camera, ...rest);
  };
  return {
    sky,
    water,
    update(time, reducedMotion) {
      const t = reducedMotion ? 0 : time;
      sky.material.uniforms.uTime.value = t;
      water.material.uniforms.uTime.value = t;
    },
    reflections(enabled) {
      water.material.uniforms.uReflections.value = enabled ? 1 : 0;
    },
    resize(w, h) {
      water.getRenderTarget().setSize(w, h);
      water.material.uniforms.uTexel.value.set(1 / w, 1 / h);
    },
    dispose() {
      for (const object of owned) {
        scene.remove(object);
        object.geometry.dispose();
        if (object === water) object.dispose();
        else object.material.dispose();
      }
    },
  };
}
