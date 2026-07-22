import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
// @ts-ignore - example module ships its own runtime, types are loose
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import gsap from 'gsap';

/* ───────────────────────────────────────────────────────────────────
   HeroCanvas - Afrique holographique qui « s'éclate » pour mettre en
   valeur le Sénégal dans sa sous-région (Afrique de l'Ouest).
   Carte réelle pays-par-pays (SVG). Choreo GSAP (déclenchée à l'entrée
   dans l'écran) : 1) la carte se matérialise, 2) les pays hors zone
   explosent et s'effacent, 3) zoom sur l'Ouest, le Sénégal s'illumine.
   Décoratif (aria-hidden) - le texte indexable reste dans le DOM.
   ─────────────────────────────────────────────────────────────────── */

const AFRICA_URL = '/Africa-countries-western.svg';
const DIVISIONS = 22; // points sampled per curve segment

const COUNTRY_IDS = new Set([
  'Aegypten', 'Aequatorialguinea', 'Aethopien', 'Algerien', 'Angola', 'Benin',
  'Botsuana', 'Burkina_Faso', 'Burundi', 'Demokratische_Republik_Kongo',
  'Dschibuti', 'Elfenbeinkueste', 'Eritrea', 'Gabun', 'Gambia', 'Ghana',
  'Guinea', 'Guinea-Bissau', 'Kamerun', 'Kenia', 'Lesotho', 'Liberia', 'Libyen',
  'Madagaskar', 'Malawi', 'Mali', 'Marokko', 'Mauretanien', 'Mosambik',
  'Namibia', 'Niger', 'Nigeria', 'Republik_Kongo', 'Ruanda', 'Sambia',
  'Senegal', 'Sierra_Leone', 'Simbabwe', 'Somalia', 'Sudan', 'Suedafrika',
  'Swasiland', 'Tasania', 'Togo', 'Tschad', 'Tunesien', 'Uganda', 'Westsahara',
  'Zentralafrikanische_Republik',
]);

// Sous-région Afrique de l'Ouest - conservée comme contexte (n'explose pas).
const WEST_AFRICA = new Set([
  'Senegal', 'Mauretanien', 'Mali', 'Niger', 'Guinea', 'Guinea-Bissau',
  'Gambia', 'Sierra_Leone', 'Liberia', 'Elfenbeinkueste', 'Ghana', 'Togo',
  'Benin', 'Nigeria', 'Burkina_Faso',
]);

// Blueprint palette (normal blending, on a pearl-grey #F9FAFB panel)
const COL_OTHER = '#7CB3A2';   // muted emerald-grey (fades out anyway)
const COL_WEST = '#10B981';    // West-Africa context
const COL_SENEGAL = '#047857'; // the subject - deep brand emerald

interface Country {
  id: string;
  lines: Float32Array[];
  centroid: [number, number];
  dir: [number, number];
  rand: [number, number, number]; // x, y offset + rotation factors
  randZ: number;
  isWest: boolean;
  isSenegal: boolean;
}

interface Processed {
  countries: Country[];
  senegalGeom: THREE.ShapeGeometry | null;
  focus: [number, number];
}

