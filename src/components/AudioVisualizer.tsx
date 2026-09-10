import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { audioEngine } from '../audio/engine';

type VisualizerMode = 'vortex' | 'sphere' | 'grid';

interface AudioVisualizerProps {
  hasFooter?: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ hasFooter = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<VisualizerMode>('vortex');
  const [fps, setFps] = useState(120);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07090e, 0.025);

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 32);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x07090e, 1);
    container.appendChild(renderer.domElement);

    // 3. Audio Data Buffers
    const freqData = new Uint8Array(128);
    const waveData = new Uint8Array(128);

    // 4. Visual Elements
    // (A) Particle Swarm / Vortex
    const particleCount = 1800;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleOriginals = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const radius = 6 + Math.random() * 18;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;

      const x = radius * Math.cos(theta) * Math.cos(phi);
      const y = radius * Math.sin(phi);
      const z = radius * Math.sin(theta) * Math.cos(phi);

      particlePositions[i * 3] = x;
      particlePositions[i * 3 + 1] = y;
      particlePositions[i * 3 + 2] = z;

      particleOriginals[i * 3] = x;
      particleOriginals[i * 3 + 1] = y;
      particleOriginals[i * 3 + 2] = z;

      // Cyan to purple gradient
      const t = Math.random();
      particleColors[i * 3] = 0.0 + t * 0.6; // R
      particleColors[i * 3 + 1] = 0.8 + t * 0.2; // G
      particleColors[i * 3 + 2] = 1.0; // B
    }

    particleGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(particlePositions, 3)
    );
    particleGeo.setAttribute(
      'color',
      new THREE.BufferAttribute(particleColors, 3)
    );

    const particleMat = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const particleMesh = new THREE.Points(particleGeo, particleMat);
    scene.add(particleMesh);

    // (B) Audio Reactive Polyhedron / Orb
    const sphereGeo = new THREE.IcosahedronGeometry(7, 3);
    const sphereOrigPos = sphereGeo.attributes.position.clone();
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      wireframe: true,
      roughness: 0.2,
      metalness: 0.8,
      emissive: 0x003344,
      emissiveIntensity: 0.5,
    });
    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    scene.add(sphereMesh);

    // (C) Reactive Spectrum Rings
    const ringsGroup = new THREE.Group();
    const ringCount = 32;
    const ringMeshes: THREE.Line[] = [];

    for (let r = 0; r < ringCount; r++) {
      const circleGeo = new THREE.BufferGeometry();
      const segments = 64;
      const pts = [];
      const ringRadius = 4 + r * 0.65;
      for (let s = 0; s <= segments; s++) {
        const theta = (s / segments) * Math.PI * 2;
        pts.push(
          new THREE.Vector3(
            Math.cos(theta) * ringRadius,
            Math.sin(theta) * ringRadius,
            0
          )
        );
      }
      circleGeo.setFromPoints(pts);
      const ringMat = new THREE.LineBasicMaterial({
        color: new THREE.Color().setHSL(0.5 + (r / ringCount) * 0.4, 1.0, 0.5),
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
      });
      const ringLine = new THREE.Line(circleGeo, ringMat);
      ringLine.position.z = -r * 0.8;
      ringsGroup.add(ringLine);
      ringMeshes.push(ringLine);
    }
    scene.add(ringsGroup);

    // (D) Lights
    const ambientLight = new THREE.AmbientLight(0x111622, 1.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x00f0ff, 3, 50);
    pointLight.position.set(10, 15, 20);
    scene.add(pointLight);

    const pointLight2 = new THREE.PointLight(0xff6b00, 2, 50);
    pointLight2.position.set(-15, -10, 15);
    scene.add(pointLight2);

    // 5. Interactive Tilt with Momentum (ADR 7)
    let targetRotX = 0;
    let targetRotY = 0;
    let currentRotX = 0;
    let currentRotY = 0;
    let velocityX = 0;
    let velocityY = 0;
    let prevNX = 0;
    let prevNY = 0;
    let isPointerOver = false;
    const VELOCITY_DECAY = 0.96;
    const MAX_VELOCITY = 0.08;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const rect = container.getBoundingClientRect();
      const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);

      // Track velocity for momentum
      velocityY = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, (nx - prevNX) * 0.5));
      velocityX = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, (ny - prevNY) * 0.5));
      prevNX = nx;
      prevNY = ny;

      targetRotY = nx * 1.2;
      targetRotX = ny * 0.8;
      isPointerOver = true;
    };

    const handlePointerLeave = () => {
      isPointerOver = false;
    };

    container.addEventListener('mousemove', handlePointerMove);
    container.addEventListener('touchmove', handlePointerMove, { passive: true });
    container.addEventListener('mouseleave', handlePointerLeave);

    // 6. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const height = entry.contentRect.height;
        if (width > 0 && height > 0) {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
        }
      }
    });
    resizeObserver.observe(container);

    // 7. 120Hz Animation Loop
    let animId: number;
    let frameCount = 0;
    let fpsTimer = performance.now();

    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);

      const time = clock.getElapsedTime();

      // Measure FPS
      frameCount++;
      const now = performance.now();
      if (now - fpsTimer >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - fpsTimer)));
        frameCount = 0;
        fpsTimer = now;
      }

      // Fetch Live Audio FFT Data
      audioEngine.getFrequencyData(freqData);
      audioEngine.getWaveformData(waveData);

      // Analyze Bass, Mid, Treble bands
      let bassSum = 0;
      for (let i = 0; i < 14; i++) bassSum += freqData[i];
      const bassAvg = bassSum / 14 / 255; // 0.0 to 1.0

      let midSum = 0;
      for (let i = 14; i < 60; i++) midSum += freqData[i];
      const midAvg = midSum / 46 / 255;

      let trebleSum = 0;
      for (let i = 60; i < 128; i++) trebleSum += freqData[i];
      const trebleAvg = trebleSum / 68 / 255;

      // Smooth camera tilt with momentum (ADR 7)
      if (isPointerOver) {
        // Snappy follow when pointer is active
        currentRotX += (targetRotX - currentRotX) * 0.12;
        currentRotY += (targetRotY - currentRotY) * 0.12;
      } else {
        // Apply momentum drift when pointer is gone
        targetRotX += velocityX;
        targetRotY += velocityY;
        // Clamp target rotation
        targetRotX = Math.max(-0.8, Math.min(0.8, targetRotX));
        targetRotY = Math.max(-1.2, Math.min(1.2, targetRotY));
        currentRotX += (targetRotX - currentRotX) * 0.06;
        currentRotY += (targetRotY - currentRotY) * 0.06;
        // Decay velocity
        velocityX *= VELOCITY_DECAY;
        velocityY *= VELOCITY_DECAY;
      }
      scene.rotation.x = currentRotX;
      scene.rotation.y = currentRotY;

      // Reactivity logic according to active mode
      if (mode === 'vortex') {
        particleMesh.visible = true;
        sphereMesh.visible = true;
        ringsGroup.visible = true;

        // Swirl particles
        particleMesh.rotation.y = time * 0.15 + midAvg * 0.5;
        particleMesh.rotation.z = time * 0.05;

        const posAttr = particleGeo.attributes.position;
        const posArray = posAttr.array as Float32Array;

        for (let i = 0; i < particleCount; i++) {
          const bin = i % 128;
          const energy = freqData[bin] / 255;
          const ox = particleOriginals[i * 3];
          const oy = particleOriginals[i * 3 + 1];
          const oz = particleOriginals[i * 3 + 2];

          const pulse = 1 + energy * 0.45 + bassAvg * 0.25;
          posArray[i * 3] = ox * pulse;
          posArray[i * 3 + 1] = oy * pulse;
          posArray[i * 3 + 2] = oz * pulse;
        }
        posAttr.needsUpdate = true;

        // Pulse inner sphere
        const orbScale = 0.8 + bassAvg * 0.55;
        sphereMesh.scale.set(orbScale, orbScale, orbScale);
        sphereMesh.rotation.x = time * 0.2;
        sphereMesh.rotation.y = time * 0.3;

        // Tunnel rings motion
        ringsGroup.position.z = (time * 6) % 0.8;
      } else if (mode === 'sphere') {
        particleMesh.visible = false;
        ringsGroup.visible = false;
        sphereMesh.visible = true;

        const orbScale = 1.3 + bassAvg * 0.8;
        sphereMesh.scale.set(orbScale, orbScale, orbScale);
        sphereMesh.rotation.x += 0.005 + midAvg * 0.02;
        sphereMesh.rotation.y += 0.008 + trebleAvg * 0.02;

        // Deform vertices with waveform data
        const pos = sphereGeo.attributes.position;
        const orig = sphereOrigPos.array as Float32Array;
        const current = pos.array as Float32Array;

        for (let i = 0; i < pos.count; i++) {
          const u = (waveData[i % 128] - 128) / 128;
          const displacement = 1 + u * 0.25 * (bassAvg + 0.5);
          current[i * 3] = orig[i * 3] * displacement;
          current[i * 3 + 1] = orig[i * 3 + 1] * displacement;
          current[i * 3 + 2] = orig[i * 3 + 2] * displacement;
        }
        pos.needsUpdate = true;
      } else {
        // Grid mode
        particleMesh.visible = true;
        sphereMesh.visible = false;
        ringsGroup.visible = true;
        ringsGroup.rotation.x = Math.PI / 2;
        ringsGroup.position.z = -10 + bassAvg * 4;
      }

      // Lights dynamic flicker
      pointLight.intensity = 2.0 + bassAvg * 4.0;
      pointLight2.intensity = 1.5 + trebleAvg * 3.5;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      container.removeEventListener('mousemove', handlePointerMove);
      container.removeEventListener('touchmove', handlePointerMove);
      container.removeEventListener('mouseleave', handlePointerLeave);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      particleGeo.dispose();
      particleMat.dispose();
      sphereGeo.dispose();
      sphereMat.dispose();
      renderer.dispose();
    };
  }, [mode]);

  return (
    <>
      {/* Full-Bleed Background Canvas (ADR 6) */}
      <div
        ref={containerRef}
        className="fixed inset-0 z-0"
      />

      {/* Floating Visualizer Controls Pill */}
      <div
        className={`fixed right-3 sm:right-4 z-30 flex items-center gap-1.5 bg-studio-950/80 backdrop-blur-md p-1 rounded-xl border border-white/10 shadow-lg transition-all duration-200 ${
          hasFooter ? 'bottom-28 sm:bottom-28' : 'bottom-6 sm:bottom-6'
        }`}
      >
        {(['vortex', 'sphere', 'grid'] as VisualizerMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-2 py-1 rounded-lg text-[10px] font-mono uppercase transition-all cursor-pointer font-bold ${
              mode === m
                ? 'bg-white text-black shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {m}
          </button>
        ))}
        <span className="text-[10px] font-mono text-slate-300 font-bold border-l border-white/10 pl-1.5 ml-0.5">
          {fps}
        </span>
      </div>
    </>
  );
};
