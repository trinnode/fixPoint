"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import styles from "./fx.module.css";

type HeroSceneProps = {
  className?: string;
};

/**
 * Read a component token at runtime so canvas hues track the fx module.
 * Reads from the scene host (inside .hero, where the tokens are defined).
 */
function token(host: Element, name: string, fallback: string): string {
  try {
    const v = getComputedStyle(host).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

/** Deterministic PRNG so the constellation is stable across mounts. */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Lightweight three.js backdrop: a slowly rotating wireframe icosahedron with
 * hashgraph-style DAG nodes (points + short constellation lines) and one soft
 * accent glow sprite. No window access at module scope; everything runs inside
 * the effect so `next build` never touches the DOM.
 */
export default function HeroScene({ className }: HeroSceneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const hostEl: HTMLDivElement = host;
    const canvasEl: HTMLCanvasElement = canvas;

    let disposed = false;
    let raf = 0;
    let tabVisible = !document.hidden;
    let inView = true;

    async function init(): Promise<() => void> {
      let THREE: typeof import("three");
      try {
        THREE = await import("three");
      } catch {
        if (!disposed) setFailed(true);
        return () => {};
      }
      if (disposed) return () => {};

      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          canvas: canvasEl,
          alpha: true,
          antialias: true,
          powerPreference: "low-power",
        });
      } catch {
        if (!disposed) setFailed(true);
        return () => {};
      }

      const cleanups: Array<() => void> = [];
      const track = <T extends { dispose: () => void }>(obj: T): T => {
        cleanups.push(() => obj.dispose());
        return obj;
      };

      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.set(0, 0.4, 7.4);

      const toColor = (cssVar: string, fallback: string): import("three").Color => {
        try {
          return new THREE.Color(token(hostEl, cssVar, fallback));
        } catch {
          return new THREE.Color(fallback);
        }
      };
      const lineColor = toColor("--fx-line", "#8fb4d8");
      const accentColor = toColor("--fx-accent", "#c9a24b");
      const nodeColor = toColor("--fx-ink", "#f2ede2");

      const group = new THREE.Group();
      scene.add(group);

      // Core: wireframe icosahedron shell.
      const shellGeo = track(new THREE.IcosahedronGeometry(2.1, 1));
      const shell = new THREE.LineSegments(
        track(new THREE.EdgesGeometry(shellGeo)),
        track(
          new THREE.LineBasicMaterial({
            color: lineColor,
            transparent: true,
            opacity: 0.42,
          })
        )
      );
      group.add(shell);

      // DAG nodes: deterministic points scattered on a shell around the core.
      const rand = mulberry32(20260729);
      const COUNT = 90;
      const positions = new Float32Array(COUNT * 3);
      const pts: Array<[number, number, number]> = [];
      for (let i = 0; i < COUNT; i++) {
        const theta = rand() * Math.PI * 2;
        const phi = Math.acos(2 * rand() - 1);
        const r = 2.7 + rand() * 0.9;
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta) * 0.72;
        const z = r * Math.cos(phi) * 0.6;
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        pts.push([x, y, z]);
      }
      const pointsGeo = track(new THREE.BufferGeometry());
      pointsGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const points = new THREE.Points(
        pointsGeo,
        track(
          new THREE.PointsMaterial({
            color: nodeColor,
            size: 0.055,
            transparent: true,
            opacity: 0.75,
            sizeAttenuation: true,
          })
        )
      );
      group.add(points);

      // Constellation lines: join near neighbours, hashgraph-gossip style.
      const LINK = 1.15;
      const linkVerts: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i][0] - pts[j][0];
          const dy = pts[i][1] - pts[j][1];
          const dz = pts[i][2] - pts[j][2];
          if (dx * dx + dy * dy + dz * dz < LINK * LINK) {
            linkVerts.push(pts[i][0], pts[i][1], pts[i][2], pts[j][0], pts[j][1], pts[j][2]);
          }
        }
      }
      const linkGeo = track(new THREE.BufferGeometry());
      linkGeo.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(linkVerts), 3)
      );
      const links = new THREE.LineSegments(
        linkGeo,
        track(
          new THREE.LineBasicMaterial({
            color: lineColor,
            transparent: true,
            opacity: 0.22,
          })
        )
      );
      group.add(links);

      // One soft accent glow sprite behind the core.
      const glowCanvas = document.createElement("canvas");
      glowCanvas.width = 128;
      glowCanvas.height = 128;
      const ctx = glowCanvas.getContext("2d");
      if (ctx) {
        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, "rgba(255,255,255,0.85)");
        grad.addColorStop(0.4, "rgba(255,255,255,0.22)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);
      }
      const glowTex = track(new THREE.CanvasTexture(glowCanvas));
      const glow = new THREE.Sprite(
        track(
          new THREE.SpriteMaterial({
            map: glowTex,
            color: accentColor,
            transparent: true,
            opacity: 0.28,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        )
      );
      glow.scale.set(9, 9, 1);
      glow.position.set(0, 0, -2.2);
      scene.add(glow);

      const resize = (): void => {
        const w = hostEl.clientWidth || 1;
        const h = hostEl.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        if (reduced) renderer.render(scene, camera);
      };
      resize();

      const ro = new ResizeObserver(resize);
      ro.observe(hostEl);

      const io = new IntersectionObserver(
        (entries) => {
          inView = entries[0]?.isIntersecting ?? true;
        },
        { threshold: 0 }
      );
      io.observe(hostEl);

      const onVisibility = (): void => {
        tabVisible = !document.hidden;
      };
      document.addEventListener("visibilitychange", onVisibility);

      if (reduced) {
        // One static frame; observers still keep it correct on resize.
        renderer.render(scene, camera);
      } else {
        const clock = new THREE.Clock();
        const tick = (): void => {
          if (disposed) return;
          raf = requestAnimationFrame(tick);
          if (!tabVisible || !inView) return;
          const t = clock.getElapsedTime();
          group.rotation.y += 0.0018;
          group.rotation.x = Math.sin(t * 0.12) * 0.1;
          glow.material.opacity = 0.24 + Math.sin(t * 0.4) * 0.05;
          renderer.render(scene, camera);
        };
        tick();
      }

      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        scene.traverse((obj) => {
          const mesh = obj as import("three").Mesh;
          const mat = mesh.material as
            | { dispose?: () => void }
            | Array<{ dispose?: () => void }>
            | undefined;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.());
          else mat?.dispose?.();
          const geo = (mesh as { geometry?: { dispose?: () => void } }).geometry;
          geo?.dispose?.();
        });
        cleanups.forEach((fn) => {
          try {
            fn();
          } catch {
            /* already torn down */
          }
        });
        renderer.dispose();
      };
    }

    let teardown: (() => void) | undefined;
    init().then((fn) => {
      teardown = fn;
      if (disposed) fn();
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      teardown?.();
    };
  }, []);

  return (
    <div ref={hostRef} className={cn(styles.sceneHost, className)}>
      {!failed && (
        <canvas ref={canvasRef} className={styles.sceneCanvas} aria-hidden="true" />
      )}
      <div className={styles.sceneFallback} aria-hidden="true" />
    </div>
  );
}
