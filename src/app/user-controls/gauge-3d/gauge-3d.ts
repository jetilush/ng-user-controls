import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnChanges,
  inject,
  input,
  signal,
  viewChild
} from '@angular/core';

export interface GaugeThreshold {
  value: number;
  color: string;
}

export type GaugeBackground = 'dark' | 'light';

// Geometry constants
const START_ANGLE = (7 * Math.PI) / 6; // 210° — lower-left  (min position)
const TOTAL_SWEEP = (4 * Math.PI) / 3; // 240° clockwise sweep to lower-right (max position)
const ARC_R       = 3.0;
const ARC_N       = 80;               // arc segment count
const NEEDLE_LEN  = 2.55;

@Component({
  selector: 'uc-gauge-3d',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gauge-3d.html',
  styleUrl: './gauge-3d.scss'
})
export class Gauge3dComponent implements AfterViewInit, OnChanges {
  readonly label      = input('Gauge');
  readonly value      = input.required<number>();
  readonly min        = input(0);
  readonly max        = input(100);
  readonly unit       = input('');
  readonly thresholds = input<GaugeThreshold[]>([
    { value: 60,  color: '#22c55e' },
    { value: 80,  color: '#eab308' },
    { value: 100, color: '#ef4444' }
  ]);
  readonly background = input<GaugeBackground>('dark');
  readonly height     = input('380px');

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('gaugeCanvas');
  private readonly destroyRef = inject(DestroyRef);

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private animationId = 0;
  private resizeObserver!: ResizeObserver;

  private needle?: THREE.Mesh;
  private gaugeObjects: THREE.Object3D[] = [];
  private currentValue = 0;
  private targetValue  = 0;
  private prevConfigKey = '';

  readonly fps          = signal(0);
  readonly displayValue = signal('0');
  readonly displayColor = signal('#22c55e');

  private fpsFrames = 0;
  private fpsLast   = performance.now();

