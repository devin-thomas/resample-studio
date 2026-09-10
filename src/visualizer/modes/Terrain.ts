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

interface TransientRidge {
  active: boolean;
  zPos: number;      // Position along scrolling terrain
  amplitude: number;
  speed: number;
}

const TERRAIN_VERTEX_SHADER = `
  varying vec2 vUv;
  varying float vElevation;
  varying vec3 vViewPosition;

  void main() {
    vUv = uv;
    vElevation = position.y;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const TERRAIN_FRAGMENT_SHADER = `
  varying vec2 vUv;
  varying float vElevation;
  varying vec3 vViewPosition;

  uniform vec3 uPeakColor;
  uniform vec3 uValleyColor;
  uniform vec3 uFogColor;

  void main() {
    float dist = length(vViewPosition);

    // Color gradient based on elevation
    float h = clamp((vElevation + 2.5) / 6.0, 0.0, 1.0);
    vec3 color = mix(uValleyColor, uPeakColor, h);

    // Subtle grid line enhancement using screen-space derivatives
    vec2 grid = abs(fract(vUv * 64.0 - 0.5) - 0.5) / fwidth(vUv * 64.0);
    float line = 1.0 - min(min(grid.x, grid.y), 1.0);
    color += uPeakColor * (line * 0.45);

    // Distance horizon atmospheric fog fade
    float fogFactor = smoothstep(20.0, 65.0, dist);
    vec3 finalColor = mix(color, uFogColor, fogFactor);

    gl_FragColor = vec4(finalColor, 0.88);
  }
