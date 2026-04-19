import Phaser from 'phaser';
import { W, H } from '../config/Constants';

export interface ViewportAttachOpts {
  worldW: number;
  zoom?: number;
  panSpeed?: number;
  edgeZone?: number;
  minZoom?: number;
  maxZoom?: number;
  zoomSpeed?: number;
  /**
   * Initial camera center. Default (W / (2 * zoom), H / 2) matches
   * WorldScene's pre-extraction behavior — camera centered on the
   * player hive side.
   */
  initialCenter?: { x: number; y: number };
  /**
   * Which mouse button initiates drag-to-pan. Default 'left'
   * preserves WorldScene behavior; sandbox uses 'right' so left-
   * click stays dedicated to unit placement.
   */
  dragButton?: 'left' | 'right';
}

/**
 * Camera pan + zoom controller. Owns drag-to-pan, arrow-key pan,
 * mouse-edge pan, and +/- zoom. Extracted from WorldScene so sandbox
 * can reuse the same feel without duplicating code.
 *
 * Mouse tracking uses a native addEventListener on the canvas parent
 * because Phaser's DOM container (configured globally via
 * `dom: { createContainer: true }`) intercepts hover events. This is
 * the same workaround WorldScene used pre-extraction.
 */
export class ViewportController {
  private scene: Phaser.Scene;
  private cam!: Phaser.Cameras.Scene2D.Camera;
  private worldW = 0;
  private panSpeed = 2000;
  private edgeZone = 200;
  private minZoom = 1;
  private maxZoom = 3;
  private zoomSpeed = 1.5;
  private dragMouseButton = 0;

  private panKeys!: {
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
  };
  private zoomKeys!: {
    zIn: Phaser.Input.Keyboard.Key;
    zInEq: Phaser.Input.Keyboard.Key;
    zOut: Phaser.Input.Keyboard.Key;
    zOutEq: Phaser.Input.Keyboard.Key;
  };

  // Drag state
  private dragStartX = 0;
  private camStartX = 0;
  private dragging = false;

  // Native mouse tracking (DOM container bypass) — one listener set
  // handles edge-pan tracking, drag-origin capture, and drag updates.
  private mouseX = -1;
  private mouseDown = false;
  private nativeMouseMove!: (e: MouseEvent) => void;
  private nativeMouseLeave!: () => void;
  private nativeMouseDown!: (e: MouseEvent) => void;
  private nativeMouseUp!: () => void;

  private attached = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  attach(opts: ViewportAttachOpts): void {
    if (this.attached) {
      throw new Error('ViewportController.attach called twice on the same scene');
    }

    this.worldW = opts.worldW;
    this.panSpeed = opts.panSpeed ?? 2000;
    this.edgeZone = opts.edgeZone ?? 200;
    this.minZoom = opts.minZoom ?? 1;
    this.maxZoom = opts.maxZoom ?? 3;
    this.zoomSpeed = opts.zoomSpeed ?? 1.5;
    this.dragMouseButton = (opts.dragButton ?? 'left') === 'right' ? 2 : 0;
    const zoom = opts.zoom ?? 1.5;

    // Camera
    this.cam = this.scene.cameras.main;
    this.cam.setZoom(zoom);
    this.cam.setBounds(0, 0, this.worldW, H);
    const center = opts.initialCenter ?? { x: W / (2 * zoom), y: H / 2 };
    this.cam.centerOn(center.x, center.y);

    // Keyboard keys
    const kb = this.scene.input.keyboard!;
    this.panKeys = {
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.zoomKeys = {
      zIn: kb.addKey(Phaser.Input.Keyboard.KeyCodes.PLUS),
      zInEq: kb.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_ADD),
      zOut: kb.addKey(Phaser.Input.Keyboard.KeyCodes.MINUS),
      zOutEq: kb.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_SUBTRACT),
    };

    // Native mouse tracking — DOM container intercepts Phaser's
    // pointer events, so edge-pan AND drag both use native browser
    // listeners. mousemove handles both edge-pan mouseX AND drag
    // scroll-update in one listener; mousedown captures drag origin;
    // mouseup releases the drag flag.
    const canvas = this.scene.sys.game.canvas;
    const canvasX = (e: MouseEvent): number => {
      const rect = canvas.getBoundingClientRect();
      return ((e.clientX - rect.left) / rect.width) * W;
    };
    this.nativeMouseMove = (e: MouseEvent) => {
      this.mouseX = canvasX(e);
      if (!this.mouseDown) return;
      const dx = this.dragStartX - this.mouseX;
      if (Math.abs(dx) > 5) this.dragging = true;
      if (this.dragging) {
        this.cam.scrollX = this.camStartX + dx;
      }
    };
    this.nativeMouseLeave = () => { this.mouseX = -1; };
    this.nativeMouseDown = (e: MouseEvent) => {
      if (e.button !== this.dragMouseButton) return;
      this.mouseDown = true;
      this.dragStartX = canvasX(e);
      this.camStartX = this.cam.scrollX;
      this.dragging = false;
    };
    this.nativeMouseUp = () => {
      this.mouseDown = false;
      this.dragging = false;
    };
    canvas.parentElement!.addEventListener('mousemove', this.nativeMouseMove);
    canvas.parentElement!.addEventListener('mouseleave', this.nativeMouseLeave);
    canvas.parentElement!.addEventListener('mousedown', this.nativeMouseDown);
    // mouseup on window so release outside the canvas still clears state.
    window.addEventListener('mouseup', this.nativeMouseUp);

    // Self-register shutdown cleanup so callers can't leak native
    // listeners if they forget to detach explicitly.
    this.scene.events.once('shutdown', () => this.detach());

    this.attached = true;
  }

  update(dt: number): void {
    if (!this.attached) return;

    // Zoom — +/- / numpad
    if (this.zoomKeys.zIn.isDown || this.zoomKeys.zInEq.isDown) {
      this.cam.zoom = Math.min(this.maxZoom, this.cam.zoom + this.zoomSpeed * dt);
    } else if (this.zoomKeys.zOut.isDown || this.zoomKeys.zOutEq.isDown) {
      this.cam.zoom = Math.max(this.minZoom, this.cam.zoom - this.zoomSpeed * dt);
    }

    // Pan — arrow keys or mouse-edge
    const atLeftEdge = this.mouseX >= 0 && this.mouseX < this.edgeZone;
    const atRightEdge = this.mouseX > W - this.edgeZone && this.mouseX <= W;

    if (this.panKeys.left.isDown || this.panKeys.a.isDown) {
      this.cam.scrollX -= this.panSpeed * dt;
    } else if (this.panKeys.right.isDown || this.panKeys.d.isDown) {
      this.cam.scrollX += this.panSpeed * dt;
    } else if (atLeftEdge) {
      this.cam.scrollX -= this.panSpeed * dt;
    } else if (atRightEdge) {
      this.cam.scrollX += this.panSpeed * dt;
    }
  }

  detach(): void {
    if (!this.attached) return;

    const canvas = this.scene.sys.game.canvas;
    canvas.parentElement?.removeEventListener('mousemove', this.nativeMouseMove);
    canvas.parentElement?.removeEventListener('mouseleave', this.nativeMouseLeave);
    canvas.parentElement?.removeEventListener('mousedown', this.nativeMouseDown);
    window.removeEventListener('mouseup', this.nativeMouseUp);

    this.attached = false;
  }

  getScrollX(): number {
    return this.cam.scrollX;
  }

  getZoom(): number {
    return this.cam.zoom;
  }
}
