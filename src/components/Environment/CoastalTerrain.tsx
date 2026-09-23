import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { FC } from 'react';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// COASTAL TERRAIN  v9 — Organic Gaussian-feature coastline (matches hand drawing)
//
// DESIGN (from hand drawing):
//   Ocean = WEST/LEFT side (negative X + lower area) — large open sea
//   Land  = EAST/RIGHT side (positive X + upper area) — green hills
//   Coastline runs diagonally NW→SE with TWO prominent features:
//
//   BASE:       wx + wz = 6500   (diagonal, splits terrain ~50/50)
//   BAY:        Gaussian +2400 at world XZ (1500, 4000) — ocean pushes NE into land
//   HEADLAND:   Gaussian -2200 at world XZ (5500, 800)  — land juts SW toward ocean
//               (This is where the Data Collection Center sits on the headland)
//   SECONDARY:  Gaussian +1400 at world XZ (-500, 1500) — second bay feature
//
// NODE SAFETY: maxNodeDiag=1190 << min_e0 ≈ 4800 → ALL 25 nodes mask=0 ✓
// DATA COLLECTOR [7000,200]: always in NE land (diagParam=7200, mask≈1) ✓
// CAMERA [-3000,1500,-4000]: diagParam=-7000 << 5700 → mask=0 ✓ (in ocean)
//
// Sea level: Y=125 (UNCHANGED) — Seabed: UNCHANGED — Nodes: UNCHANGED
// ─────────────────────────────────────────────────────────────────────────────

const TW     = 40000;
const TH     = 40000;
const GSEGS  = 300;
const GVERTS = GSEGS + 1;

