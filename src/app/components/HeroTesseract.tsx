"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const HeroTesseract = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer;
    let container: THREE.Group;
    let lines: THREE.LineSegments;
    let angle4D = 0;
    const speed4D = 0.005;
    const speed3Dx = 0.005;
    const speed3Dy = 0.002;
    const d = 3;
    let scrollFactor = 1;
    let animationFrameId: number;

    // Initialize
    const canvas = canvasRef.current;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setClearColor(0x000000, 1); // Pure black background

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    camera.position.z = 5;

    container = new THREE.Group();
    container.scale.set(1.2, 1.2, 1.2); // Bigger tesseract
    scene.add(container);

    // Create 4D hypercube vertices
    const pts: THREE.Vector4[] = [];
    [-1, 1].forEach(x =>
      [-1, 1].forEach(y =>
        [-1, 1].forEach(z =>
          [-1, 1].forEach(w =>
            pts.push(new THREE.Vector4(x, y, z, w))
          ))));

    // Create edges
    const edges: [number, number][] = [];
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        let diff = 0;
        (['x', 'y', 'z', 'w'] as const).forEach(c => {
          if (pts[i][c] !== pts[j][c]) diff++;
        });
        if (diff === 1) edges.push([i, j]);
      }
    }

    const pos = new Float32Array(edges.length * 2 * 3);
    const colors = new Float32Array(edges.length * 2 * 3);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Create main bright lines
    lines = new THREE.LineSegments(geom, new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      linewidth: 2
    }));
    container.add(lines);

    // Add glow layers - multiple semi-transparent copies for bloom effect
    const glowGeom1 = geom.clone();
    const glowLines1 = new THREE.LineSegments(glowGeom1, new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.3,
      linewidth: 4
    }));
    container.add(glowLines1);

    const glowGeom2 = geom.clone();
    const glowLines2 = new THREE.LineSegments(glowGeom2, new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.15,
      linewidth: 6
    }));
    container.add(glowLines2);

    // Store glow geometries for updates
    const glowGeometries = [glowGeom1, glowGeom2];

    // 4D rotation
    function rotate4D(v: THREE.Vector4, a: number): THREE.Vector4 {
      const x = v.x * Math.cos(a) - v.y * Math.sin(a);
      const y = v.x * Math.sin(a) + v.y * Math.cos(a);
      const z = v.z * Math.cos(a) - v.w * Math.sin(a);
      const w = v.z * Math.sin(a) + v.w * Math.cos(a);
      return new THREE.Vector4(x, y, z, w);
    }

    // Animation loop
    function animate() {
      animationFrameId = requestAnimationFrame(animate);
      angle4D += speed4D * scrollFactor;

      const projected = pts.map(v => {
        const rv = rotate4D(v, angle4D);
        const f = d / (d - rv.w);
        return new THREE.Vector3(rv.x * f, rv.y * f, rv.z * f);
      });

      for (let i = 0; i < edges.length; i++) {
        const edge = edges[i];
        const p1 = projected[edge[0]];
        const p2 = projected[edge[1]];
        pos.set([p1.x, p1.y, p1.z, p2.x, p2.y, p2.z], i * 6);

        // White color
        const r = 1.0;
        const g = 1.0;
        const b = 1.0;

        for (let j = 0; j < 2; j++) {
          const idx = (i * 2 + j) * 3;
          colors[idx] = r;
          colors[idx + 1] = g;
          colors[idx + 2] = b;
        }
      }

      lines.geometry.attributes.position.needsUpdate = true;
      lines.geometry.attributes.color.needsUpdate = true;

      // Update glow layers
      glowGeometries.forEach(glowGeom => {
        const glowPos = glowGeom.attributes.position.array as Float32Array;
        const glowColors = glowGeom.attributes.color.array as Float32Array;
        glowPos.set(pos);
        glowColors.set(colors);
        glowGeom.attributes.position.needsUpdate = true;
        glowGeom.attributes.color.needsUpdate = true;
      });

      container.rotation.x += speed3Dx;
      container.rotation.y += speed3Dy;
      renderer.render(scene, camera);
    }

    animate();

    // Handle resize
    const handleResize = () => {
      if (!canvasRef.current) return;
      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      geom.dispose();
      if (lines.material instanceof THREE.Material) {
        lines.material.dispose();
      }
    };
  }, []);

  return (
    <div className="hero-tesseract">
      <canvas
        ref={canvasRef}
        className="hero-tesseract__canvas"
        style={{
          width: "100%",
          height: "100%",
        }}
        aria-hidden
      />
    </div>
  );
};

export default HeroTesseract;
