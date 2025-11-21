"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const HeroTesseract = () => {
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    console.log('[HeroTesseract] Initializing...', {
      width: canvasRef.current.clientWidth,
      height: canvasRef.current.clientHeight
    });

    // Scene setup
    const scene = new THREE.Scene();

    // Get dimensions with fallback
    const width = canvasRef.current.clientWidth || 800;
    const height = canvasRef.current.clientHeight || 600;

    const camera = new THREE.PerspectiveCamera(
      75,
      width / height,
      0.1,
      1000
    );
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0); // Transparent background
    canvasRef.current.appendChild(renderer.domElement);

    console.log('[HeroTesseract] Renderer initialized', {
      width,
      height,
      domElement: renderer.domElement
    });

    // Create tesseract (hypercube) wireframe
    const createTesseract = () => {
      const group = new THREE.Group();

      // Inner cube - bright cyan/blue
      const innerGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
      const innerEdges = new THREE.EdgesGeometry(innerGeometry);
      const innerLine = new THREE.LineSegments(
        innerEdges,
        new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 })
      );
      group.add(innerLine);

      // Outer cube - bright magenta/purple
      const outerGeometry = new THREE.BoxGeometry(2.5, 2.5, 2.5);
      const outerEdges = new THREE.EdgesGeometry(outerGeometry);
      const outerLine = new THREE.LineSegments(
        outerEdges,
        new THREE.LineBasicMaterial({ color: 0xff00ff, linewidth: 2 })
      );
      group.add(outerLine);

      // Connect inner and outer cubes - white/light gray
      const connectGeometry = new THREE.BufferGeometry();
      const positions = new Float32Array([
        -0.75, -0.75, -0.75, -1.25, -1.25, -1.25,
        0.75, -0.75, -0.75, 1.25, -1.25, -1.25,
        -0.75, 0.75, -0.75, -1.25, 1.25, -1.25,
        0.75, 0.75, -0.75, 1.25, 1.25, -1.25,
        -0.75, -0.75, 0.75, -1.25, -1.25, 1.25,
        0.75, -0.75, 0.75, 1.25, -1.25, 1.25,
        -0.75, 0.75, 0.75, -1.25, 1.25, 1.25,
        0.75, 0.75, 0.75, 1.25, 1.25, 1.25,
      ]);
      connectGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const connectLine = new THREE.LineSegments(
        connectGeometry,
        new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1 })
      );
      group.add(connectLine);

      return group;
    };

    const tesseract = createTesseract();
    scene.add(tesseract);

    // Animation
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Rotate the tesseract
      tesseract.rotation.x += 0.003;
      tesseract.rotation.y += 0.005;
      tesseract.rotation.z += 0.002;

      renderer.render(scene, camera);
    };
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
      if (canvasRef.current && renderer.domElement) {
        canvasRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="hero-tesseract">
      <div
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
