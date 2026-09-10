import * as THREE from 'three';
import {
  ModeContext,
  ModeId,
  QualityTier,
  StudioVisualization,
  Viewport,
  VisualizationFrame,
} from '../types';
import { decayVelocity, smoothFollow } from '../motion';

interface Shockwave {
  active: boolean;
  radius: number;
  maxRadius: number;
  speed: number;
  strength: number;
}

export class GravityVisualization implements StudioVisualization {
  public readonly id: ModeId = 'gravity';

  private context: ModeContext | null = null;
  private rootGroup: THREE.Group = new THREE.Group();

  private particleCount = 2000;
  private particleGeometry: THREE.BufferGeometry = new THREE.BufferGeometry();
  private particleMaterial: THREE.PointsMaterial = new THREE.PointsMaterial();
  private particleMesh: THREE.Points = new THREE.Points();

  private positions: Float32Array = new Float32Array(0);
  private colors: Float32Array = new Float32Array(0);
  private baseRadius: Float32Array = new Float32Array(0);
  private angles: Float32Array = new Float32Array(0);
  private speeds: Float32Array = new Float32Array(0);
  private streamIds: Uint8Array = new Uint8Array(0);
  private verticalOffsets: Float32Array = new Float32Array(0);

  // Audio envelopes
  private smoothedBass = 0;
  private smoothedMids = 0;
  private smoothedHighs = 0;
  private orbitalPrecession = 0;

  // Shockwaves for transients
  private shockwaves: Shockwave[] = [];
  private readonly MAX_SHOCKWAVES = 4;

  // Hand interaction
  private handX = 0;
  private handY = 0;
  private handActive = false;
  private handPressed = false;
  private residualCirculation = 0;

  public init(context: ModeContext): void {
    this.context = context;
    this.rootGroup = new THREE.Group();
    context.root.add(this.rootGroup);

    context.camera.fov = 60;
    context.camera.position.set(0, 0, 32);
    context.camera.updateProjectionMatrix();

    this.shockwaves = [];
    for (let i = 0; i < this.MAX_SHOCKWAVES; i++) {
      this.shockwaves.push({
        active: false,
        radius: 0,
        maxRadius: 28,
        speed: 18,
        strength: 0,
      });
    }

    this.buildParticles();
  }

