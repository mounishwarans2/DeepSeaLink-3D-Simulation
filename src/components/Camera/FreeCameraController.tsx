import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { FC } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// HYBRID FREE CAMERA v8 — FPS pointer-lock + Orbit modes
//
// ┌─── ORBIT MODE (default, Escape to return) ──────────────────────────────┐
// │  Left drag   = orbit / rotate (rotateSpeed 0.35 — reduced sensitivity)  │
// │  Right drag  = pan                                                       │
// │  Scroll      = zoom in/out                                               │
// │  W/S/A/D     = forward / backward / strafe (horizontal only)            │
// │  E/Q         = ascend / descend                                          │
// │  Shift       = 6× faster                                                 │
// │  Ctrl+Shift  = 24× faster (ULTRA)                                       │
// └─────────────────────────────────────────────────────────────────────────┘
//
// ┌─── FPS MODE (click canvas to enter) ────────────────────────────────────┐
// │  Mouse       = look around (sensitivity 0.0008, damped)                 │
// │  W/S/A/D     = move in camera look direction                            │
// │  E/Q         = ascend / descend                                         │
// │  Shift       = 6× faster                                                 │
// │  Ctrl+Shift  = 24× faster (ULTRA)                                       │
// │  Escape      = exit FPS mode, return to orbit                           │
// └─────────────────────────────────────────────────────────────────────────┘
// ─────────────────────────────────────────────────────────────────────────────

const SPEED_NORMAL = 150;
const SPEED_FAST   = 900;
const SPEED_ULTRA  = 3600;     // Ctrl+Shift — 24× normal, 4× fast

