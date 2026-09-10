import * as THREE from 'three';
import {
  ModeContext,
  ModeId,
  QualityTier,
  StudioVisualization,
  Viewport,
  VisualizationFrame,
} from './types';
import { audioEngine } from '../audio/engine';
import { audioFeatureTimeline } from './audioFeatures';
import { PointerTracker } from './interaction';
import { clampDeltaTime } from './motion';

export class VisualizerRuntime {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private rootGroup: THREE.Group;

  private modeRegistry: Map<ModeId, () => StudioVisualization> = new Map();
  private activeMode: StudioVisualization | null = null;
  private activeModeId: ModeId = 'tape';

  private pointerTracker: PointerTracker;
  private resizeObserver: ResizeObserver | null = null;

  private animId: number | null = null;
  private lastTime = 0;
  private simTime = 0;

  // FPS measurement
  private frameCount = 0;
  private fpsTimer = 0;
  private onFpsUpdate: ((fps: number) => void) | null = null;

  private viewport: Viewport;
  private quality: QualityTier = 'high';
  private presentation: 'studio' | 'chill' = 'studio';
  private reducedMotion = false;

  constructor(container: HTMLElement, onFps?: (fps: number) => void) {
    this.container = container;
    this.onFpsUpdate = onFps || null;

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    this.viewport = { width, height, pixelRatio };

    // 1. Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x07090e, 0.025);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.resetCameraBaseline();

    // 2. Mode root group
    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);

    // 3. WebGLRenderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setClearColor(0x07090e, 1);
    this.container.appendChild(this.renderer.domElement);

    // 4. Pointer Interaction
    this.pointerTracker = new PointerTracker();
    this.pointerTracker.attach(container);

    // 5. Check reduced motion
    if (typeof window !== 'undefined' && window.matchMedia) {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion = media.matches;
      media.addEventListener('change', (e) => {
        this.reducedMotion = e.matches;
      });
    }

    // 6. Resize Observer
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          this.handleResize(w, h);
        }
      }
    });
    this.resizeObserver.observe(container);

    // 7. Visibility Change Handling
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    // 8. Context loss handling
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost, false);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored, false);

    // Start loop
    this.lastTime = performance.now();
    this.fpsTimer = performance.now();
    this.startLoop();
  }

  public registerMode(id: ModeId, factory: () => StudioVisualization): void {
    this.modeRegistry.set(id, factory);
  }

  public setMode(id: ModeId): void {
    if (this.activeModeId === id && this.activeMode) return;
    this.activeModeId = id;

    // Dispose old mode
    if (this.activeMode) {
      try {
        this.activeMode.dispose();
      } catch (e) {
        console.warn('Error disposing previous mode:', e);
      }
      this.activeMode = null;
    }

    // Clean root group children
    while (this.rootGroup.children.length > 0) {
      const child = this.rootGroup.children[0];
      this.rootGroup.remove(child);
    }

    this.resetCameraBaseline();

    // Create new mode
    const factory = this.modeRegistry.get(id);
    if (!factory) {
      console.warn(`Mode ${id} not registered`);
      return;
    }

    const mode = factory();
    const ctx: ModeContext = {
      root: this.rootGroup,
      camera: this.camera,
      viewport: this.viewport,
      quality: this.quality,
    };

    mode.init(ctx);
    this.activeMode = mode;
  }

  public setPresentation(mode: 'studio' | 'chill'): void {
    this.presentation = mode;
  }

  public setQuality(quality: QualityTier): void {
    this.quality = quality;
    const dpr = quality === 'high' ? Math.min(window.devicePixelRatio || 1, 2) : quality === 'balanced' ? 1.5 : 1.0;
    this.viewport.pixelRatio = dpr;
    this.renderer.setPixelRatio(dpr);
    this.activeMode?.setQuality(quality);
  }

  private resetCameraBaseline(): void {
    this.camera.fov = 60;
    this.camera.position.set(0, 0, 32);
    this.camera.rotation.set(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  private handleResize(width: number, height: number): void {
    this.viewport.width = width;
    this.viewport.height = height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.activeMode?.resize(this.viewport);
  }

  private onVisibilityChange = () => {
    if (document.hidden) {
      if (this.animId !== null) {
        cancelAnimationFrame(this.animId);
        this.animId = null;
      }
      this.pointerTracker.reset();
    } else {
      this.lastTime = performance.now();
      this.startLoop();
    }
  };

  private onContextLost = (e: Event) => {
    e.preventDefault();
    console.warn('WebGL context lost');
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  };

  private onContextRestored = () => {
    console.warn('WebGL context restored');
    this.renderer.setSize(this.viewport.width, this.viewport.height);
    this.activeMode?.reset('context-restored');
    this.lastTime = performance.now();
    this.startLoop();
  };

  private startLoop(): void {
    if (this.animId !== null) return;

    const animate = (timestamp: number) => {
      this.animId = requestAnimationFrame(animate);

      const rawDt = (timestamp - this.lastTime) / 1000;
      this.lastTime = timestamp;
      const dt = clampDeltaTime(rawDt, 0.05);

      this.simTime += dt;

      // Measure FPS once per second
      this.frameCount++;
      if (timestamp - this.fpsTimer >= 1000) {
        const measuredFps = Math.round((this.frameCount * 1000) / (timestamp - this.fpsTimer));
        this.onFpsUpdate?.(measuredFps);
        this.frameCount = 0;
        this.fpsTimer = timestamp;
      }

      // 1. Sample Pointer Interaction
      const input = this.pointerTracker.step();

      // 2. Sample Audio Features from Timeline
      const mediaTime = audioEngine.getCurrentTime();
      const isPlaying = audioEngine.isPlaying();
      const playbackRate = audioEngine.getPlaybackRate();
      const audio = audioFeatureTimeline.sample(mediaTime, isPlaying, playbackRate, dt);

      // 3. Update active mode
      if (this.activeMode) {
        const frame: VisualizationFrame = {
          simTime: this.simTime,
          dt,
          audio,
          input,
          reducedMotion: this.reducedMotion,
          presentation: this.presentation,
        };
        this.activeMode.update(frame);
      }

      // 4. Render
      this.renderer.render(this.scene, this.camera);
    };

    this.animId = requestAnimationFrame(animate);
  }

  public dispose(): void {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }

    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.resizeObserver?.disconnect();
    this.pointerTracker.detach();

    if (this.activeMode) {
      this.activeMode.dispose();
      this.activeMode = null;
    }

    while (this.rootGroup.children.length > 0) {
      const child = this.rootGroup.children[0];
      this.rootGroup.remove(child);
    }

    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }

    this.renderer.dispose();
  }
}
