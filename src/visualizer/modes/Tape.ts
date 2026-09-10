import * as THREE from 'three';
import {
  ModeContext,
  ModeId,
  QualityTier,
  StudioVisualization,
  Viewport,
  VisualizationFrame,
} from '../types';
import { DampedSpring, smoothFollow } from '../motion';

interface TravelingPulse {
  active: boolean;
  u: number;         // 0..1 current position along ribbon
  speed: number;     // propagation speed per second
  strength: number;  // 0..1
  width: number;     // spread along u
  decayRate: number; // strength reduction per second
}

interface RibbonMesh {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
  positions: Float32Array;
  colors: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
  spineLength: number;
  width: number;
  depthZ: number;
  phaseOffset: number;
  baseColor: THREE.Color;
  accentColor: THREE.Color;
}

const TAPE_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vColor;

  attribute vec3 customColor;

  void main() {
    vUv = uv;
    vColor = customColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    vNormal = normalMatrix * normal;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const TAPE_FRAGMENT_SHADER = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vColor;

  uniform float uEdgeGlow;
  uniform float uPulseGlow;
  uniform vec3 uAccentColor;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    // Fresnel / grazing angle edge illumination
    float fresnel = 1.0 - abs(dot(normal, viewDir));
    fresnel = pow(fresnel, 2.0);

    // Ribbon edge distance (0 at center, 1 at boundaries)
    float edgeDist = abs(vUv.y - 0.5) * 2.0;
    float edgeLine = smoothstep(0.70, 1.0, edgeDist) * 1.8;

    vec3 baseCol = vColor;
    vec3 glowCol = mix(baseCol, uAccentColor, 0.4);

    vec3 finalColor = mix(baseCol * 0.4, glowCol, edgeLine + fresnel * 0.6);
    finalColor += uAccentColor * (uPulseGlow * (1.0 - edgeDist * 0.5));

    gl_FragColor = vec4(finalColor, 0.92);
  }
