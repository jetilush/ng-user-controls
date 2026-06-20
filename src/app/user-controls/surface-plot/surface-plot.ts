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

export type SurfaceColorScale = 'heat' | 'cool' | 'mono';
export type SurfaceBackground = 'dark' | 'light';

export interface SurfacePointEvent {
  row: number;
  col: number;
  value: number;
}

@Component({
  selector: 'uc-surface-plot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './surface-plot.html',
  styleUrl: './surface-plot.scss'
})
export class SurfacePlotComponent implements AfterViewInit, OnChanges {
  readonly label      = input('Surface Plot');
  readonly data       = input.required<number[][]>();
  readonly xLabels    = input<string[]>([]);
  readonly zLabels    = input<string[]>([]);
  readonly colorScale = input<SurfaceColorScale>('heat');
  readonly showWireframe = input(true);
  readonly background = input<SurfaceBackground>('dark');
  readonly autoRotate = input(false);
  readonly height     = input('460px');

  readonly pointHovered = output<SurfacePointEvent>();

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('surfaceCanvas');
  private readonly destroyRef = inject(DestroyRef);

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private animationId = 0;
  private surfaceMesh?: THREE.Mesh;
  private wireMesh?: THREE.Mesh;
  private hoverSphere?: THREE.Mesh;
  private labelObjects: THREE.Object3D[] = [];
  private resizeObserver!: ResizeObserver;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2(-9999, -9999);
  private surfaceGeo?: THREE.BufferGeometry;

  private targetY = new Float32Array(0);
  private currentY = new Float32Array(0);
  private animating = false;

  readonly fps           = signal(0);
  readonly hoveredValue  = signal<number | null>(null);
  private fpsFrames = 0;
  private fpsLast   = performance.now();

  protected readonly gradientCss = computed(() => {
    switch (this.colorScale()) {
      case 'heat': return 'linear-gradient(to right,#0044ff,#00ccff,#00ff44,#ffee00,#ff2200)';
      case 'cool': return 'linear-gradient(to right,#e8f4ff,#8844ff,#000033)';
      case 'mono': return 'linear-gradient(to right,#1a2a3a,#f0f8ff)';
    }
  });

  protected readonly minLabel = computed(() => {
    const flat = this.data().flat().filter(isFinite);
    return flat.length ? Math.min(...flat).toFixed(2) : '0';
  });

  protected readonly maxLabel = computed(() => {
    const flat = this.data().flat().filter(isFinite);
    return flat.length ? Math.max(...flat).toFixed(2) : '1';
  });

