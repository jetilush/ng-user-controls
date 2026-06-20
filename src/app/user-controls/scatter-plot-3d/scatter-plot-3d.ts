import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnChanges,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';

export interface ScatterPoint {
  x: number;
  y: number;
  z: number;
  label?: string;
  color?: string;
  series?: string;
  size?: number;
}

export type ScatterBackground = 'dark' | 'light';

const PALETTE = ['#3b82f6','#f59e0b','#34d399','#f87171','#a78bfa','#22d3ee','#fb923c','#e879f9','#60a5fa','#4ade80'];
const AXIS_SIZE = 10;
const MARGIN    = 0.5;

@Component({
  selector: 'uc-scatter-plot-3d',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scatter-plot-3d.html',
  styleUrl: './scatter-plot-3d.scss'
})
export class ScatterPlot3dComponent implements AfterViewInit, OnChanges {
  readonly label      = input('3D Scatter Plot');
  readonly points     = input.required<readonly ScatterPoint[]>();
  readonly xLabel     = input('X');
  readonly yLabel     = input('Y');
  readonly zLabel     = input('Z');
  readonly pointSize  = input(0.18);
  readonly background = input<ScatterBackground>('dark');
  readonly autoRotate = input(false);
  readonly height     = input('460px');

  readonly pointClicked = output<ScatterPoint>();

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('scatterCanvas');
  private readonly destroyRef = inject(DestroyRef);

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private animationId = 0;
  private resizeObserver!: ResizeObserver;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2(-9999, -9999);