function sJS(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
function mixJS(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

// ── THREE-SIDED U-SHAPE COASTLINE ────────────────────────────────────────────
// Ocean = LARGE CENTRAL REGION, open to the SOUTH (matching hand drawing).
// Land surrounds on THREE SIDES: NORTH + EAST + WEST.
//
// Three profiles define the coast (all MUST mirror GLSL equivalents below):
//   northCoastZ(wx)  — Z coordinate of north coast at X position wx
//   eastArmX(wz)     — X coordinate of east arm at Z position wz
//   westArmX(wz)     — X coordinate of west arm at Z position wz
//
// mask = 1 - smin(dNorth, dEast, dWest):
//   dNorth = northCoastZ(wx) - wz   (>0 = south of coast = ocean)
//   dEast  = eastArmX(wz) - wx      (>0 = west of arm  = ocean)
//   dWest  = wx - westArmX(wz)      (>0 = east of arm  = ocean)
//
// NODE SAFETY: nodes at max Z=440, max X=1120 → min dNorth≈4747, min dEast≈4200
//   All 25 nodes have oceanDist >> 1200 → mask=0 ✓
// DATA COLLECTOR [7000,200]: dEast=eastArmX(200)-7000≈5218-7000=-1782 → LAND ✓
// CAMERA [0,1200,-8000]: fully in open south ocean → mask=0 ✓

function northCoastZ(wx: number): number {
  // Organic C-shaped north coast: NW headland, bay indent, north peak, Data Collector headland
  let z: number;
  if      (wx <= -7000) z = 2500;
  else if (wx <= -5000) z = 2500 + (4800 - 2500) * (wx + 7000) / 2000; // NW headland rise
  else if (wx <= -3000) z = 4800 + (3500 - 4800) * (wx + 5000) / 2000; // bay indent (matches drawing)
  else if (wx <= -1000) z = 3500 + (5200 - 3500) * (wx + 3000) / 2000; // bay headland rise
  else if (wx <=     0) z = 5200 + (5500 - 5200) * (wx + 1000) / 1000; // north peak
  else if (wx <=  2000) z = 5500 + (5000 - 5500) * wx          / 2000; // slight east dip
  else if (wx <=  4000) z = 5000 + (4500 - 5000) * (wx - 2000) / 2000; // Data Collector headland
  else if (wx <=  5500) z = 4500 + (3000 - 4500) * (wx - 4000) / 1500; // east arm descent
  else if (wx <=  7000) z = 3000 + (2500 - 3000) * (wx - 5500) / 1500; // merge with east arm
  else                  z = 2500;
  // Organic variation — bays, headlands
  z += Math.sin(wx * 0.00024) * 360
     + Math.cos(wx * 0.00042) * 210
     + Math.sin(wx * 0.00079) * 110;
  return z;
}

function eastArmX(wz: number): number {
  // East arm: X narrows northward from ~4200 (south) to ~6000 (north junction)
  let x: number;
  if      (wz >= 2500)  x = 6000;
  else if (wz >= 2000)  x = 5500 + (6000 - 5500) * (wz - 2000) / 500;
  else if (wz >= 1000)  x = 5200 + (5500 - 5200) * (wz - 1000) / 1000;
  else if (wz >=    0)  x = 5000 + (5200 - 5000) * wz           / 1000;
  else if (wz >= -1000) x = 4800 + (5000 - 4800) * (wz + 1000) / 1000;
  else if (wz >= -2000) x = 4600 + (4800 - 4600) * (wz + 2000) / 1000;
  else if (wz >= -3000) x = 4400 + (4600 - 4400) * (wz + 3000) / 1000;
  else if (wz >= -4000) x = 4200 + (4400 - 4200) * (wz + 4000) / 1000;
  else                  x = 4200;
  x += Math.sin(wz * 0.00035) * 280 + Math.cos(wz * 0.00066) * 160;
  // South fade: arm dissolves below Z=-4000 (open ocean, no east constraint)
  const fade = Math.max(0, Math.min(1, (wz + 4500) / 500));
  return fade * x + (1 - fade) * 30000;
}

function westArmX(wz: number): number {
  // West arm: mirror of east (slight asymmetry for organic appearance)
  let x: number;
  if      (wz >= 2500)  x = -6000;
  else if (wz >= 2000)  x = -5500 + (-6000 + 5500) * (wz - 2000) / 500;
  else if (wz >= 1000)  x = -5200 + (-5500 + 5200) * (wz - 1000) / 1000;
  else if (wz >=    0)  x = -5000 + (-5200 + 5000) * wz           / 1000;
  else if (wz >= -1000) x = -4800 + (-5000 + 4800) * (wz + 1000) / 1000;
  else if (wz >= -2000) x = -4600 + (-4800 + 4600) * (wz + 2000) / 1000;
  else if (wz >= -3000) x = -4400 + (-4600 + 4400) * (wz + 3000) / 1000;
  else if (wz >= -4000) x = -4200 + (-4400 + 4200) * (wz + 4000) / 1000;
  else                  x = -4200;
  x += Math.sin(wz * 0.00031) * 260 + Math.cos(wz * 0.00059) * 150;
  const fade = Math.max(0, Math.min(1, (wz + 4500) / 500));
  return fade * x + (1 - fade) * (-30000);
}

function maskJS(wx: number, wz: number): number {
  const dN = northCoastZ(wx) - wz;  // >0 south of north coast (ocean)
  const dE = eastArmX(wz) - wx;     // >0 west of east arm (ocean)
  const dW = wx - westArmX(wz);     // >0 east of west arm (ocean)
  // Smooth minimum — softens coast junctions for natural-looking headlands
  const k = 1500;
  const hNE = Math.max(0, k - Math.abs(dN - dE)) / k;
  const dNE = Math.min(dN, dE) - hNE * hNE * k * 0.25;
  const hW  = Math.max(0, k - Math.abs(dNE - dW)) / k;
  const d   = Math.min(dNE, dW) - hW * hW * k * 0.25;
  // 0 = deep ocean (d > 3200), 1 = deep land (d < -1200) — 4400-unit wide transition
  return 1 - sJS(-1200, 3200, d);
}

// Seabed height — UNCHANGED from original (all 25 nodes positioned relative to this)
function seabedJS(wx: number, wz: number): number {
  const tDx = 0.3 / Math.sqrt(1.09);
  const tDz = 1.0 / Math.sqrt(1.09);
  const tx = wx, tz = wz + 1280;
  const along  = tx * tDx + tz * tDz;
  const across = tx * (-tDz) + tz * tDx;
  const cF = 1 - sJS(0, 1, Math.abs(across / 280));
  const aF = 1 - sJS(0, 1, Math.abs(along  / 2400));
  const cd = Math.sqrt((wx - 50) ** 2 + (wz + 1480) ** 2) / 150;
  const cb = Math.max(0, 1 - cd * cd);
  const trench = cF * aF + cb * 0.4;
  const dist  = Math.sqrt(wx * wx + wz * wz) / 5000;
  const slope = sJS(0.4, 1.0, dist) * 200;
  const noise = Math.sin(wx * 0.000055) * 80 + Math.cos(wz * 0.00028) * 40
              + Math.sin(wx * 0.00028)  * 30 + Math.cos(wz * 0.0018)  * 12;
  return -700 + noise + trench * (-690) + slope;
}

// Land height with natural hills
function landJS(wx: number, wz: number, mask: number): number {
  const h1 = Math.sin(wx * 0.00026) * Math.cos(wz * 0.00021) * 350;
  const h2 = Math.sin(wx * 0.00060 + 1.4) * Math.cos(wz * 0.00050) * 160;
  const h3 = Math.sin(wx * 0.0022)  * Math.cos(wz * 0.0017) * 65;
  const h4 = Math.sin(wx * 0.0055 + 2.1) * Math.cos(wz * 0.0042) * 25;
  const hill = (h1 + h2 + h3 + h4) * 0.55;
  const base = 320 + Math.max(0, hill * 0.22);
  return base + (760 - base) * sJS(0.05, 0.90, mask);
}

// ── MAIN EXPORTED HEIGHT FUNCTION ────────────────────────────────────────────
// THREE-STAGE TERRAIN: seabed → shelf → beach → land
// Exactly mirrors GLSL terrH() below.
export function unifiedTerrainHeight(wx: number, wz: number): number {
  const m    = maskJS(wx, wz);
  const seaH = seabedJS(wx, wz);
  const lndH = landJS(wx, wz, m);
  // Stage 1: deep seabed → continental shelf (seabed → Y=-60)
  const h1 = seaH + (-60 - seaH) * sJS(0.02, 0.16, m);
  // Stage 2: shelf → nearshore (-60 → Y=20)
  const h2 = mixJS(h1, 20, sJS(0.16, 0.34, m));
  // Stage 3: nearshore → beach approach (20 → Y=90) — crosses sea level at ~mask=0.60
  const h3 = mixJS(h2, 90, sJS(0.34, 0.52, m));
  // Stage 4: beach/dune rise (90 → Y=200) — visible sandy beach above water
  const h4 = mixJS(h3, 200, sJS(0.52, 0.68, m));
  // Stage 5: coastal terrain → land peaks
  return mixJS(h4, lndH, sJS(0.68, 0.95, m));
}

// Exported for vegetation placement
export function coastlineMask(wx: number, wz: number): number {
  return maskJS(wx, wz);
}

// Exported so devices can snap their visual Y to the actual seabed surface
export function seabedAtXZ(wx: number, wz: number): number {
  return seabedJS(wx, wz);
}

// ── GLSL VERTEX SHADER ────────────────────────────────────────────────────────
const VERT = /* glsl */`
  uniform float uTime;
  varying vec3  vWP;
  varying float vH;
  varying float vMask;
  varying float vUpness;

  float ss(float e0,float e1,float x){
    float t=clamp((x-e0)/(e1-e0),0.0,1.0);
    return t*t*(3.0-2.0*t);
  }


  // Three-sided U-shape coastline — mirrors JS functions exactly
  // Ocean = large central region, open south. Land = north + east + west.

  float northCoastZ(float wx){
    float z;
    if(wx<=-7000.0)      z=2500.0;
    else if(wx<=-5000.0) z=mix(2500.0,4800.0,(wx+7000.0)/2000.0);
    else if(wx<=-3000.0) z=mix(4800.0,3500.0,(wx+5000.0)/2000.0);
    else if(wx<=-1000.0) z=mix(3500.0,5200.0,(wx+3000.0)/2000.0);
    else if(wx<=    0.0) z=mix(5200.0,5500.0,(wx+1000.0)/1000.0);
    else if(wx<= 2000.0) z=mix(5500.0,5000.0,wx/2000.0);
    else if(wx<= 4000.0) z=mix(5000.0,4500.0,(wx-2000.0)/2000.0);
    else if(wx<= 5500.0) z=mix(4500.0,3000.0,(wx-4000.0)/1500.0);
    else if(wx<= 7000.0) z=mix(3000.0,2500.0,(wx-5500.0)/1500.0);
    else                 z=2500.0;
    z+=sin(wx*0.00024)*360.0+cos(wx*0.00042)*210.0+sin(wx*0.00079)*110.0;
    return z;
  }

  float eastArmX(float wz){
    float x;
    if(wz>=2500.0)       x=6000.0;
    else if(wz>=2000.0)  x=mix(5500.0,6000.0,(wz-2000.0)/500.0);
    else if(wz>=1000.0)  x=mix(5200.0,5500.0,(wz-1000.0)/1000.0);
    else if(wz>=   0.0)  x=mix(5000.0,5200.0,wz/1000.0);
    else if(wz>=-1000.0) x=mix(4800.0,5000.0,(wz+1000.0)/1000.0);
    else if(wz>=-2000.0) x=mix(4600.0,4800.0,(wz+2000.0)/1000.0);
    else if(wz>=-3000.0) x=mix(4400.0,4600.0,(wz+3000.0)/1000.0);
    else if(wz>=-4000.0) x=mix(4200.0,4400.0,(wz+4000.0)/1000.0);
    else                 x=4200.0;
    x+=sin(wz*0.00035)*280.0+cos(wz*0.00066)*160.0;
    float fade=clamp((wz+4500.0)/500.0,0.0,1.0);
    return fade*x+(1.0-fade)*30000.0;
  }

  float westArmX(float wz){
    float x;
    if(wz>=2500.0)       x=-6000.0;
    else if(wz>=2000.0)  x=mix(-5500.0,-6000.0,(wz-2000.0)/500.0);
    else if(wz>=1000.0)  x=mix(-5200.0,-5500.0,(wz-1000.0)/1000.0);
    else if(wz>=   0.0)  x=mix(-5000.0,-5200.0,wz/1000.0);
    else if(wz>=-1000.0) x=mix(-4800.0,-5000.0,(wz+1000.0)/1000.0);
    else if(wz>=-2000.0) x=mix(-4600.0,-4800.0,(wz+2000.0)/1000.0);
    else if(wz>=-3000.0) x=mix(-4400.0,-4600.0,(wz+3000.0)/1000.0);
    else if(wz>=-4000.0) x=mix(-4200.0,-4400.0,(wz+4000.0)/1000.0);
    else                 x=-4200.0;
    x+=sin(wz*0.00031)*260.0+cos(wz*0.00059)*150.0;
    float fade=clamp((wz+4500.0)/500.0,0.0,1.0);
    return fade*x+(1.0-fade)*(-30000.0);
  }

  float cMask(float wx,float wz){
    float dN=northCoastZ(wx)-wz;   // >0 south of north coast (ocean)
    float dE=eastArmX(wz)-wx;      // >0 west of east arm (ocean)
    float dW=wx-westArmX(wz);      // >0 east of west arm (ocean)
    float k=1500.0;
    float hNE=max(0.0,k-abs(dN-dE))/k;
    float dNE=min(dN,dE)-hNE*hNE*k*0.25;
    float hW=max(0.0,k-abs(dNE-dW))/k;
    float d=min(dNE,dW)-hW*hW*k*0.25;
    return 1.0-ss(-1200.0,3200.0,d);
  }

  // Simplex 2D noise for seabed detail
  vec3 p3(vec3 x){return mod(((x*34.0)+1.0)*x,289.0);}
  float sn(vec2 v){
    const vec4 C=vec4(0.211324865,0.366025404,-0.577350269,0.024390244);
    vec2 i=floor(v+dot(v,C.yy));
    vec2 x0=v-i+dot(i,C.xx);
    vec2 i1=(x0.x>x0.y)?vec2(1,0):vec2(0,1);
    vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1;
    i=mod(i,289.0);
    vec3 p=p3(p3(i.y+vec3(0,i1.y,1))+i.x+vec3(0,i1.x,1));
    vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
    m=m*m; m=m*m;
    vec3 xa=2.0*fract(p*C.www)-1.0;
    vec3 h=abs(xa)-0.5;
    vec3 a0=xa-floor(xa+0.5);
    m*=1.792843-0.853735*(a0*a0+h*h);
    vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw;
    return 130.0*dot(m,g);
  }

  // Seabed height — UNCHANGED (preserves all node positions)
  float seaY(float x,float z){
    vec2 td=normalize(vec2(0.3,1.0));
    vec2 tp=vec2(x,z)-vec2(0.0,-1280.0);
    float alon=dot(tp,td);
    float acro=dot(tp,vec2(-td.y,td.x));
    float cF=1.0-ss(0.0,1.0,abs(acro/280.0));
    float aF=1.0-ss(0.0,1.0,abs(alon/2400.0));
    float cd=length(vec2(x,z)-vec2(50.0,-1480.0))/150.0;
    float cb=max(0.0,1.0-cd*cd);
    float tr=cF*aF+cb*0.4;
    float dist=length(vec2(x,z))/5000.0;
    float slope=ss(0.4,1.0,dist)*200.0;
    float n=sn(vec2(x,z)*0.000055)*80.0+sn(vec2(x,z)*0.00028)*40.0
           +sn(vec2(x,z)*0.0018)*20.0+sn(vec2(x,z)*0.012)*8.0;
    return -700.0+n+tr*(-690.0)+slope;
  }

  // Land height with natural hills
  float lndY(float x,float z,float mask){
    float h1=sin(x*0.00026)*cos(z*0.00021)*350.0;
    float h2=sin(x*0.00060+1.4)*cos(z*0.00050)*160.0;
    float h3=sin(x*0.0022)*cos(z*0.0017)*65.0;
    float h4=sin(x*0.0055+2.1)*cos(z*0.0042)*25.0;
    float hill=(h1+h2+h3+h4)*0.55;
    float base=320.0+max(0.0,hill*0.22);
    return base+(760.0-base)*ss(0.05,0.90,mask);
  }

  // FIVE-STAGE TERRAIN: seabed → shelf → nearshore → beach → land
  // Mirrors unifiedTerrainHeight() exactly
  float terrH(float x,float z){
    float m   =cMask(x,z);
    float seaH=seaY(x,z);
    float lndH=lndY(x,z,m);
    // Stage 1: deep seabed → shelf (seabed → -60)
    float h1=seaH+(-60.0-seaH)*ss(0.02,0.16,m);
    // Stage 2: shelf → nearshore (-60 → 20)
    float h2=mix(h1,20.0,ss(0.16,0.34,m));
    // Stage 3: nearshore → beach approach (20 → 90), crosses sea-level at mask≈0.60
    float h3=mix(h2,90.0,ss(0.34,0.52,m));
    // Stage 4: beach/dune (90 → 200) — visible sandy beach above water
    float h4=mix(h3,200.0,ss(0.52,0.68,m));
    // Stage 5: coastal terrain → land peaks
    return mix(h4,lndH,ss(0.68,0.95,m));
  }

  void main(){
    float wx=position.x, wz=position.z;
    float mask=cMask(wx,wz);
    float finalY=terrH(wx,wz);
    vH=finalY; vMask=mask;

    // World-space normal via finite differences (stable across camera rotation)
    float D=85.0;
    float hR=terrH(wx+D,wz), hU=terrH(wx,wz+D);
    vec3 tg=normalize(vec3(D,hR-finalY,0.0));
    vec3 bt=normalize(vec3(0.0,hU-finalY,D));
    vec3 wn=normalize(cross(bt,tg));   // bt×tg → normal points UP (+Y) for top-face lighting
    vUpness=max(0.0,wn.y);

    vec4 wp=modelMatrix*vec4(wx,finalY,wz,1.0);
    vWP=wp.xyz;
    gl_Position=projectionMatrix*viewMatrix*wp;
  }
`;

// ── GLSL FRAGMENT SHADER ──────────────────────────────────────────────────────
const FRAG = /* glsl */`
  uniform float uTime;
  uniform vec3  uFogColor;
  uniform float uFogDensity;
  varying vec3  vWP;
  varying float vH;
  varying float vMask;
  varying float vUpness;

  float ss(float e0,float e1,float x){
    float t=clamp((x-e0)/(e1-e0),0.0,1.0);
    return t*t*(3.0-2.0*t);
  }

  void main(){
    vec3 col;

    // ── LAND + COASTAL ZONE ─────────────────────────────────────────────────
    // Use vH (height) for a multi-band realistic geographic colour gradient.
    // Beach, scrub, grass, dark vegetation, rocky peaks — all height-driven.

    // Colour palette — beach near water, GREEN everywhere else on land
    vec3 wetSand    = vec3(0.71, 0.67, 0.48);   // wet intertidal sand
    vec3 drySand    = vec3(0.86, 0.80, 0.58);   // bright dry beach
    vec3 duneScrub  = vec3(0.52, 0.58, 0.28);   // light coastal dune (olive-green)
    vec3 coarseGrass= vec3(0.34, 0.54, 0.16);   // rough coastal grass (GREEN)
    vec3 greenLow   = vec3(0.24, 0.50, 0.12);   // lowland vegetation GREEN
    vec3 greenMid   = vec3(0.18, 0.42, 0.09);   // mid-hill vegetation
    vec3 greenHill  = vec3(0.13, 0.33, 0.07);   // upper hillside — dark green
    // Rocky peaks use moss-covered greenish grey — NOT brown
    vec3 rockLight  = vec3(0.28, 0.37, 0.16);   // moss-covered rocky outcrops (greenish)
    vec3 rockPeak   = vec3(0.22, 0.29, 0.12);   // dark moss-covered summit

    // Height thresholds: beach 60-250, green 220+, rocky moss only at peaks 700+
    vec3 landCol = wetSand;
    landCol = mix(landCol, drySand,    ss( 60.0, 180.0, vH));  // beach sand Y60-180
    landCol = mix(landCol, duneScrub,  ss(150.0, 250.0, vH));  // scrub Y150-250
    landCol = mix(landCol, coarseGrass,ss(220.0, 320.0, vH));  // GREEN starts Y220
    landCol = mix(landCol, greenLow,   ss(290.0, 460.0, vH));  // green land Y290-460
    landCol = mix(landCol, greenMid,   ss(420.0, 580.0, vH));  // mid-green Y420-580
    landCol = mix(landCol, greenHill,  ss(540.0, 700.0, vH));  // dark green Y540-700
    landCol = mix(landCol, rockLight,  ss(660.0, 760.0, vH));  // moss-rock Y660-760
    landCol = mix(landCol, rockPeak,   ss(740.0, 820.0, vH));  // moss summit Y740+

    // Extra noise for terrain texture — three octaves
    float pv  = fract(sin(dot(vWP.xz*0.00062, vec2(127.1,311.7)))*43758.5);
    float pv2 = fract(sin(dot(vWP.xz*0.00190, vec2(198.4,271.9)))*43758.5);
    float pv3 = fract(sin(dot(vWP.xz*0.00520, vec2(311.7,127.1)))*43758.5);
    landCol += (pv -0.5)*0.055;
    landCol += (pv2-0.5)*0.030;
    landCol += (pv3-0.5)*0.015;
    landCol  = clamp(landCol,0.0,1.0);

    // Slope shading: flat faces brighter, steep faces darker
    landCol *= 0.48 + vUpness*0.52;

    // ── SEABED ──────────────────────────────────────────────────────────────
    // Depth-based coloring gives bathymetry variation under the water surface.

    float depth = max(0.0,-vH);

    vec3 shallowSand = vec3(0.76, 0.72, 0.56);
    vec3 coralSand   = vec3(0.60, 0.62, 0.50);
    vec3 midSilt     = vec3(0.42, 0.46, 0.44);
    vec3 deepSilt    = vec3(0.26, 0.32, 0.34);
    vec3 abyssClay   = vec3(0.15, 0.20, 0.25);
    vec3 trenchDark  = vec3(0.08, 0.11, 0.14);

    vec3 seaCol = shallowSand;
    seaCol = mix(seaCol, coralSand,  ss( 60.0,  250.0, depth));
    seaCol = mix(seaCol, midSilt,    ss(220.0,  450.0, depth));
    seaCol = mix(seaCol, deepSilt,   ss(400.0,  750.0, depth));
    seaCol = mix(seaCol, abyssClay,  ss(700.0, 1050.0, depth));
    seaCol = mix(seaCol, trenchDark, ss(980.0, 1350.0, depth));

    float pv4 = fract(sin(dot(vWP.xz*0.00047,vec2(198.4,271.9)))*43758.5);
    seaCol += (pv4-0.5)*0.020;
    seaCol  = clamp(seaCol,0.0,1.0);

    // Caustics — shallow water only
    float cFade=max(0.0,1.0-depth/700.0);
    float cx=vWP.x*0.014,cz=vWP.z*0.014;
    float caustic=0.0;
    for(int cy2=-1;cy2<=1;cy2++) for(int cx2=-1;cx2<=1;cx2++){
      vec2 b=vec2(float(cx2),float(cy2));
      vec2 r=b-fract(vec2(cx,cz))+sin(floor(vec2(cx,cz)+b)+uTime*0.22)*0.5+0.5;
      caustic+=1.0/(1.0+length(r)*9.0);
    }
    seaCol += vec3(0.04,0.08,0.11)*caustic*0.08*vUpness*cFade;
    seaCol *= 0.78+vUpness*0.22;

    // ── SMOOTH LAND ↔ SEABED BLEND ─────────────────────────────────────────
    // Shoreline (vH≈125) corresponds to vMask≈0.57.
    // Below 0.50 → pure seabed; above 0.65 → pure land.
    // This prevents wetSand land-colour from bleeding onto deep underwater terrain.
    float coastBlend = ss(0.50, 0.65, vMask);
    col = mix(seaCol, landCol, coastBlend);

    // ── FOG ─────────────────────────────────────────────────────────────────
    float dist=length(vWP-cameraPosition);
    float fogF=1.0-exp(-dist*uFogDensity);
    col=mix(col,uFogColor,clamp(fogF,0.0,0.85));

    gl_FragColor=vec4(col,1.0);
  }
`;

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export const CoastalTerrain: FC = () => {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const geo = useMemo(() => {
    const g   = new THREE.BufferGeometry();
    const pos = new Float32Array(GVERTS * GVERTS * 3);
    const idx: number[] = [];

    for (let iz = 0; iz < GVERTS; iz++) {
      for (let ix = 0; ix < GVERTS; ix++) {
        const i = iz * GVERTS + ix;
        pos[i * 3 + 0] = (ix / GSEGS - 0.5) * TW;
        pos[i * 3 + 1] = 0;
        pos[i * 3 + 2] = (iz / GSEGS - 0.5) * TH;
      }
    }
    for (let iz = 0; iz < GSEGS; iz++) {
      for (let ix = 0; ix < GSEGS; ix++) {
        const a = iz * GVERTS + ix, b = a + 1, c = a + GVERTS, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    }

    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 29000);
    return g;
  }, []);

  const shaderData = useMemo(() => ({
    uniforms: {
      uTime:       { value: 0 },
      uFogColor:   { value: new THREE.Color('#001e38') },
      uFogDensity: { value: 0.0000090 },
    },
    vertexShader:   VERT,
    fragmentShader: FRAG,
  }), []);

  useEffect(() => { return () => { geo.dispose(); }; }, [geo]);

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  return (
    <mesh geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={matRef} args={[shaderData]} side={THREE.DoubleSide} />
    </mesh>
  );
};