  private buildParticles(): void {
    this.particleGeometry.dispose();
    this.particleMaterial.dispose();
    if (this.rootGroup.children.includes(this.particleMesh)) {
      this.rootGroup.remove(this.particleMesh);
    }

    const n = this.particleCount;
    this.positions = new Float32Array(n * 3);
    this.colors = new Float32Array(n * 3);
    this.baseRadius = new Float32Array(n);
    this.angles = new Float32Array(n);
    this.speeds = new Float32Array(n);
    this.streamIds = new Uint8Array(n);
    this.verticalOffsets = new Float32Array(n);

    // 4 orbital streams
    const streamRadii = [6.0, 11.0, 16.5, 22.0];
    const streamColors = [
      new THREE.Color(0x00f0ff), // Cyan (inner)
      new THREE.Color(0x6366f1), // Indigo
      new THREE.Color(0x38bdf8), // Sky blue
      new THREE.Color(0xf59e0b), // Amber spark stream (outer)
    ];

    for (let i = 0; i < n; i++) {
      const sId = i % 4;
      this.streamIds[i] = sId;

      const rBase = streamRadii[sId] + (Math.random() - 0.5) * 2.5;
      this.baseRadius[i] = rBase;

      this.angles[i] = Math.random() * Math.PI * 2;
      // Keplerian-like speed (inner streams rotate faster)
      this.speeds[i] = (2.2 / Math.sqrt(Math.max(1, rBase))) * (0.85 + Math.random() * 0.3);
      this.verticalOffsets[i] = (Math.random() - 0.5) * (1.5 + sId * 0.8);

      const col = streamColors[sId].clone();
      // Slight variation
      col.offsetHSL((Math.random() - 0.5) * 0.05, 0, (Math.random() - 0.5) * 0.1);

      this.colors[i * 3] = col.r;
      this.colors[i * 3 + 1] = col.g;
      this.colors[i * 3 + 2] = col.b;
    }

    this.particleGeometry = new THREE.BufferGeometry();
    this.particleGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3)
    );
    this.particleGeometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.colors, 3)
    );

    this.particleMaterial = new THREE.PointsMaterial({
      size: 0.42,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particleMesh = new THREE.Points(this.particleGeometry, this.particleMaterial);
    this.rootGroup.add(this.particleMesh);
  }

  public update(frame: VisualizationFrame): void {
    const { dt, audio, input, reducedMotion, presentation } = frame;

    this.smoothedBass = smoothFollow(this.smoothedBass, audio.bass, 8.0, dt);
    this.smoothedMids = smoothFollow(this.smoothedMids, audio.mids, 6.0, dt);
    this.smoothedHighs = smoothFollow(this.smoothedHighs, audio.highs, 10.0, dt);

    // Baseline precession
    this.orbitalPrecession += dt * (reducedMotion ? 0.02 : 0.08);

    // Transient trigger shockwaves
    for (let i = 0; i < audio.eventCount; i++) {
      this.triggerShockwave(audio.events[i].strength);
    }

    // Update active shockwaves
    for (let i = 0; i < this.shockwaves.length; i++) {
      const sw = this.shockwaves[i];
      if (!sw.active) continue;
      sw.radius += sw.speed * dt;
      if (sw.radius > sw.maxRadius) {
        sw.active = false;
      }
    }

    // Interaction handling
    this.updateInteraction(input, dt);

    // Particle positions update
    this.updateParticles(dt, reducedMotion, presentation);
  }

  private triggerShockwave(strength: number): void {
    const sw = this.shockwaves.find((s) => !s.active);
    if (sw) {
      sw.active = true;
      sw.radius = 2.0;
      sw.strength = Math.min(1.0, strength);
    }
  }

  private updateInteraction(input: VisualizationFrame['input'], dt: number): void {
    this.handActive = input.active;
    this.handPressed = input.pressed;
    this.handX = input.x * 16.0;
    this.handY = input.y * 10.0;

    if (input.justReleased) {
      // Residual circulation from fling / swipe
      const speed = Math.sqrt(input.velocityX * input.velocityX + input.velocityY * input.velocityY);
      this.residualCirculation = Math.min(3.0, speed * 0.45);
    }

    if (input.cancelled) {
      this.residualCirculation = 0;
      this.handPressed = false;
      this.handActive = false;
    }

    // Decay residual circulation
    this.residualCirculation = decayVelocity(this.residualCirculation, 2.5, dt);
  }

  private updateParticles(dt: number, reducedMotion: boolean, presentation: string): void {
    const n = this.particleCount;
    const pos = this.positions;

    // Integrated mid circulation boost
    const midCircBoost = this.smoothedMids * 1.5 + this.residualCirculation;
    const streamSpeedMult = presentation === 'chill' ? 1.25 : 1.0;

    for (let i = 0; i < n; i++) {
      const sId = this.streamIds[i];

      // Advance orbital angle
      const speed = this.speeds[i] * streamSpeedMult * (1.0 + midCircBoost);
      this.angles[i] += speed * dt;

      const angle = this.angles[i] + this.orbitalPrecession;
      let r = this.baseRadius[i];

      // Bass compression followed by outward wave
      if (!reducedMotion) {
        const bassPulse = (Math.sin(angle * 2.0 - this.smoothedBass * 4.0) * 0.5 + 0.5) * this.smoothedBass;
        r += (bassPulse * 3.0 - this.smoothedBass * 1.2);
      }

      // Shockwave disturbances
      for (let s = 0; s < this.shockwaves.length; s++) {
        const sw = this.shockwaves[s];
        if (!sw.active) continue;
        const distToWave = Math.abs(r - sw.radius);
        if (distToWave < 3.0) {
          const waveFalloff = Math.cos((distToWave / 3.0) * (Math.PI * 0.5));
          r += waveFalloff * sw.strength * 2.2;
        }
      }

      // Base stream orbital coordinate in inclined plane
      const streamTilt = (sId * 0.22) - 0.3;
      let px = Math.cos(angle) * r;
      let py = Math.sin(angle) * r * Math.cos(streamTilt);
      let pz = Math.sin(angle) * r * Math.sin(streamTilt) + this.verticalOffsets[i];

      // Highs spark perturbation on outer streams
      if (sId === 3 && !reducedMotion) {
        const spark = Math.sin(this.angles[i] * 12.0) * this.smoothedHighs * 0.8;
        pz += spark;
      }

      // Hand attractor / repulsor force
      if (this.handActive) {
        const dx = this.handX - px;
        const dy = this.handY - py;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        if (dist < 10.0 && dist > 0.05) {
          const force = (1.0 - dist / 10.0) * (this.handPressed ? 3.5 : 1.2);
          // Curve around hand with soft attraction
          px += (dx / dist) * force;
          py += (dy / dist) * force;
          pz += force * 0.5;
        }
      }

      pos[i * 3] = px;
      pos[i * 3 + 1] = py;
      pos[i * 3 + 2] = pz;
    }

    this.particleGeometry.attributes.position.needsUpdate = true;
  }

  public resize(viewport: Viewport): void {
    if (this.context) {
      this.context.viewport = viewport;
    }
  }

  public setQuality(quality: QualityTier): void {
    if (quality === 'low') {
      this.particleCount = 1000;
    } else if (quality === 'balanced') {
      this.particleCount = 1500;
    } else {
      this.particleCount = 2000;
    }
    this.buildParticles();
  }

  public setVisible(visible: boolean): void {
    this.rootGroup.visible = visible;
  }

  public reset(_reason: string): void {
    this.shockwaves.forEach((s) => (s.active = false));
    this.residualCirculation = 0;
  }

  public dispose(): void {
    this.particleGeometry.dispose();
    this.particleMaterial.dispose();
    while (this.rootGroup.children.length > 0) {
      const c = this.rootGroup.children[0];
      this.rootGroup.remove(c);
    }
  }
}