  ngAfterViewInit(): void {
    this.initScene();
    this.buildSurface();
    this.startLoop();
    this.watchResize();

    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(this.animationId);
      this.resizeObserver?.disconnect();
      this.canvasRef().nativeElement.removeEventListener('mousemove', this.onMouseMove);
      this.controls?.dispose();
      this.renderer?.dispose();
    });
  }

  ngOnChanges(): void {
    if (!this.scene) return;
    this.applyBackground();
    this.buildSurface();
    this.controls.autoRotate = this.autoRotate();
  }

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
    this.camera.position.set(10, 10, 14);
    this.camera.lookAt(0, 2, 0);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping    = true;
    this.controls.dampingFactor    = 0.06;
    this.controls.minDistance      = 3;
    this.controls.maxDistance      = 40;
    this.controls.target.set(0, 2, 0);
    this.controls.autoRotate       = this.autoRotate();
    this.controls.autoRotateSpeed  = 0.8;

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(10, 15, 8);
    this.scene.add(dir);
    const fill = new THREE.DirectionalLight(0x4488aa, 0.3);
    fill.position.set(-8, 4, -8);
    this.scene.add(fill);

    const grid = new THREE.GridHelper(22, 22, 0x1e3650, 0x162840);
    this.scene.add(grid);

    const sphereGeo = new THREE.SphereGeometry(0.15, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.hoverSphere = new THREE.Mesh(sphereGeo, sphereMat);
    this.hoverSphere.visible = false;
    this.scene.add(this.hoverSphere);

    canvas.addEventListener('mousemove', this.onMouseMove);
  }

  private applyBackground(): void {
    const col = this.background() === 'dark' ? 0x08141e : 0xe8f0f8;
    this.scene.background = new THREE.Color(col);
    this.scene.fog = new THREE.Fog(col, 22, 55);
  }

  private buildSurface(): void {
    if (this.surfaceMesh) { this.scene.remove(this.surfaceMesh); this.surfaceGeo?.dispose(); (this.surfaceMesh.material as THREE.Material).dispose(); }
    if (this.wireMesh)    { this.scene.remove(this.wireMesh);    (this.wireMesh.material as THREE.Material).dispose(); }
    for (const o of this.labelObjects) {
      this.scene.remove(o);
      if (o instanceof THREE.Sprite) { o.material.map?.dispose(); o.material.dispose(); }
    }
    this.labelObjects = [];
    this.hoveredValue.set(null);
    if (this.hoverSphere) this.hoverSphere.visible = false;

    const grid = this.data();
    if (!grid.length || !grid[0].length) return;

    const R = grid.length;
    const C = grid[0].length;
    const SW = 10;
    const SD = 10;
    const MAX_H = 4.5;

    const flat = grid.flat().filter(isFinite);
    const minV = Math.min(...flat);
    const maxV = Math.max(...flat, minV + 0.001);
    const range = maxV - minV;

    const vCount = R * C;
    const positions = new Float32Array(vCount * 3);
    const colors    = new Float32Array(vCount * 3);

    this.targetY  = new Float32Array(vCount);
    this.currentY = new Float32Array(vCount);

    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        const i  = r * C + c;
        const x  = (c / (C - 1) - 0.5) * SW;
        const z  = (r / (R - 1) - 0.5) * SD;
        const t  = ((grid[r][c] ?? minV) - minV) / range;
        const y  = t * MAX_H;

        positions[i * 3]     = x;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = z;

        this.targetY[i]  = y;
        this.currentY[i] = 0;

        const col = this.valueToColor(t);
        colors[i * 3]     = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;
      }
    }

    const idxCount = (R - 1) * (C - 1) * 6;
    const indices  = new Uint32Array(idxCount);
    let ip = 0;
    for (let r = 0; r < R - 1; r++) {
      for (let c = 0; c < C - 1; c++) {
        const a = r * C + c,       b = r * C + (c + 1);
        const d = (r + 1) * C + c, e = (r + 1) * C + (c + 1);
        indices[ip++] = a; indices[ip++] = b; indices[ip++] = d;
        indices[ip++] = b; indices[ip++] = e; indices[ip++] = d;
      }
    }

    this.surfaceGeo = new THREE.BufferGeometry();
    this.surfaceGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.surfaceGeo.setAttribute('color',    new THREE.BufferAttribute(colors,    3));
    this.surfaceGeo.setIndex(new THREE.BufferAttribute(indices, 1));
    this.surfaceGeo.computeVertexNormals();

    this.surfaceMesh = new THREE.Mesh(this.surfaceGeo, new THREE.MeshPhongMaterial({
      vertexColors: true, shininess: 45, side: THREE.DoubleSide
    }));
    this.scene.add(this.surfaceMesh);

    if (this.showWireframe()) {
      this.wireMesh = new THREE.Mesh(this.surfaceGeo, new THREE.MeshBasicMaterial({
        color: 0x000000, wireframe: true, transparent: true, opacity: 0.1
      }));
      this.scene.add(this.wireMesh);
    }

    this.buildAxisLabels(R, C, SW, SD);
    this.animating = true;
  }

  private buildAxisLabels(R: number, C: number, SW: number, SD: number): void {
    const col  = this.background() === 'dark' ? '#6aaecb' : '#2c4f6a';
    const xLbl = this.xLabels();
    const zLbl = this.zLabels();
    const step = (n: number) => Math.max(1, Math.floor(n / 8));

    if (xLbl.length) {
      for (let c = 0; c < C; c += step(C)) {
        const sp = this.makeSprite(xLbl[c] ?? '', 16, col, 140, 40);
        sp.position.set((c / (C - 1) - 0.5) * SW, -0.3, SD / 2 + 0.9);
        sp.scale.set(1.5, 0.43, 1);
        this.scene.add(sp); this.labelObjects.push(sp);
      }
    }

    if (zLbl.length) {
      for (let r = 0; r < R; r += step(R)) {
        const sp = this.makeSprite(zLbl[r] ?? '', 16, col, 140, 40);
        sp.position.set(-SW / 2 - 0.9, -0.3, (r / (R - 1) - 0.5) * SD);
        sp.scale.set(1.5, 0.43, 1);
        this.scene.add(sp); this.labelObjects.push(sp);
      }
    }
  }

  private valueToColor(t: number): THREE.Color {
    const c = new THREE.Color();
    switch (this.colorScale()) {
      case 'heat':
        if      (t < 0.25) c.lerpColors(new THREE.Color('#0044ff'), new THREE.Color('#00ccff'), t * 4);
        else if (t < 0.5)  c.lerpColors(new THREE.Color('#00ccff'), new THREE.Color('#00ff44'), (t - 0.25) * 4);
        else if (t < 0.75) c.lerpColors(new THREE.Color('#00ff44'), new THREE.Color('#ffee00'), (t - 0.5)  * 4);
        else               c.lerpColors(new THREE.Color('#ffee00'), new THREE.Color('#ff2200'), (t - 0.75) * 4);
        break;
      case 'cool':
        if (t < 0.5) c.lerpColors(new THREE.Color('#e8f4ff'), new THREE.Color('#8844ff'), t * 2);
        else         c.lerpColors(new THREE.Color('#8844ff'), new THREE.Color('#000033'), (t - 0.5) * 2);
        break;
      case 'mono':
        c.lerpColors(new THREE.Color('#1a2a3a'), new THREE.Color('#f0f8ff'), t);
        break;
    }
    return c;
  }

  private makeSprite(text: string, fontSize: number, color: string, cw: number, ch: number): THREE.Sprite {
    const cv  = document.createElement('canvas');
    cv.width  = cw; cv.height = ch;
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, cw, ch);
    ctx.font         = `bold ${fontSize}px system-ui,sans-serif`;
    ctx.fillStyle    = color;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cw / 2, ch / 2);
    const tex = new THREE.CanvasTexture(cv);
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  }

  private readonly onMouseMove = (event: MouseEvent): void => {
    const canvas = this.canvasRef().nativeElement;
    const rect   = canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width)  * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;
  };

  private startLoop(): void {
    const loop = (): void => {
      this.animationId = requestAnimationFrame(loop);

      if (this.animating && this.surfaceGeo) {
        const pos = this.surfaceGeo.attributes['position'] as THREE.BufferAttribute;
        let done = true;
        for (let i = 0; i < this.targetY.length; i++) {
          const t = this.targetY[i];
          if (Math.abs(this.currentY[i] - t) > 0.001) {
            this.currentY[i] = THREE.MathUtils.lerp(this.currentY[i], t, 0.1);
            pos.setY(i, this.currentY[i]);
            done = false;
          } else {
            this.currentY[i] = t;
            pos.setY(i, t);
          }
        }
        pos.needsUpdate = true;
        this.surfaceGeo.computeVertexNormals();
        if (done) this.animating = false;
      }

      if (this.surfaceMesh && this.surfaceGeo) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hits = this.raycaster.intersectObject(this.surfaceMesh);
        if (hits.length && hits[0].face) {
          const face = hits[0].face;
          const pt   = hits[0].point;
          const pos  = this.surfaceGeo.attributes['position'] as THREE.BufferAttribute;
          const C    = this.data()[0].length;

          let bestIdx = face.a, bestD = Infinity;
          for (const vi of [face.a, face.b, face.c]) {
            const d = pt.distanceTo(new THREE.Vector3(pos.getX(vi), pos.getY(vi), pos.getZ(vi)));
            if (d < bestD) { bestD = d; bestIdx = vi; }
          }

          const row = Math.floor(bestIdx / C);
          const col = bestIdx % C;
          const val = this.data()[row]?.[col] ?? 0;
          this.hoveredValue.set(val);
          this.pointHovered.emit({ row, col, value: val });
          if (this.hoverSphere) {
            this.hoverSphere.visible = true;
            this.hoverSphere.position.set(pos.getX(bestIdx), pos.getY(bestIdx), pos.getZ(bestIdx));
          }
        } else {
          this.hoveredValue.set(null);
          if (this.hoverSphere) this.hoverSphere.visible = false;
        }
      }

      this.fpsFrames++;
      const now = performance.now();
      if (now - this.fpsLast >= 1000) {
        this.fps.set(this.fpsFrames);
        this.fpsFrames = 0;
        this.fpsLast   = now;
      }

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
      const w = parent.clientWidth;
      const h = parent.clientHeight || canvas.clientHeight;
      if (!w || !h) return;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
    const canvas = this.canvasRef().nativeElement;
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
  }
}