`;

export class TerrainVisualization implements StudioVisualization {
  public readonly id: ModeId = 'terrain';

  private context: ModeContext | null = null;
  private rootGroup: THREE.Group = new THREE.Group();

  private gridSegmentsX = 64;
  private gridSegmentsZ = 64;
  private planeGeometry: THREE.PlaneGeometry = new THREE.PlaneGeometry();
  private planeMaterial: THREE.ShaderMaterial = new THREE.ShaderMaterial();
  private planeMesh: THREE.Mesh = new THREE.Mesh();

  private positions: Float32Array = new Float32Array(0);

  // Scrolling state
  private scrollZ = 0;
  private smoothedBass = 0;
  private smoothedMids = 0;
  private smoothedHighs = 0;
  private smoothedSpeed = 1.0;

  // Transient ridges
  private ridges: TransientRidge[] = [];
  private readonly MAX_RIDGES = 6;

  // Hand steering physics
  private steerSpring = new DampedSpring(0, 10, 0.80);
  private lateralOffset = 0;

  public init(context: ModeContext): void {
    this.context = context;
    this.rootGroup = new THREE.Group();
    context.root.add(this.rootGroup);

    context.camera.fov = 55;
    context.camera.position.set(0, 7.5, 22);
    context.camera.lookAt(0, 1.0, -18);
    context.camera.updateProjectionMatrix();

    this.ridges = [];
    for (let i = 0; i < this.MAX_RIDGES; i++) {
      this.ridges.push({
        active: false,
        zPos: 0,
        amplitude: 0,
        speed: 16,
      });
    }

    this.buildTerrain();
  }

  private buildTerrain(): void {
    this.planeGeometry.dispose();
    this.planeMaterial.dispose();
    if (this.rootGroup.children.includes(this.planeMesh)) {
      this.rootGroup.remove(this.planeMesh);
    }

    const sizeX = 64;
    const sizeZ = 64;

    this.planeGeometry = new THREE.PlaneGeometry(
      sizeX,
      sizeZ,
      this.gridSegmentsX,
      this.gridSegmentsZ
    );
    // Rotate horizontal: X is lateral, Z is depth
    this.planeGeometry.rotateX(-Math.PI / 2);
    this.planeGeometry.translate(0, -2.5, -sizeZ * 0.25);

    this.positions = this.planeGeometry.attributes.position.array as Float32Array;

    this.planeMaterial = new THREE.ShaderMaterial({
      vertexShader: TERRAIN_VERTEX_SHADER,
      fragmentShader: TERRAIN_FRAGMENT_SHADER,
      uniforms: {
        uPeakColor: { value: new THREE.Color(0x00f0ff) },
        uValleyColor: { value: new THREE.Color(0x0e1b33) },
        uFogColor: { value: new THREE.Color(0x07090e) },
      },
      wireframe: true,
      transparent: true,
      depthWrite: false,
    });

    this.planeMesh = new THREE.Mesh(this.planeGeometry, this.planeMaterial);
    this.rootGroup.add(this.planeMesh);
  }

  public update(frame: VisualizationFrame): void {
    const { dt, audio, input, reducedMotion, presentation } = frame;

    this.smoothedBass = smoothFollow(this.smoothedBass, audio.bass, 8.0, dt);
    this.smoothedMids = smoothFollow(this.smoothedMids, audio.mids, 6.0, dt);
    this.smoothedHighs = smoothFollow(this.smoothedHighs, audio.highs, 12.0, dt);

    const targetSpeed = Math.max(0.25, Math.min(3.0, audio.playbackRate || 1.0));
    this.smoothedSpeed = smoothFollow(this.smoothedSpeed, targetSpeed, 3.0, dt);

    // Continuous baseline forward scrolling
    const baseScrollRate = reducedMotion ? 2.0 : 8.0;
    this.scrollZ += dt * baseScrollRate * (audio.playing ? this.smoothedSpeed : 0.6);

    // New transient ridges
    for (let i = 0; i < audio.eventCount; i++) {
      this.emitRidge(audio.events[i].strength);
    }

    // Update active traveling ridges
    for (let i = 0; i < this.ridges.length; i++) {
      const r = this.ridges[i];
      if (!r.active) continue;
      r.zPos += r.speed * dt;
      r.amplitude *= Math.exp(-dt * 0.9);
      if (r.amplitude <= 0.05) {
        r.active = false;
      }
    }

    // Hand steering interaction
    this.updateInteraction(input, dt);

    // Update vertex elevations
    this.updateElevations(reducedMotion, presentation);
  }

  private emitRidge(strength: number): void {
    const ridge = this.ridges.find((r) => !r.active);
    if (ridge) {
      ridge.active = true;
      ridge.zPos = -45; // Start near horizon
      ridge.amplitude = Math.min(1.0, strength) * 3.2;
      ridge.speed = 18;
    }
  }

  private updateInteraction(input: VisualizationFrame['input'], dt: number): void {
    if (input.pressed) {
      // Steer laterally with pointer
      this.steerSpring.target = input.x * 0.12;
      this.lateralOffset += input.velocityX * dt * 8.0;
      this.lateralOffset = Math.max(-8, Math.min(8, this.lateralOffset));
    } else {
      this.steerSpring.target = 0;
      this.lateralOffset *= Math.exp(-dt * 1.5);
    }

    this.steerSpring.update(dt);

    if (this.context) {
      // Gentle camera bank and lateral drift
      this.context.camera.position.x = this.lateralOffset * 0.5;
      this.context.camera.rotation.z = -this.steerSpring.position;
    }
  }

  private updateElevations(reducedMotion: boolean, _presentation: string): void {
    const pos = this.positions;
    const vertexCount = pos.length / 3;

    for (let i = 0; i < vertexCount; i++) {
      const x = pos[i * 3];
      const z = pos[i * 3 + 2];

      // Procedural height-field based on world scrolling Z
      const worldZ = z - this.scrollZ;

      // 1. Base rolling hills
      let y = Math.sin(x * 0.12) * Math.cos(worldZ * 0.08) * 1.6;
      y += Math.cos(x * 0.22 + worldZ * 0.15) * 0.8;

      if (!reducedMotion) {
        // 2. Bass broad ridges
        const bassWave = Math.sin(worldZ * 0.20 - this.scrollZ * 0.1) * this.smoothedBass * 3.6;
        y += bassWave;

        // 3. Mids surface undulations
        const midWave = Math.sin(x * 0.35 + worldZ * 0.3) * this.smoothedMids * 1.8;
        y += midWave;

        // 4. Highs fine ripples
        const highRipple = Math.sin(x * 1.6 + worldZ * 1.4) * this.smoothedHighs * 0.4;
        y += highRipple;

        // 5. Transient traveling ridges
        for (let r = 0; r < this.ridges.length; r++) {
          const ridge = this.ridges[r];
          if (!ridge.active) continue;
          const dist = Math.abs(z - ridge.zPos);
          if (dist < 4.5) {
            const bell = Math.cos((dist / 4.5) * (Math.PI * 0.5));
            y += bell * ridge.amplitude;
          }
        }
      }

      pos[i * 3 + 1] = y;
    }

    this.planeGeometry.attributes.position.needsUpdate = true;
  }

  public resize(viewport: Viewport): void {
    if (this.context) {
      this.context.viewport = viewport;
    }
  }

  public setQuality(quality: QualityTier): void {
    if (quality === 'low') {
      this.gridSegmentsX = 40;
      this.gridSegmentsZ = 40;
    } else if (quality === 'balanced') {
      this.gridSegmentsX = 52;
      this.gridSegmentsZ = 52;
    } else {
      this.gridSegmentsX = 64;
      this.gridSegmentsZ = 64;
    }
    this.buildTerrain();
  }

  public setVisible(visible: boolean): void {
    this.rootGroup.visible = visible;
  }

  public reset(_reason: string): void {
    this.ridges.forEach((r) => (r.active = false));
    this.steerSpring.reset(0);
    this.lateralOffset = 0;
  }

  public dispose(): void {
    this.planeGeometry.dispose();
    this.planeMaterial.dispose();
    while (this.rootGroup.children.length > 0) {
      const c = this.rootGroup.children[0];
      this.rootGroup.remove(c);
    }
  }
}