function smooth(p: number, a: number, b: number): number {
  const t = THREE.MathUtils.clamp((p - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function processSVG(data: any): Processed {
  const raw: { id: string; subs: THREE.Vector2[][] }[] = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const path of data.paths) {
    const id: string = path.userData?.node?.id || '';
    if (!COUNTRY_IDS.has(id)) continue;
    const subs: THREE.Vector2[][] = [];
    for (const sp of path.subPaths) {
      const pts = sp.getPoints(DIVISIONS) as THREE.Vector2[];
      if (pts.length < 2) continue;
      subs.push(pts);
      for (const v of pts) {
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
      }
    }
    if (subs.length) raw.push({ id, subs });
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const s = 3.5 / (maxY - minY); // fit continent height to ~3.5 world units
  const tx = (x: number) => (x - cx) * s;
  const ty = (y: number) => -(y - cy) * s; // flip Y (SVG is top-down)

  const countries: Country[] = raw.map((r) => {
    let sx = 0, sy = 0, n = 0;
    const lines = r.subs.map((pts) => {
      const arr = new Float32Array(pts.length * 3);
      pts.forEach((v, i) => {
        const X = tx(v.x), Y = ty(v.y);
        arr[i * 3] = X; arr[i * 3 + 1] = Y; arr[i * 3 + 2] = 0;
        sx += X; sy += Y; n++;
      });
      return arr;
    });
    const ccx = sx / n, ccy = sy / n;
    const len = Math.hypot(ccx, ccy) || 1;
    return {
      id: r.id,
      lines,
      centroid: [ccx, ccy],
      dir: [ccx / len, ccy / len],
      rand: [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5],
      randZ: Math.random() - 0.5,
      isWest: WEST_AFRICA.has(r.id),
      isSenegal: r.id === 'Senegal',
    };
  });

  // Senegal fill (largest subpath → solid glowing shape)
  let senegalGeom: THREE.ShapeGeometry | null = null;
  let senCentroid: [number, number] = [0, 0];
  const sen = countries.find((c) => c.isSenegal);
  if (sen) {
    let best = sen.lines[0];
    for (const a of sen.lines) if (a.length > best.length) best = a;
    const sp: THREE.Vector2[] = [];
    for (let i = 0; i < best.length; i += 3) sp.push(new THREE.Vector2(best[i], best[i + 1]));
    senegalGeom = new THREE.ShapeGeometry(new THREE.Shape(sp));
    senCentroid = sen.centroid;
  }

  // West-Africa focus point, leaning towards Senegal so it reads as the subject.
  const wc = countries.filter((c) => c.isWest);
  let fx = 0, fy = 0;
  wc.forEach((c) => { fx += c.centroid[0]; fy += c.centroid[1]; });
  fx /= wc.length || 1; fy /= wc.length || 1;
  const focus: [number, number] = [
    senCentroid[0] * 0.5 + fx * 0.5,
    senCentroid[1] * 0.5 + fy * 0.5,
  ];

  return { countries, senegalGeom, focus };
}

const Scene: React.FC<{ play: boolean }> = ({ play }) => {
  const data = useLoader(SVGLoader, AFRICA_URL);
  const { countries, senegalGeom, focus } = useMemo(() => processSVG(data), [data]);

  const mapRef = useRef<THREE.Group>(null);
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const senFillRef = useRef<THREE.Mesh>(null);
  const progress = useRef({ v: 0 });
  const startedRef = useRef(false);

  useEffect(() => () => { senegalGeom?.dispose(); }, [senegalGeom]);

  // GSAP timeline, started on first view (linear; easing applied per-stage).
  useEffect(() => {
    if (!play || startedRef.current) return;
    startedRef.current = true;
    progress.current.v = 0;
    const tw = gsap.to(progress.current, { v: 1, duration: 6.4, delay: 0.25, ease: 'none' });
    return () => { tw.kill(); };
  }, [play]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const p = progress.current.v;
    const appear = smooth(p, 0.04, 0.3);     // materialisation
    const explode = smooth(p, 0.24, 0.66);   // éclatement
    const focusT = smooth(p, 0.52, 1);        // zoom Ouest / Sénégal

    for (let i = 0; i < countries.length; i++) {
      const c = countries[i];
      const g = groupRefs.current[i];
      if (!g) continue;
      const flicker = 0.82 + 0.18 * Math.sin(t * 7 + i * 1.3);

      let op: number;
      if (c.isWest) {
        g.position.set(0, 0, 0);
        g.rotation.set(0, 0, 0);
        g.scale.setScalar(1);
        op = c.isSenegal ? appear : 0.62 * appear;
        // gentle hologram breathing once settled
        op *= 0.9 + 0.1 * Math.sin(t * 1.6 + i);
      } else {
        const a = explode;
        g.position.set(
          c.dir[0] * a * 3.4 + c.rand[0] * a * 1.8,
          c.dir[1] * a * 3.4 + c.rand[1] * a * 1.8,
          c.randZ * a * 4.5
        );
        g.rotation.z = c.rand[2] * a * 1.4;
        g.rotation.x = c.rand[0] * a * 0.9;
        g.scale.setScalar(1 - 0.55 * a);
        op = (1 - explode) * 0.6;
      }

      const finalOp = op * flicker;
      const kids = g.children as THREE.Object3D[];
      for (let k = 0; k < kids.length; k++) {
        const mat = (kids[k] as any).material as THREE.Material | undefined;
        if (mat) (mat as any).opacity = finalOp;
      }
    }

    // Senegal fill glow
    if (senFillRef.current) {
      const m = senFillRef.current.material as THREE.Material as any;
      m.opacity = focusT * (0.18 + 0.05 * Math.sin(t * 2.2));
    }

    // Zoom & pan : continent entier → sous-région Ouest (Sénégal centré)
    if (mapRef.current) {
      const sc = 1 + 1.5 * focusT;
      mapRef.current.scale.setScalar(sc);
      mapRef.current.position.set(-focus[0] * sc * focusT, -focus[1] * sc * focusT, 0);
      mapRef.current.rotation.y = Math.sin(t * 0.25) * 0.05 * focusT;
    }
  });

  return (
    <group ref={mapRef}>
      {countries.map((c, i) => {
        const color = c.isSenegal ? COL_SENEGAL : c.isWest ? COL_WEST : COL_OTHER;
        return (
          <group key={c.id} ref={(el) => (groupRefs.current[i] = el)}>
            {c.lines.map((arr, j) => (
              <lineLoop key={j}>
                <bufferGeometry>
                  <bufferAttribute attach="attributes-position" args={[arr, 3]} />
                </bufferGeometry>
                <lineBasicMaterial
                  color={color}
                  transparent
                  opacity={0}
                  depthWrite={false}
                  depthTest={false}
                  toneMapped={false}
                />
              </lineLoop>
            ))}
          </group>
        );
      })}

      {senegalGeom && (
        <mesh ref={senFillRef} geometry={senegalGeom} position={[0, 0, -0.01]}>
          <meshBasicMaterial
            color="#10B981"
            transparent
            opacity={0}
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
};

/**
 * Client-only WebGL hero backdrop. Lazy-loaded by Hero.tsx behind a
 * Suspense + error boundary, so `three` never enters the SSR path and a
 * WebGL failure degrades to the static fallback.
 */
const HeroCanvas: React.FC = () => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="hero__canvas" aria-hidden="true">
      <Canvas
        frameloop={inView ? 'always' : 'never'}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, 4.6], fov: 50 }}
      >
        <Scene play={inView} />
      </Canvas>
    </div>
  );
};

export default HeroCanvas;
