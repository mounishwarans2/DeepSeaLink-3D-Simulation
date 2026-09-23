import { useFrame, useThree } from '@react-three/fiber';
import { useRef, useState, useEffect } from 'react';
import type { FC } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// DEPTH SYNC — inside Canvas, writes camera depth to a global for the HUD
// Uses a simple CustomEvent approach (no extra store needed)
// ─────────────────────────────────────────────────────────────────────────────
export const DepthDisplay: FC = () => {
  const { camera } = useThree();
  const frameSkip  = useRef(0);

  useFrame(() => {
    frameSkip.current = (frameSkip.current + 1) % 12;
    if (frameSkip.current !== 0) return;

    // Y=+125 is sea surface; real depth = (125 - Y) × 10 meters
    const depth = Math.max(0, Math.round((125 - camera.position.y) * 10));
    window.dispatchEvent(new CustomEvent('ocean-depth', { detail: depth }));
  });

  return null; // No visual output — just dispatches events
};

// ─────────────────────────────────────────────────────────────────────────────
// CAMERA HUD — HTML overlay (outside Canvas) with live depth from event
// ─────────────────────────────────────────────────────────────────────────────
export const CameraHUD: FC = () => {
  const [depthM, setDepthM] = useState(3300);

  useEffect(() => {
    const handler = (e: Event) => {
      setDepthM((e as CustomEvent<number>).detail);
    };
    window.addEventListener('ocean-depth', handler);
    return () => window.removeEventListener('ocean-depth', handler);
  }, []);

  let zone     = 'Epipelagic';
  let isHadal  = false;
  if (depthM > 200)  zone = 'Mesopelagic';
  if (depthM > 1000) zone = 'Bathypelagic';
  if (depthM > 4000) zone = 'Abyssopelagic';
  if (depthM > 6000) zone = 'Hadalpelagic';
  if (depthM > 9000) { zone = '⚠ Mariana Trench'; isHadal = true; }

  return (
    <div style={styles.root}>
      <div style={styles.badge}>
        <div style={styles.title}>🎥 CAMERA CONTROLS</div>
        <table style={styles.table}>
          <tbody>
            <tr>
              <td style={styles.key}>Left Drag</td>
              <td style={styles.desc}>Orbit / Rotate</td>
            </tr>
            <tr>
              <td style={styles.key}>Right Drag</td>
              <td style={styles.desc}>Pan view</td>
            </tr>
            <tr>
              <td style={styles.key}>Scroll</td>
              <td style={styles.desc}>Zoom in / out</td>
            </tr>
            <tr>
              <td style={styles.key}>W A S D</td>
              <td style={styles.desc}>Fly through water</td>
            </tr>
            <tr>
              <td style={styles.key}>E / Q</td>
              <td style={styles.desc}>Ascend / Descend</td>
            </tr>
            <tr>
              <td style={styles.key}>Shift</td>
              <td style={styles.desc}>Fast travel (4×)</td>
            </tr>
          </tbody>
        </table>

        {/* Live depth readout */}
        <div style={{
          marginTop:     '8px',
          padding:       '5px 10px',
          borderRadius:  '5px',
          background:    isHadal ? 'rgba(160,20,20,0.22)' : 'rgba(0,40,70,0.28)',
          border:        `1px solid ${isHadal ? 'rgba(200,50,50,0.40)' : 'rgba(0,160,220,0.25)'}`,
          textAlign:     'center' as const,
        }}>
          <div style={{
            fontSize:      '8px',
            letterSpacing: '0.14em',
            color:         isHadal ? '#ff9090' : '#7de8ff',
            fontWeight:    700,
          }}>
            {zone.toUpperCase()}
          </div>
          <div style={{
            fontSize:      '13px',
            fontWeight:    900,
            letterSpacing: '0.04em',
            color:         isHadal ? '#ff7070' : '#e0f8ff',
            lineHeight:    1.3,
          }}>
            {depthM.toLocaleString()} m
          </div>
        </div>

        <div style={{ marginTop: '5px', fontSize: '8.5px', color: 'rgba(180,220,255,0.45)', textAlign: 'center' }}>
          Q = dive · E = ascend · Shift = fast
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  root: {
    position:      'absolute',
    bottom:        '20px',
    left:          '50%',
    transform:     'translateX(-50%)',
    zIndex:        200,
    pointerEvents: 'none',
    userSelect:    'none',
  },
  badge: {
    borderRadius:        '8px',
    padding:             '10px 18px',
    backdropFilter:      'blur(12px)',
    WebkitBackdropFilter:'blur(12px)',
    background:          'rgba(0, 22, 38, 0.72)',
    border:              '1px solid rgba(255,255,255,0.10)',
    fontFamily:          "'Roboto Mono', 'Courier New', monospace",
    fontSize:            '11px',
    letterSpacing:       '0.04em',
    color:               '#d0f0ff',
    boxShadow:           '0 4px 24px rgba(0,0,0,0.45)',
    textAlign:           'center' as const,
    minWidth:            '190px',
  },
  title: {
    fontWeight:    700,
    fontSize:      '11px',
    marginBottom:  '7px',
    color:         '#7de8ff',
    letterSpacing: '0.10em',
  },
  table: {
    borderCollapse: 'collapse',
    width:          '100%',
  },
  key: {
    padding:    '2px 8px 2px 0',
    color:      '#ffd570',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    textAlign:  'right'  as const,
    fontSize:   '10px',
  },
  desc: {
    padding:     '2px 0',
    color:       'rgba(200, 230, 255, 0.8)',
    textAlign:   'left' as const,
    paddingLeft: '10px',
    fontSize:    '10px',
  },
};