  private pointsMesh?: THREE.InstancedMesh;
  private pointsData: ScatterPoint[] = [];
  private chartObjects: THREE.Object3D[] = [];
  private hoveredId = -1;
  private savedColor = new THREE.Color();
  private dataRange = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1 };

  readonly fps           = signal(0);
  readonly hoveredPoint  = signal<ScatterPoint | null>(null);
  readonly selectedPoint = signal<ScatterPoint | null>(null);
  readonly seriesLegend  = signal<{ name: string; color: string }[]>([]);

  protected readonly pointCount = computed(() => this.points().length);

  private fpsFrames = 0;
  private fpsLast   = performance.now();

  ngAfterViewInit(): void {
    this.initScene();
    this.buildScatter();
    this.startLoop();
    this.watchResize();

    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(this.animationId);
      this.resizeObserver?.disconnect();
      const c = this.canvasRef().nativeElement;
      c.removeEventListener('mousemove', this.onMouseMove);
      c.removeEventListener('click', this.onClick);
      this.controls?.dispose();
      this.renderer?.dispose();
    });
  }

  ngOnChanges(): void {
    if (!this.scene) return;
    this.applyBackground();
    this.buildScatter();
    this.controls.autoRotate = this.autoRotate();
  }

  // ── Scene init ──────────────────────────────────────────────────────────────

  private initScene(): void {
    const canvas = this.canvasRef().nativeElement;
    const w = canvas.clientWidth  || 600;
    const h = canvas.clientHeight || 460;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);

    this.scene = new THREE.Scene();
    this.applyBackground();

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200);
    this.camera.position.set(16, 13, 16);
    this.camera.lookAt(5, 5, 5);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping   = true;
    this.controls.dampingFactor   = 0.06;
    this.controls.target.set(5, 5, 5);
    this.controls.minDistance     = 4;
    this.controls.maxDistance     = 50;
    this.controls.autoRotate      = this.autoRotate();
    this.controls.autoRotateSpeed = 0.7;

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(12, 18, 12);
    this.scene.add(dir);
    const fill = new THREE.DirectionalLight(0x4488cc, 0.3);
    fill.position.set(-8, 5, -8);
    this.scene.add(fill);

    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('click', this.onClick);
  }

  private applyBackground(): void {
    const col = this.background() === 'dark' ? 0x08141e : 0xe8f0f8;
    this.scene.background = new THREE.Color(col);
    this.scene.fog = new THREE.Fog(col, 28, 60);
  }

  // ── Scatter build ───────────────────────────────────────────────────────────

  private buildScatter(): void {
    if (this.pointsMesh) {
      this.scene.remove(this.pointsMesh);
      this.pointsMesh.geometry.dispose();
      (this.pointsMesh.material as THREE.Material).dispose();
    }
    for (const o of this.chartObjects) {
      this.scene.remove(o);
      if (o instanceof THREE.Sprite) { o.material.map?.dispose(); o.material.dispose(); }
      else if (o instanceof THREE.Line) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); }
      else if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); }
    }
    this.chartObjects = [];
    this.hoveredId = -1;
    this.hoveredPoint.set(null);

    const pts = this.points();
    if (!pts.length) return;

    // Compute data range
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), zs = pts.map((p) => p.z);
    const xMin = Math.min(...xs), xMax = Math.max(...xs, xMin + 1);
    const yMin = Math.min(...ys), yMax = Math.max(...ys, yMin + 1);
    const zMin = Math.min(...zs), zMax = Math.max(...zs, zMin + 1);
    this.dataRange = { xMin, xMax, yMin, yMax, zMin, zMax };

    const scaleRange = AXIS_SIZE - 2 * MARGIN;
    const nx = (v: number) => MARGIN + (v - xMin) / (xMax - xMin) * scaleRange;
    const ny = (v: number) => MARGIN + (v - yMin) / (yMax - yMin) * scaleRange;
    const nz = (v: number) => MARGIN + (v - zMin) / (zMax - zMin) * scaleRange;

    // Series color assignment
    const seriesColorMap = new Map<string, string>();
    let paletteIdx = 0;

    // Build InstancedMesh
    const geo = new THREE.SphereGeometry(1, 14, 10);
    const mat = new THREE.MeshPhongMaterial({ shininess: 70 });
    this.pointsMesh = new THREE.InstancedMesh(geo, mat, pts.length);
    this.pointsMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(pts.length * 3), 3);

    const matrix = new THREE.Matrix4();
    const quat   = new THREE.Quaternion();

    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i];
      const s  = this.pointSize() * (pt.size ?? 1);
      matrix.compose(
        new THREE.Vector3(nx(pt.x), ny(pt.y), nz(pt.z)),
        quat,
        new THREE.Vector3(s, s, s)
      );
      this.pointsMesh.setMatrixAt(i, matrix);

      let hexColor = pt.color;
      if (!hexColor && pt.series) {
        if (!seriesColorMap.has(pt.series)) {
          seriesColorMap.set(pt.series, PALETTE[paletteIdx++ % PALETTE.length]);
        }
        hexColor = seriesColorMap.get(pt.series);
      }
      hexColor ??= PALETTE[paletteIdx++ % PALETTE.length];
      this.pointsMesh.setColorAt(i, new THREE.Color(hexColor));
    }

    this.pointsMesh.instanceMatrix.needsUpdate = true;
    this.pointsMesh.instanceColor!.needsUpdate = true;
    this.scene.add(this.pointsMesh);
    this.pointsData = [...pts];

    // Series legend
    this.seriesLegend.set([...seriesColorMap.entries()].map(([name, color]) => ({ name, color })));

    // Build axis objects
    this.buildAxes(nx, ny, nz);

    // Floor grid (subtle)
    const grid = new THREE.GridHelper(AXIS_SIZE, 10, 0x1e3650, 0x162840);
    grid.position.set(AXIS_SIZE / 2, 0, AXIS_SIZE / 2);
    this.scene.add(grid);
    this.chartObjects.push(grid);
  }

  private buildAxes(
    nx: (v: number) => number,
    ny: (v: number) => number,
    nz: (v: number) => number
  ): void {
    const { xMin, xMax, yMin, yMax, zMin, zMax } = this.dataRange;
    const isDark = this.background() === 'dark';
    const tickColor = isDark ? '#5a8aaa' : '#33506d';
    const TICKS = 5;

    // Axes
    const addLine = (from: THREE.Vector3, to: THREE.Vector3, color: number) => {
      const l = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([from, to]),
        new THREE.LineBasicMaterial({ color })
      );
      this.scene.add(l); this.chartObjects.push(l);
    };

    addLine(new THREE.Vector3(0, 0, 0), new THREE.Vector3(AXIS_SIZE + 0.8, 0, 0), 0xef4444);
    addLine(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, AXIS_SIZE + 0.8, 0), 0x22c55e);
    addLine(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, AXIS_SIZE + 0.8), 0x3b82f6);

    // Axis name labels
    this.addSprite(this.xLabel(), 20, '#ef4444', 120, 40).then((sp) => {
      sp.position.set(AXIS_SIZE + 1.4, 0, 0); sp.scale.set(1.4, 0.38, 1);
      this.scene.add(sp); this.chartObjects.push(sp);
    });
    this.addSprite(this.yLabel(), 20, '#22c55e', 120, 40).then((sp) => {
      sp.position.set(0, AXIS_SIZE + 1.4, 0); sp.scale.set(1.4, 0.38, 1);
      this.scene.add(sp); this.chartObjects.push(sp);
    });
    this.addSprite(this.zLabel(), 20, '#3b82f6', 120, 40).then((sp) => {
      sp.position.set(0, 0, AXIS_SIZE + 1.4); sp.scale.set(1.4, 0.38, 1);
      this.scene.add(sp); this.chartObjects.push(sp);
    });

    // X ticks
    for (let t = 0; t <= TICKS; t++) {
      const dv = xMin + (xMax - xMin) * (t / TICKS);
      const pos = nx(dv);
      addLine(new THREE.Vector3(pos, -0.12, 0), new THREE.Vector3(pos, 0.12, 0), 0xef4444);
      this.addSprite(this.fmtVal(dv), 14, tickColor, 88, 32).then((sp) => {
        sp.position.set(pos, -0.5, 0); sp.scale.set(0.9, 0.3, 1);
        this.scene.add(sp); this.chartObjects.push(sp);
      });
    }

    // Y ticks
    for (let t = 0; t <= TICKS; t++) {
      const dv = yMin + (yMax - yMin) * (t / TICKS);
      const pos = ny(dv);
      addLine(new THREE.Vector3(-0.12, pos, 0), new THREE.Vector3(0.12, pos, 0), 0x22c55e);
      this.addSprite(this.fmtVal(dv), 14, tickColor, 88, 32).then((sp) => {
        sp.position.set(-0.65, pos, 0); sp.scale.set(0.9, 0.3, 1);
        this.scene.add(sp); this.chartObjects.push(sp);
      });
    }

    // Z ticks
    for (let t = 0; t <= TICKS; t++) {
      const dv = zMin + (zMax - zMin) * (t / TICKS);
      const pos = nz(dv);
      addLine(new THREE.Vector3(0, -0.12, pos), new THREE.Vector3(0, 0.12, pos), 0x3b82f6);
      this.addSprite(this.fmtVal(dv), 14, tickColor, 88, 32).then((sp) => {
        sp.position.set(0, -0.5, pos); sp.scale.set(0.9, 0.3, 1);
        this.scene.add(sp); this.chartObjects.push(sp);
      });
    }
  }

  private fmtVal(v: number): string {
    if (Number.isInteger(v)) return String(v);
    if (Math.abs(v) >= 100) return v.toFixed(0);
    if (Math.abs(v) >= 10)  return v.toFixed(1);
    return v.toFixed(2);
  }

  private async addSprite(text: string, fontSize: number, color: string, cw: number, ch: number): Promise<THREE.Sprite> {
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

  // ── Events ───────────────────────────────────────────────────────────────────

  private readonly onMouseMove = (e: MouseEvent): void => {
    const c = this.canvasRef().nativeElement;
    const r = c.getBoundingClientRect();
    this.mouse.x =  ((e.clientX - r.left) / r.width)  * 2 - 1;
    this.mouse.y = -((e.clientY - r.top)  / r.height) * 2 + 1;
  };

  private readonly onClick = (): void => {
    if (this.hoveredId >= 0 && this.pointsData[this.hoveredId]) {
      const pt = this.pointsData[this.hoveredId];
      this.selectedPoint.set(pt);
      this.pointClicked.emit(pt);
    }
  };

  // ── Render loop ──────────────────────────────────────────────────────────────

  private startLoop(): void {
    const loop = (): void => {
      this.animationId = requestAnimationFrame(loop);

      if (this.pointsMesh) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hits = this.raycaster.intersectObject(this.pointsMesh);
        const newId = hits[0]?.instanceId ?? -1;

        if (newId !== this.hoveredId) {
          // Restore previous
          if (this.hoveredId >= 0 && this.pointsMesh.instanceColor) {
            this.pointsMesh.setColorAt(this.hoveredId, this.savedColor);
            this.pointsMesh.instanceColor.needsUpdate = true;
          }
          // Highlight new
          if (newId >= 0 && this.pointsMesh.instanceColor) {
            this.pointsMesh.getColorAt(newId, this.savedColor);
            const bright = this.savedColor.clone();
            bright.r = Math.min(bright.r * 1.7, 1);
            bright.g = Math.min(bright.g * 1.7, 1);
            bright.b = Math.min(bright.b * 1.7, 1);
            this.pointsMesh.setColorAt(newId, bright);
            this.pointsMesh.instanceColor.needsUpdate = true;
          }
          this.hoveredId = newId;
          this.hoveredPoint.set(newId >= 0 ? this.pointsData[newId] : null);
        }
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
