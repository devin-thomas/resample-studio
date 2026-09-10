import { InteractionFrame } from './types';

export class PointerTracker {
  private element: HTMLElement | null = null;
  private currentFrame: InteractionFrame;

  private pointerId: number | null = null;
  private prevX = 0;
  private prevY = 0;
  private prevTime = 0;

  private pendingJustPressed = false;
  private pendingJustReleased = false;
  private pendingCancelled = false;

  private isTracking = false;

  constructor() {
    this.currentFrame = {
      kind: 'none',
      active: false,
      pressed: false,
      x: 0,
      y: 0,
      velocityX: 0,
      velocityY: 0,
      justPressed: false,
      justReleased: false,
      cancelled: false,
    };
  }

  public attach(el: HTMLElement): void {
    this.detach();
    this.element = el;

    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointercancel', this.onPointerCancel);
    el.addEventListener('lostpointercapture', this.onLostPointerCapture);
    window.addEventListener('blur', this.onWindowBlur);
  }

  public detach(): void {
    if (!this.element) return;
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.removeEventListener('pointermove', this.onPointerMove);
    this.element.removeEventListener('pointerup', this.onPointerUp);
    this.element.removeEventListener('pointercancel', this.onPointerCancel);
    this.element.removeEventListener('lostpointercapture', this.onLostPointerCapture);
    window.removeEventListener('blur', this.onWindowBlur);

    this.reset();
    this.element = null;
  }

  private isIgnoredTarget(target: EventTarget | null): boolean {
    if (!target || !(target instanceof HTMLElement)) return false;
    // Check for explicit data attribute
    if (target.closest('[data-visualizer-ignore]')) return true;

    // Check standard UI elements
    const tag = target.tagName.toLowerCase();
    if (['button', 'input', 'select', 'textarea', 'a', 'label'].includes(tag)) return true;
    if (target.getAttribute('role') === 'button' || target.getAttribute('role') === 'slider') return true;

    return false;
  }

  private getNormalizedCoords(e: PointerEvent): { x: number; y: number } {
    if (!this.element) return { x: 0, y: 0 };
    const rect = this.element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };

    const clientX = e.clientX;
    const clientY = e.clientY;

    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((clientY - rect.top) / rect.height) * 2 - 1); // Positive is UP
    return {
      x: Math.max(-1.5, Math.min(1.5, x)),
      y: Math.max(-1.5, Math.min(1.5, y)),
    };
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.isIgnoredTarget(e.target)) return;

    this.pointerId = e.pointerId;
    this.isTracking = true;

    try {
      this.element?.setPointerCapture(e.pointerId);
    } catch {
      // Ignored if capture unsupported
    }

    const coords = this.getNormalizedCoords(e);
    const now = performance.now();

    this.currentFrame.kind = (e.pointerType as InteractionFrame['kind']) || 'mouse';
    this.currentFrame.active = true;
    this.currentFrame.pressed = true;
    this.currentFrame.x = coords.x;
    this.currentFrame.y = coords.y;
    this.currentFrame.velocityX = 0;
    this.currentFrame.velocityY = 0;

    this.prevX = coords.x;
    this.prevY = coords.y;
    this.prevTime = now;

    this.pendingJustPressed = true;
  };

  private onPointerMove = (e: PointerEvent) => {
    // If hovering (mouse not pressed)
    if (!this.isTracking && e.pointerType === 'mouse') {
      const coords = this.getNormalizedCoords(e);
      this.currentFrame.kind = 'mouse';
      this.currentFrame.active = true;
      this.currentFrame.pressed = false;
      this.currentFrame.x = coords.x;
      this.currentFrame.y = coords.y;
      return;
    }

    if (!this.isTracking || (this.pointerId !== null && e.pointerId !== this.pointerId)) {
      return;
    }

    const coords = this.getNormalizedCoords(e);
    const now = performance.now();
    const dt = Math.max(0.001, (now - this.prevTime) / 1000);

    // Compute velocity in normalized units per second
    const rawVx = (coords.x - this.prevX) / dt;
    const rawVy = (coords.y - this.prevY) / dt;

    // Filter & clamp velocity
    const maxV = 8.0;
    const clampedVx = Math.max(-maxV, Math.min(maxV, rawVx));
    const clampedVy = Math.max(-maxV, Math.min(maxV, rawVy));

    this.currentFrame.velocityX = this.currentFrame.velocityX * 0.4 + clampedVx * 0.6;
    this.currentFrame.velocityY = this.currentFrame.velocityY * 0.4 + clampedVy * 0.6;

    this.currentFrame.x = coords.x;
    this.currentFrame.y = coords.y;
    this.prevX = coords.x;
    this.prevY = coords.y;
    this.prevTime = now;
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.isTracking || (this.pointerId !== null && e.pointerId !== this.pointerId)) {
      return;
    }

    this.currentFrame.pressed = false;
    this.isTracking = false;
    this.pointerId = null;
    this.pendingJustReleased = true;
  };

  private onPointerCancel = (e: PointerEvent) => {
    if (this.pointerId !== null && e.pointerId !== this.pointerId) return;
    this.reset();
    this.pendingCancelled = true;
  };

  private onLostPointerCapture = (e: PointerEvent) => {
    if (this.pointerId !== null && e.pointerId === this.pointerId) {
      this.onPointerCancel(e);
    }
  };

  private onWindowBlur = () => {
    this.reset();
  };

  public reset(): void {
    this.isTracking = false;
    this.pointerId = null;
    this.currentFrame.pressed = false;
    this.currentFrame.active = false;
    this.currentFrame.velocityX = 0;
    this.currentFrame.velocityY = 0;
  }

  /**
   * Called once at the start of each render frame to update single-tick flags.
   */
  public step(): InteractionFrame {
    this.currentFrame.justPressed = this.pendingJustPressed;
    this.currentFrame.justReleased = this.pendingJustReleased;
    this.currentFrame.cancelled = this.pendingCancelled;

    this.pendingJustPressed = false;
    this.pendingJustReleased = false;
    this.pendingCancelled = false;

    return this.currentFrame;
  }
}