`;

export class TapeVisualization implements StudioVisualization {
  public readonly id: ModeId = 'tape';

  private context: ModeContext | null = null;
  private rootGroup: THREE.Group = new THREE.Group();

  private ribbons: RibbonMesh[] = [];
  private numSpinePoints = 128;

  // Flow & Dynamics
  private flowPhase = 0;
  private smoothedBass = 0;
  private smoothedMids = 0;
  private smoothedHighs = 0;
  private smoothedSpeed = 1.0;

  // Transient pulses pool
  private pulses: TravelingPulse[] = [];
  private readonly MAX_PULSES = 8;

  // Hand interaction physics
  private grabSpringX = new DampedSpring(0, 14, 0.72);
  private grabSpringY = new DampedSpring(0, 14, 0.72);
  private grabbedRibbonIndex = -1;
  private grabbedU = 0.5;
  private grabInfluenceRadius = 0.22;
  private isGrabbed = false;
  private waveReleaseAmp = 0;
  private waveReleaseTime = 0;

  public init(context: ModeContext): void {
    this.context = context;
    this.rootGroup = new THREE.Group();
    context.root.add(this.rootGroup);

    // Set camera suitable for wide ribbon flow
    context.camera.fov = 55;
    context.camera.position.set(0, 0, 30);
    context.camera.updateProjectionMatrix();

    // Initialize pulse pool
    this.pulses = [];
    for (let i = 0; i < this.MAX_PULSES; i++) {
      this.pulses.push({
        active: false,
        u: 0,
        speed: 0.8,
        strength: 0,
        width: 0.12,
        decayRate: 1.2,
      });
    }

    this.buildRibbons();
  }

  private buildRibbons(): void {
    // Clear previous ribbons
    while (this.rootGroup.children.length > 0) {
      const c = this.rootGroup.children[0];
      this.rootGroup.remove(c);
    }
    this.ribbons.forEach((r) => {
      r.geometry.dispose();
      r.material.dispose();
    });
    this.ribbons = [];

    const ribbonConfigs = [
      {
        width: 2.2,
        depthZ: 4.0,
        phaseOffset: 0.0,
        baseColor: new THREE.Color(0x00f0ff), // Cyan
        accentColor: new THREE.Color(0xffaa00), // Warm amber pulse
      },
      {
        width: 1.6,
        depthZ: -3.0,
        phaseOffset: 1.8,
        baseColor: new THREE.Color(0x4f46e5), // Indigo
        accentColor: new THREE.Color(0x00f0ff),
      },
      {
        width: 1.2,
        depthZ: -8.0,
        phaseOffset: 3.6,
        baseColor: new THREE.Color(0x0ea5e9), // Sky blue
        accentColor: new THREE.Color(0xff4488),
      },
    ];

    const segs = this.numSpinePoints;
    const vertexCount = (segs + 1) * 2;
    const indexCount = segs * 6;

    ribbonConfigs.forEach((cfg) => {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(vertexCount * 3);
      const colors = new Float32Array(vertexCount * 3);
      const normals = new Float32Array(vertexCount * 3);
      const uvs = new Float32Array(vertexCount * 2);
      const indices = new Uint16Array(indexCount);

      // Pre-fill indices
      let idx = 0;
      for (let i = 0; i < segs; i++) {
        const v0 = i * 2;
        const v1 = i * 2 + 1;
        const v2 = (i + 1) * 2;
        const v3 = (i + 1) * 2 + 1;

        indices[idx++] = v0;
        indices[idx++] = v1;
        indices[idx++] = v2;

        indices[idx++] = v2;
        indices[idx++] = v1;
        indices[idx++] = v3;
      }

      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

      const material = new THREE.ShaderMaterial({
        vertexShader: TAPE_VERTEX_SHADER,
        fragmentShader: TAPE_FRAGMENT_SHADER,
        uniforms: {
          uEdgeGlow: { value: 1.0 },
          uPulseGlow: { value: 0.0 },
          uAccentColor: { value: cfg.accentColor },
        },
        side: THREE.DoubleSide,
        transparent: true,
        blending: THREE.NormalBlending,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(geometry, material);
      this.rootGroup.add(mesh);

      this.ribbons.push({
        mesh,
        geometry,
        material,
        positions,
        colors,
        normals,
        uvs,
        indices,
        spineLength: segs,
        width: cfg.width,
        depthZ: cfg.depthZ,
        phaseOffset: cfg.phaseOffset,
        baseColor: cfg.baseColor,
        accentColor: cfg.accentColor,
      });
    });
  }

  public update(frame: VisualizationFrame): void {
    const { dt, audio, input, reducedMotion, presentation } = frame;

    // Smooth incoming audio envelopes
    this.smoothedBass = smoothFollow(this.smoothedBass, audio.bass, 8.0, dt);
    this.smoothedMids = smoothFollow(this.smoothedMids, audio.mids, 6.0, dt);
    this.smoothedHighs = smoothFollow(this.smoothedHighs, audio.highs, 12.0, dt);

    const targetSpeed = Math.max(0.25, Math.min(3.0, audio.playbackRate || 1.0));
    this.smoothedSpeed = smoothFollow(this.smoothedSpeed, targetSpeed, 3.0, dt);

    // Continuous baseline flow (even in silence/pause)
    const baseFlowRate = reducedMotion ? 0.05 : 0.45;
    this.flowPhase += dt * baseFlowRate * (audio.playing ? this.smoothedSpeed : 0.7);

    // Handle new transient events
    for (let i = 0; i < audio.eventCount; i++) {
      const tr = audio.events[i];
      this.emitPulse(tr.strength, tr.kind === 'low-band' ? 0.6 : 0.9);
    }

    // Update active traveling pulses
    this.updatePulses(dt);

    // Update hand interaction
    this.updateInteraction(input, dt);

    // Update ribbon geometries
    this.updateRibbons(dt, reducedMotion, presentation);
  }

  private emitPulse(strength: number, speed: number): void {
    const pulse = this.pulses.find((p) => !p.active);
    if (pulse) {
      pulse.active = true;
      pulse.u = 0;
      pulse.speed = speed;
      pulse.strength = Math.max(0.3, Math.min(1.0, strength));
      pulse.width = 0.14;
      pulse.decayRate = 0.9;
    }
  }

  private updatePulses(dt: number): void {
    for (let i = 0; i < this.pulses.length; i++) {
      const p = this.pulses[i];
      if (!p.active) continue;
      p.u += p.speed * dt;
      p.strength -= p.decayRate * dt;
      if (p.u > 1.2 || p.strength <= 0) {
        p.active = false;
      }
    }
  }

  private updateInteraction(input: VisualizationFrame['input'], dt: number): void {
    if (input.justPressed) {
      // Find nearest ribbon to grab
      this.grabbedRibbonIndex = 0; // Grab flagship foreground ribbon
      this.grabbedU = Math.max(0.1, Math.min(0.9, (input.x + 1) * 0.5));

      this.isGrabbed = true;
      this.grabSpringX.reset(0);
      this.grabSpringY.reset(0);
      this.grabSpringX.target = 0;
      this.grabSpringY.target = 0;
      this.waveReleaseAmp = 0;
    }

    if (this.isGrabbed && input.pressed) {
      // Dragging: offset spring target based on pointer movement
      this.grabSpringX.target = input.velocityX * 0.25;
      this.grabSpringY.target = input.velocityY * 0.25;
      this.grabSpringX.update(dt);
      this.grabSpringY.update(dt);
    }

    if (input.justReleased && this.isGrabbed) {
      // Release: inject traveling wave based on release speed
      const speed = Math.sqrt(input.velocityX * input.velocityX + input.velocityY * input.velocityY);
      this.waveReleaseAmp = Math.min(2.5, speed * 0.8 + 0.3);
      this.waveReleaseTime = 0;
      this.isGrabbed = false;

      // Also inject a traveling pulse into the tape
      this.emitPulse(Math.min(1.0, speed * 0.3 + 0.4), 1.1);
    }

    if (input.cancelled) {
      this.isGrabbed = false;
      this.grabSpringX.reset(0);
      this.grabSpringY.reset(0);
      this.waveReleaseAmp = 0;
    }

    // Decay release wave
    if (!this.isGrabbed && this.waveReleaseAmp > 0.001) {
      this.waveReleaseTime += dt;
      this.waveReleaseAmp *= Math.exp(-dt * 2.8); // Settles in ~0.8s
    }
  }

  private updateRibbons(_dt: number, reducedMotion: boolean, presentation: string): void {
    const spinePts = this.numSpinePoints;

    this.ribbons.forEach((ribbon, rIdx) => {
      const {
        geometry,
        positions,
        colors,
        normals,
        uvs,
        width,
        depthZ,
        phaseOffset,
        baseColor,
        accentColor,
        material,
      } = ribbon;

      let maxPulseVal = 0;

      // Span across viewport in an elegant S-curve
      const spanX = 36.0;
      const startX = -spanX * 0.5;

      // Compute spine points and local coordinate frames
      for (let i = 0; i <= spinePts; i++) {
        const u = i / spinePts;
        let x = startX + u * spanX;

        // Base diagonal + S-curve
        const baseAngle = u * Math.PI * 2.2 - this.flowPhase + phaseOffset;
        let y = Math.sin(baseAngle) * (presentation === 'chill' ? 5.5 : 4.2) + (u - 0.5) * -4.0;
        let z = depthZ + Math.cos(baseAngle * 0.7) * 3.5;

        // 1. Bass broad bend and tension
        if (!reducedMotion) {
          const bassBend = Math.sin(u * Math.PI * 1.5 - this.flowPhase * 0.8) * this.smoothedBass * 3.2;
          y += bassBend;
          z += Math.cos(u * Math.PI * 1.5 - this.flowPhase * 0.8) * this.smoothedBass * 2.0;
        }

        // 2. Highs fine ripples
        if (!reducedMotion) {
          const highRipple = Math.sin(u * 40.0 - this.flowPhase * 4.0) * this.smoothedHighs * 0.45;
          y += highRipple;
        }

        // 3. Transient pulses traveling along the tape
        let pulseInfluence = 0;
        for (let p = 0; p < this.pulses.length; p++) {
          const pulse = this.pulses[p];
          if (!pulse.active) continue;
          const dist = Math.abs(u - pulse.u);
          if (dist < pulse.width) {
            const bell = Math.cos((dist / pulse.width) * (Math.PI * 0.5));
            pulseInfluence += bell * pulse.strength;
          }
        }
        y += pulseInfluence * 1.4;
        maxPulseVal = Math.max(maxPulseVal, pulseInfluence);

        // 4. Hand grab & damped wave release
        if (rIdx === this.grabbedRibbonIndex) {
          if (this.isGrabbed) {
            const grabDist = Math.abs(u - this.grabbedU);
            if (grabDist < this.grabInfluenceRadius) {
              const falloff = Math.cos((grabDist / this.grabInfluenceRadius) * (Math.PI * 0.5));
              x += this.grabSpringX.position * falloff * 2.0;
              y += this.grabSpringY.position * falloff * 3.5;
            }
          } else if (this.waveReleaseAmp > 0.001) {
            // Propagating wave packets outward from grabbedU
            const dist = Math.abs(u - this.grabbedU);
            const wavePhase = dist * 14.0 - this.waveReleaseTime * 8.0;
            const wave = Math.sin(wavePhase) * Math.exp(-dist * 3.0) * this.waveReleaseAmp;
            y += wave * 2.2;
          }
        }

        // Mids torsion (twisting the ribbon lateral normal)
        const midTorsion = (u * Math.PI * 3.0 + this.flowPhase * 0.6) * 0.5 + this.smoothedMids * 1.8;
        const cosT = Math.cos(midTorsion);
        const sinT = Math.sin(midTorsion);

        // Effective ribbon width with slight bass tension expansion
        const effWidth = width * (1.0 + this.smoothedBass * 0.25 + pulseInfluence * 0.3);
        const halfW = effWidth * 0.5;

        // Extrude laterally across normal vector
        const nx = -sinT * 0.2;
        const ny = cosT;
        const nz = sinT;

        const vIdx0 = i * 2;
        const vIdx1 = i * 2 + 1;

        // Top vertex of ribbon strip
        positions[vIdx0 * 3] = x + nx * halfW;
        positions[vIdx0 * 3 + 1] = y + ny * halfW;
        positions[vIdx0 * 3 + 2] = z + nz * halfW;

        // Bottom vertex of ribbon strip
        positions[vIdx1 * 3] = x - nx * halfW;
        positions[vIdx1 * 3 + 1] = y - ny * halfW;
        positions[vIdx1 * 3 + 2] = z - nz * halfW;

        // Normals
        normals[vIdx0 * 3] = 0;
        normals[vIdx0 * 3 + 1] = -nz;
        normals[vIdx0 * 3 + 2] = ny;

        normals[vIdx1 * 3] = 0;
        normals[vIdx1 * 3 + 1] = -nz;
        normals[vIdx1 * 3 + 2] = ny;

        // UVs
        uvs[vIdx0 * 2] = u;
        uvs[vIdx0 * 2 + 1] = 1.0;

        uvs[vIdx1 * 2] = u;
        uvs[vIdx1 * 2 + 1] = 0.0;

        // Color gradient along spine
        const tColor = mixColor(baseColor, accentColor, pulseInfluence);
        colors[vIdx0 * 3] = tColor.r;
        colors[vIdx0 * 3 + 1] = tColor.g;
        colors[vIdx0 * 3 + 2] = tColor.b;

        colors[vIdx1 * 3] = tColor.r;
        colors[vIdx1 * 3 + 1] = tColor.g;
        colors[vIdx1 * 3 + 2] = tColor.b;
      }

      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.customColor.needsUpdate = true;
      geometry.attributes.normal.needsUpdate = true;
      geometry.attributes.uv.needsUpdate = true;

      // Update shader pulse glow
      material.uniforms.uPulseGlow.value = Math.min(1.0, maxPulseVal * 1.5);
    });
  }

  public resize(viewport: Viewport): void {
    if (this.context) {
      this.context.viewport = viewport;
    }
  }

  public setQuality(quality: QualityTier): void {
    if (quality === 'low') {
      this.numSpinePoints = 64;
    } else if (quality === 'balanced') {
      this.numSpinePoints = 96;
    } else {
      this.numSpinePoints = 128;
    }
    this.buildRibbons();
  }

  public setVisible(visible: boolean): void {
    this.rootGroup.visible = visible;
  }

  public reset(_reason: string): void {
    this.pulses.forEach((p) => (p.active = false));
    this.isGrabbed = false;
    this.grabSpringX.reset(0);
    this.grabSpringY.reset(0);
    this.waveReleaseAmp = 0;
  }

  public dispose(): void {
    this.ribbons.forEach((r) => {
      r.geometry.dispose();
      r.material.dispose();
    });
    this.ribbons = [];
    while (this.rootGroup.children.length > 0) {
      const c = this.rootGroup.children[0];
      this.rootGroup.remove(c);
    }
  }
}

function mixColor(c1: THREE.Color, c2: THREE.Color, t: number): THREE.Color {
  const clampedT = Math.max(0, Math.min(1, t));
  return new THREE.Color(
    c1.r + (c2.r - c1.r) * clampedT,
    c1.g + (c2.g - c1.g) * clampedT,
    c1.b + (c2.b - c1.b) * clampedT
  );
}