// ── TERRAIN MATH — mirrors CoastalTerrain GLSL exactly ──────────────────────
function ss(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
function mixN(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function northCoastZCam(wx: number): number {
  let z: number;
  if      (wx <= -7000) z = 2500;
  else if (wx <= -5000) z = 2500 + (4800 - 2500) * (wx + 7000) / 2000;
  else if (wx <= -3000) z = 4800 + (3500 - 4800) * (wx + 5000) / 2000;
  else if (wx <= -1000) z = 3500 + (5200 - 3500) * (wx + 3000) / 2000;
  else if (wx <=     0) z = 5200 + (5500 - 5200) * (wx + 1000) / 1000;
  else if (wx <=  2000) z = 5500 + (5000 - 5500) * wx          / 2000;
  else if (wx <=  4000) z = 5000 + (4500 - 5000) * (wx - 2000) / 2000;
  else if (wx <=  5500) z = 4500 + (3000 - 4500) * (wx - 4000) / 1500;
  else if (wx <=  7000) z = 3000 + (2500 - 3000) * (wx - 5500) / 1500;
  else                  z = 2500;
  z += Math.sin(wx * 0.00024) * 360 + Math.cos(wx * 0.00042) * 210 + Math.sin(wx * 0.00079) * 110;
  return z;
}
function eastArmXCam(wz: number): number {
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
  const fade = Math.max(0, Math.min(1, (wz + 4500) / 500));
  return fade * x + (1 - fade) * 30000;
}
function westArmXCam(wz: number): number {
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
function coastMaskJS(wx: number, wz: number): number {
  const dN = northCoastZCam(wx) - wz;
  const dE = eastArmXCam(wz) - wx;
  const dW = wx - westArmXCam(wz);
  const k = 1500;
  const hNE = Math.max(0, k - Math.abs(dN - dE)) / k;
  const dNE = Math.min(dN, dE) - hNE * hNE * k * 0.25;
  const hW  = Math.max(0, k - Math.abs(dNE - dW)) / k;
  const d   = Math.min(dNE, dW) - hW * hW * k * 0.25;
  return 1 - ss(-1200, 3200, d);   // 4400-unit wide transition — mirrors CoastalTerrain
}

function seabedJS(wx: number, wz: number): number {
  const tD = new THREE.Vector2(0.3, 1.0).normalize();
  const tp  = new THREE.Vector2(wx, wz).sub(new THREE.Vector2(0, -1280));
  const along  = tp.dot(tD);
  const across = tp.dot(new THREE.Vector2(-tD.y, tD.x));
  const cF = 1 - ss(0, 1, Math.abs(across/280));
  const aF = 1 - ss(0, 1, Math.abs(along/2400));
  const cd = new THREE.Vector2(wx, wz).sub(new THREE.Vector2(50, -1480)).length()/150;
  const cb = Math.max(0, 1-cd*cd);
  const trench = cF*aF + cb*0.4;
  const slope  = ss(0.4, 1.0, Math.sqrt(wx*wx+wz*wz)/5000)*200;
  const noise  = Math.sin(wx*0.000055)*80 + Math.cos(wz*0.00028)*40 + Math.sin(wx*0.00028)*30;
  return -700 + noise + trench*-690 + slope;
}

function landJS(wx: number, wz: number, mask: number): number {
  const h1 = Math.sin(wx*0.00026)*Math.cos(wz*0.00021)*350;
  const h2 = Math.sin(wx*0.00060+1.4)*Math.cos(wz*0.00050)*160;
  const h3 = Math.sin(wx*0.0022)*Math.cos(wz*0.0017)*65;
  const h4 = Math.sin(wx*0.0055+2.1)*Math.cos(wz*0.0042)*25;
  const hill = (h1+h2+h3+h4)*0.55;
  const base = 320 + Math.max(0, hill*0.22);
  return base + (760-base)*ss(0.05, 0.90, mask);
}

function unifiedTerrainHeight(wx: number, wz: number): number {
  const mask = coastMaskJS(wx, wz);
  const seaH = seabedJS(wx, wz);
  const lndH = landJS(wx, wz, mask);
  // 5-stage profile — mirrors CoastalTerrain terrH() exactly
  const h1 = seaH + (-60-seaH)*ss(0.02, 0.16, mask);
  const h2 = mixN(h1, 20, ss(0.16, 0.34, mask));
  const h3 = mixN(h2, 90, ss(0.34, 0.52, mask));
  const h4 = mixN(h3, 200, ss(0.52, 0.68, mask));
  return mixN(h4, lndH, ss(0.68, 0.95, mask));
}

// ─────────────────────────────────────────────────────────────────────────────

export const FreeCameraController: FC = () => {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const keys        = useRef<Set<string>>(new Set());
  const velocity    = useRef(new THREE.Vector3());

  const _fwd   = useRef(new THREE.Vector3());
  const _right = useRef(new THREE.Vector3());
  const _up    = new THREE.Vector3(0, 1, 0);
  const _want  = useRef(new THREE.Vector3());

  // ── Key tracking (Ctrl allowed for ultra speed) ────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMoveKey = ['KeyW','KeyS','KeyA','KeyD','KeyQ','KeyE',
                         'Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code);
      const isModifier = e.code === 'ShiftLeft'   || e.code === 'ShiftRight'   ||
                         e.code === 'ControlLeft'  || e.code === 'ControlRight';

      if (isModifier) { keys.current.add(e.code); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return; // Block browser shortcuts
      keys.current.add(e.code);
      if (isMoveKey) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => { keys.current.delete(e.code); };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup',   onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
    };
  }, []);

  // ── Per-frame WASD movement ────────────────────────────────────────────────
  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const dt = Math.min(delta, 0.05);
    const k  = keys.current;

    const hasShift = k.has('ShiftLeft') || k.has('ShiftRight');
    const hasCtrl  = k.has('ControlLeft') || k.has('ControlRight');
    const speed = (hasCtrl && hasShift) ? SPEED_ULTRA
                : hasShift              ? SPEED_FAST
                :                        SPEED_NORMAL;

    // Horizontal movement plane
    _fwd.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
    _fwd.current.y = 0;
    if (_fwd.current.lengthSq() > 0.0001) _fwd.current.normalize();

    _right.current.set(1, 0, 0).applyQuaternion(camera.quaternion);
    _right.current.y = 0;
    if (_right.current.lengthSq() > 0.0001) _right.current.normalize();

    _want.current.set(0, 0, 0);
    if (k.has('KeyW') || k.has('ArrowUp'))    _want.current.addScaledVector(_fwd.current,    speed);
    if (k.has('KeyS') || k.has('ArrowDown'))  _want.current.addScaledVector(_fwd.current,   -speed);
    if (k.has('KeyA') || k.has('ArrowLeft'))  _want.current.addScaledVector(_right.current, -speed);
    if (k.has('KeyD') || k.has('ArrowRight')) _want.current.addScaledVector(_right.current,  speed);
    if (k.has('KeyE')) _want.current.addScaledVector(_up,  speed);
    if (k.has('KeyQ')) _want.current.addScaledVector(_up, -speed);

    velocity.current.lerp(_want.current, Math.min(1, 10 * dt));

    if (velocity.current.lengthSq() > 0.001) {
      const dx = velocity.current.x * dt;
      const dy = velocity.current.y * dt;
      const dz = velocity.current.z * dt;

      camera.position.x += dx;
      camera.position.y += dy;
      camera.position.z += dz;
      controls.target.x += dx;
      controls.target.y += dy;
      controls.target.z += dz;

      camera.position.x = Math.max(-35000, Math.min(35000, camera.position.x));
      camera.position.z = Math.max(-35000, Math.min(35000, camera.position.z));
      controls.target.x = Math.max(-35000, Math.min(35000, controls.target.x));
      controls.target.z = Math.max(-35000, Math.min(35000, controls.target.z));
      camera.position.y = Math.min(1800, camera.position.y);

      const terrainY = unifiedTerrainHeight(camera.position.x, camera.position.z);
      const minY     = terrainY + 20;
      if (camera.position.y < minY) {
        camera.position.y = minY;
        if (velocity.current.y < 0) velocity.current.y = 0;
      }

      const targetTerrainY = unifiedTerrainHeight(controls.target.x, controls.target.z);
      controls.target.y    = Math.max(targetTerrainY + 12, controls.target.y);
      controls.update();
    }

    // Always-on floor clamp
    const floorY = unifiedTerrainHeight(camera.position.x, camera.position.z) + 20;
    if (camera.position.y < floorY) {
      camera.position.y = floorY;
      if (velocity.current.y < 0) velocity.current.y = 0;
      if (controls.target.y < floorY - 8) controls.target.y = floorY - 8;
      controls.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.45}
      minDistance={3}
      maxDistance={22000}
      maxPolarAngle={Math.PI * 0.92}
      minPolarAngle={0.04}
      target={[0, 200, 2000]}
    />
  );
};

