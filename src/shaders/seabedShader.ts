import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// DEEP-OCEAN SEABED SHADER — Mariana Trench terrain
//
// BUG FIX: vNormal is now passed in WORLD SPACE (not view space).
// Previously: normalMatrix * normalCalc → view-space normal → dot with
// world-up vec3(0,1,0) changed as camera rotated → angle-dependent colour.
// Fix: pass (modelMatrix * vec4(normalCalc, 0.0)).xyz → stable world normal.
// ─────────────────────────────────────────────────────────────────────────────
export const SeabedShader = {
  uniforms: {
    uTime:       { value: 0 },
    uFogColor:   { value: new THREE.Color('#001830') },
    uFogDensity: { value: 0.000016 },
  },
  vertexShader: /* glsl */ `
    uniform float uTime;
    varying vec3  vWorldPosition;
    varying float vElevation;
    varying vec3  vWorldNormal;   // world-space — never view-dependent
    varying float vTrenchDepth;

    vec3 permute3(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
               -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute3(permute3(i.y + vec3(0.0,i1.y,1.0)) + i.x + vec3(0.0,i1.x,1.0));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m; m = m*m;
      vec3 xa = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(xa) - 0.5;
      vec3 ox = floor(xa + 0.5);
      vec3 a0 = xa - ox;
      m *= 1.79284291400159 - 0.85373472095314*(a0*a0 + h*h);
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    float trenchProfile(vec2 xz) {
      vec2 tc = vec2(0.0, -1280.0);
      vec2 td = normalize(vec2(0.3, 1.0));
      vec2 tp = xz - tc;
      float along  = dot(tp, td);
      float across = dot(tp, vec2(-td.y, td.x));
      float cF = 1.0 - smoothstep(0.0, 1.0, abs(across / 280.0));
      float aF = 1.0 - smoothstep(0.0, 1.0, abs(along  / 2400.0));
      float cd = length(xz - vec2(50.0, -1480.0)) / 150.0;
      float cb = max(0.0, 1.0 - cd*cd);
      return cF*aF + cb*0.4;
    }

    void main() {
      vec3 pos = position;

      float n1 = snoise(pos.xz * 0.000055) * 180.0;
      float n2 = snoise(pos.xz * 0.00028)  *  60.0;
      float n3 = snoise(pos.xz * 0.0018)   *  18.0;
      float n4 = snoise(pos.xz * 0.012)    *   5.0;

      float trench = trenchProfile(pos.xz);
      float trenchWallNoise = snoise(pos.xz * 0.004) * 40.0 * trench;
      float trenchDepth = trench * -690.0 + trenchWallNoise;

      float dist  = length(pos.xz) / 5000.0;
      float slope = smoothstep(0.4, 1.0, dist) * 200.0;

      float elevation = n1+n2+n3+n4 + trenchDepth + slope;
      pos.y += elevation;
      vElevation  = elevation;
      vTrenchDepth = trench;

      vec4 worldPos = modelMatrix * vec4(pos, 1.0);
      vWorldPosition = worldPos.xyz;

      // ── WORLD-SPACE NORMAL via finite differences ─────────────────────
      // Do NOT use normalMatrix (view-space) — that causes angle-dependent colour.
      float d = 8.0;
      float hR = snoise((pos.xz+vec2(d,0.0))*0.000055)*180.0
               + snoise((pos.xz+vec2(d,0.0))*0.00028)*60.0
               + snoise((pos.xz+vec2(d,0.0))*0.0018)*18.0
               + trenchProfile(pos.xz+vec2(d,0.0))*-690.0
               + smoothstep(0.4,1.0,length(pos.xz+vec2(d,0.0))/5000.0)*200.0;
      float hU = snoise((pos.xz+vec2(0.0,d))*0.000055)*180.0
               + snoise((pos.xz+vec2(0.0,d))*0.00028)*60.0
               + snoise((pos.xz+vec2(0.0,d))*0.0018)*18.0
               + trenchProfile(pos.xz+vec2(0.0,d))*-690.0
               + smoothstep(0.4,1.0,length(pos.xz+vec2(0.0,d))/5000.0)*200.0;

      // Tangent/bitangent in LOCAL space, then transform to world
      vec3 tangL  = normalize(vec3(d,  hR - elevation, 0.0));
      vec3 bitanL = normalize(vec3(0.0, hU - elevation, d));
      vec3 normL  = normalize(cross(tangL, bitanL));

      // modelMatrix (not normalMatrix) → world space, stable across camera rotation
      vWorldNormal = normalize(mat3(modelMatrix) * normL);

      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform vec3  uFogColor;
    uniform float uFogDensity;

    varying vec3  vWorldPosition;
    varying float vElevation;
    varying vec3  vWorldNormal;
    varying float vTrenchDepth;

    float causticsPattern(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p);
      float res = 0.0;
      for (int y2=-1;y2<=1;y2++) for (int x2=-1;x2<=1;x2++) {
        vec2 b = vec2(float(x2),float(y2));
        vec2 r = b - f + sin(i+b+uTime*0.28)*0.5+0.5;
        res += 1.0/(1.0+length(r)*8.0);
      }
      return res * 0.15;
    }

    void main() {
      // ── BASE ALBEDO — stable white-grey sand ─────────────────────────
      // Target: #BFC5C5 – #D3D6D3 light grey sediment
      vec3 shallowSand = vec3(0.827, 0.843, 0.835);  // #D3D6D3 near surface
      vec3 midSand     = vec3(0.749, 0.773, 0.769);  // #BFC5C5 mid depth
      vec3 deepSed     = vec3(0.478, 0.506, 0.533);  // #7a8188 abyssal plain
      vec3 trenchRock  = vec3(0.180, 0.220, 0.263);  // #2e3843 trench walls

      // Blend by elevation (world Y) — NOT by camera angle
      float ev = vElevation;
      float t1 = smoothstep(-300.0, -80.0,  ev);   // shallow/mid blend
      float t2 = smoothstep(-450.0, -280.0, ev);   // deep blend in
      float t3 = smoothstep(-800.0, -500.0, ev);   // abyssal
      float t4 = vTrenchDepth;                      // trench walls

      vec3 albedo = shallowSand;
      albedo = mix(albedo, midSand,    t1);
      albedo = mix(albedo, deepSed,    1.0-t2);
      albedo = mix(albedo, trenchRock, t4*0.65);

      // ── ROCKS on steep slopes — world-space slope, camera-stable ─────
      // Use vWorldNormal.y (world up component) — does NOT change with camera
      float upness  = max(0.0, vWorldNormal.y);
      float steepness = 1.0 - upness;
      vec3 rockCol  = vec3(0.22, 0.27, 0.32);  // medium-dark grey rock
      albedo = mix(albedo, rockCol, smoothstep(0.35, 0.75, steepness));

      // ── CAUSTICS — near-surface only ─────────────────────────────────
      float depth = max(0.0, -vWorldPosition.y);
      float cFade = max(0.0, 1.0 - depth/2500.0);
      float caustics = causticsPattern(vWorldPosition.xz * 0.015) * upness * cFade;
      albedo += vec3(0.05, 0.10, 0.15) * caustics * 0.22;

      // ── LIGHTING — world-space, camera rotation independent ──────────
      // Gentle directional from above + ambient.
      // vWorldNormal.y = world-up dot — NEVER changes with camera rotation.
      float ambient   = 0.55;
      float directional = max(0.0, vWorldNormal.y) * 0.45;
      albedo *= (ambient + directional);

      // ── DEPTH FOG ─────────────────────────────────────────────────────
      float dist   = length(vWorldPosition - cameraPosition);
      float fogF   = 1.0 - exp(-dist * uFogDensity);
      vec3  final  = mix(albedo, uFogColor, clamp(fogF, 0.0, 0.82));

      gl_FragColor = vec4(final, 1.0);
    }
  `,
};