  ngAfterViewInit(): void {
    this.initScene();
    this.currentValue = this.value();
    this.targetValue  = this.value();
    this.rebuildGauge();
    this.startLoop();
    this.watchResize();

    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(this.animationId);
      this.resizeObserver?.disconnect();
      this.controls?.dispose();
      this.renderer?.dispose();
    });
  }

  ngOnChanges(): void {
    if (!this.scene) return;
    this.targetValue = this.value();

    const configKey = JSON.stringify({
      min: this.min(), max: this.max(),
      thresholds: this.thresholds(),
      background: this.background()
    });

    if (configKey !== this.prevConfigKey) {
      this.prevConfigKey = configKey;
      this.currentValue  = this.targetValue; // snap on structural rebuild
      this.applyBackground();
      this.rebuildGauge();
    }
  }

  // ── Scene init ──────────────────────────────────────────────────────────────

  private initScene(): void {
    const canvas = this.canvasRef().nativeElement;
    const w = canvas.clientWidth  || 420;
    const h = canvas.clientHeight || 380;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;

    this.scene = new THREE.Scene();
    this.applyBackground();

    this.camera = new THREE.PerspectiveCamera(48, w / h, 0.1, 100);
    this.camera.position.set(0, 2.5, 9.5);
    this.camera.lookAt(0, 0.8, 0);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping   = true;
    this.controls.dampingFactor   = 0.07;
    this.controls.target.set(0, 0.8, 0);
    this.controls.minDistance     = 4;
    this.controls.maxDistance     = 18;
    this.controls.autoRotate      = false;

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(6, 10, 8);
    dir.castShadow = true;
    this.scene.add(dir);
    const fill = new THREE.DirectionalLight(0x4488bb, 0.25);
    fill.position.set(-6, 4, -6);
    this.scene.add(fill);
  }

  private applyBackground(): void {
    const col = this.background() === 'dark' ? 0x08141e : 0xe8f0f8;
    this.scene.background = new THREE.Color(col);
  }

  // ── Gauge build ─────────────────────────────────────────────────────────────

  private rebuildGauge(): void {
    for (const obj of this.gaugeObjects) {
      this.scene.remove(obj);
      if (obj instanceof THREE.Mesh) { obj.geometry.dispose(); (obj.material as THREE.Material).dispose(); }
      else if (obj instanceof THREE.Line) { obj.geometry.dispose(); (obj.material as THREE.Material).dispose(); }
      else if (obj instanceof THREE.Sprite) { obj.material.map?.dispose(); obj.material.dispose(); }
    }
    this.gaugeObjects = [];
    this.needle = undefined;

    this.buildBody();
    this.buildArc();
    this.buildNeedle();
    this.buildTicksAndLabels();
  }

  private buildBody(): void {
    const isDark = this.background() === 'dark';
    const faceColor  = isDark ? 0x0c1e2e : 0xdde8f4;
    const bezelColor = isDark ? 0x1e3a58 : 0x7aaec8;

    // Gauge face disc (cylinder, thin)
    const faceGeo = new THREE.CylinderGeometry(ARC_R + 0.55, ARC_R + 0.55, 0.22, 72);
    faceGeo.rotateX(Math.PI / 2);
    const face = new THREE.Mesh(faceGeo, new THREE.MeshPhongMaterial({ color: faceColor, shininess: 20 }));
    face.receiveShadow = true;
    this.add(face);

    // Bezel ring
    const bezel = new THREE.Mesh(
      new THREE.TorusGeometry(ARC_R + 0.55, 0.18, 16, 72),
      new THREE.MeshPhongMaterial({ color: bezelColor, shininess: 90, specular: new THREE.Color(0x8ab8d8) })
    );
    this.add(bezel);

    // Background arc ring (dark, sits behind the colored segments)
    const bgRing = new THREE.Mesh(
      new THREE.RingGeometry(ARC_R - 0.42, ARC_R + 0.42, 80, 1, -Math.PI / 6, TOTAL_SWEEP),
      new THREE.MeshBasicMaterial({ color: isDark ? 0x071420 : 0xb8cfe0, side: THREE.DoubleSide })
    );
    bgRing.position.z = 0.02;
    this.add(bgRing);

    // Center pivot sphere
    const pivot = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 24, 24),
      new THREE.MeshPhongMaterial({ color: 0xddeeff, shininess: 100, specular: new THREE.Color(0xffffff) })
    );
    pivot.position.z = 0.14;
    this.add(pivot);

    // Glass cover (subtle)
    const glass = new THREE.Mesh(
      new THREE.CircleGeometry(ARC_R + 0.38, 64),
      new THREE.MeshPhongMaterial({ color: 0x99ccee, transparent: true, opacity: 0.06, side: THREE.FrontSide })
    );
    glass.position.z = 0.22;
    this.add(glass);
  }

  private buildArc(): void {
    const segAngleStep = TOTAL_SWEEP / ARC_N;
    const segW = ARC_R * segAngleStep * 0.80; // tangential width — small gap between segments
    const segH = 0.78;  // radial thickness
    const segD = 0.11;  // Z depth

    for (let i = 0; i < ARC_N; i++) {
      const t     = (i + 0.5) / ARC_N; // 0…1 across the arc
      const angle = START_ANGLE - t * TOTAL_SWEEP;
      const dVal  = this.min() + t * (this.max() - this.min());

      const geo = new THREE.BoxGeometry(segH, segW, segD);
      const col = this.zoneColor(dVal);
      const mat = new THREE.MeshPhongMaterial({ color: new THREE.Color(col), shininess: 55 });
      const seg = new THREE.Mesh(geo, mat);

      // rotation.z = angle → +X points radially, +Y points tangentially
      seg.rotation.z  = angle;
      seg.position.set(ARC_R * Math.cos(angle), ARC_R * Math.sin(angle), 0.12);
      seg.castShadow = true;
      this.add(seg);
    }
  }

  private buildNeedle(): void {
    const geo = new THREE.BoxGeometry(0.07, NEEDLE_LEN, 0.09);
    // Offset so 25 % extends behind pivot as counterweight, 75 % in front
    geo.translate(0, NEEDLE_LEN * 0.25, 0);

    this.needle = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
      color: 0xffffff, emissive: new THREE.Color(0x111111), shininess: 80
    }));
    this.needle.position.z = 0.18;
    this.needle.rotation.z = this.valueToAngle(this.currentValue) - Math.PI / 2;
    this.add(this.needle);
  }

  private buildTicksAndLabels(): void {
    const isDark = this.background() === 'dark';
    const tickColor  = isDark ? 0x4a8aaa : 0x336688;
    const labelColor = isDark ? '#5a9abb' : '#2a5a7a';
    const TICKS      = 4; // 0 % 25 % 50 % 75 % 100 %
    const innerR     = ARC_R + 0.48;
    const outerR     = ARC_R + 0.75;

    const lineMat = new THREE.LineBasicMaterial({ color: tickColor });

    for (let i = 0; i <= TICKS; i++) {
      const angle   = START_ANGLE - (i / TICKS) * TOTAL_SWEEP;
      const dataVal = this.min() + (i / TICKS) * (this.max() - this.min());

      // Tick line
      const tickGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(innerR * Math.cos(angle), innerR * Math.sin(angle), 0.18),
        new THREE.Vector3(outerR * Math.cos(angle), outerR * Math.sin(angle), 0.18)
      ]);
      this.add(new THREE.Line(tickGeo, lineMat.clone()));

      // Label sprite
      const labelR  = ARC_R + 1.1;
      const sp = this.makeSprite(this.fmtVal(dataVal), 16, labelColor, 80, 32);
      sp.position.set(labelR * Math.cos(angle), labelR * Math.sin(angle), 0.18);
      sp.scale.set(0.82, 0.33, 1);
      this.add(sp);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private add(obj: THREE.Object3D): void {
    this.scene.add(obj);
    this.gaugeObjects.push(obj);
  }

  private valueToAngle(v: number): number {
    const t = Math.max(0, Math.min(1, (v - this.min()) / Math.max(this.max() - this.min(), 0.001)));
    return START_ANGLE - t * TOTAL_SWEEP;
  }

  private zoneColor(v: number): string {
    for (const th of this.thresholds()) {
      if (v <= th.value) return th.color;
    }
    const ths = this.thresholds();
    return ths.length ? ths[ths.length - 1].color : '#22c55e';
  }

  private fmtVal(v: number): string {
    const range = Math.abs(this.max() - this.min());
    return range < 2 ? v.toFixed(2) : range < 20 ? v.toFixed(1) : String(Math.round(v));
  }

  private makeSprite(text: string, fontSize: number, color: string, cw: number, ch: number): THREE.Sprite {
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, cw, ch);
    ctx.font = `bold ${fontSize}px system-ui,sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cw / 2, ch / 2);
    return new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false
    }));
  }

  // ── Render loop ──────────────────────────────────────────────────────────────

  private startLoop(): void {
    const loop = (): void => {
      this.animationId = requestAnimationFrame(loop);

      if (this.needle) {
        this.currentValue = THREE.MathUtils.lerp(this.currentValue, this.targetValue, 0.07);
        this.needle.rotation.z = this.valueToAngle(this.currentValue) - Math.PI / 2;

        const range = Math.abs(this.max() - this.min());
        const disp  = range < 2 ? this.currentValue.toFixed(2) : String(Math.round(this.currentValue));
        if (this.displayValue() !== disp) this.displayValue.set(disp);

        const col = this.zoneColor(this.currentValue);
        if (this.displayColor() !== col) this.displayColor.set(col);
      }

      this.fpsFrames++;
      const now = performance.now();
      if (now - this.fpsLast >= 1000) { this.fps.set(this.fpsFrames); this.fpsFrames = 0; this.fpsLast = now; }

      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  private watchResize(): void {
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.renderer) return;
      const canvas = this.canvasRef().nativeElement;
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth, h = parent.clientHeight || canvas.clientHeight;
      if (!w || !h) return;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
    this.resizeObserver.observe(this.canvasRef().nativeElement.parentElement ?? this.canvasRef().nativeElement);
  }
}
