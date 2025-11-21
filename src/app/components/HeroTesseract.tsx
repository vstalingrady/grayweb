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
    let composer: any;
    const sprites: { sprite: THREE.Sprite; angle: number }[] = [];

    // Initialize
    const canvas = canvasRef.current;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setClearColor(0x000000, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    camera.position.z = 5; // Moved back to fit better

    container = new THREE.Group();
    container.scale.set(1.5, 1.5, 1.5); // Larger scale
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

    // Thicker lines for better glow
    lines = new THREE.LineSegments(geom, new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      linewidth: 2
    }));
    container.add(lines);

    // Tech Logos Sprites
    const techLogos = [
      '/images/react.png',
      '/images/python.png',
      '/images/js.png',
      '/images/html.png', // Corrected extension
      '/images/css.png',
      '/images/type.png',
      '/images/sharp.png',
      '/images/threee.png'
    ];

    const radius = 3.2;
    const textureLoader = new THREE.TextureLoader();

    techLogos.forEach((src, i) => {
      textureLoader.load(src, (tex) => {
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;

        const spriteMat = new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          opacity: 0.85,
          alphaTest: 0.05
        });

        const sprite = new THREE.Sprite(spriteMat);
        const angle = (i / techLogos.length) * Math.PI * 2;

        sprite.position.set(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          0.1
        );

        sprite.scale.set(0.5, 0.5, 0.5);

        scene.add(sprite);
        sprites.push({ sprite, angle });
      });
    });

    // Setup bloom effect
    async function setupBloom() {
      try {
        const { EffectComposer } = await import('three/examples/jsm/postprocessing/EffectComposer.js');
        const { RenderPass } = await import('three/examples/jsm/postprocessing/RenderPass.js');
        const { UnrealBloomPass } = await import('three/examples/jsm/postprocessing/UnrealBloomPass.js');

        composer = new EffectComposer(renderer);

        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        // Balanced bloom settings
        const bloomPass = new UnrealBloomPass(
          new THREE.Vector2(canvas.clientWidth, canvas.clientHeight),
          1.5,  // strength
          0.4,  // radius (reduced to prevent fog)
          0.1   // threshold (increased to exclude background)
        );
        composer.addPass(bloomPass);
      } catch (error) {
        console.error('[HeroTesseract] Failed to load bloom effect:', error);
      }
    }

    setupBloom();

    // Scroll interaction
    const handleWheel = (e: WheelEvent) => {
      scrollFactor += e.deltaY * -0.001;
      scrollFactor = Math.max(0.2, Math.min(1.5, scrollFactor));
    };
    window.addEventListener('wheel', handleWheel);

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
      const time = performance.now() * 0.001;

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

        // Pure white color
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

      container.rotation.x += speed3Dx;
      container.rotation.y += speed3Dy;

      // Update sprites
      const orbitSpeedBase = 0.0015;
      const orbitSpeed = Math.max(0.0005, orbitSpeedBase * scrollFactor);

      sprites.forEach((item) => {
        item.angle += orbitSpeed;
        const r = 3.2;
        const x = Math.cos(item.angle) * r;
        const y = Math.sin(item.angle) * r;
        item.sprite.position.set(x, y, item.sprite.position.z);
      });

      if (composer) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
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
      if (composer) {
        composer.setSize(width, height);
      }
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener('wheel', handleWheel);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      geom.dispose();
      if (lines.material instanceof THREE.Material) {
        lines.material.dispose();
      }
      sprites.forEach(({ sprite }) => {
        if (sprite.material.map) sprite.material.map.dispose();
        sprite.material.dispose();
      });
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
