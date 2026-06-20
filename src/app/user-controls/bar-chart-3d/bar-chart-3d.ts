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
  output,
  signal,
  viewChild
} from '@angular/core';

export interface ChartDataSeries {
  name: string;
  color: string;
  values: number[];
}

export interface ChartBarEvent {
  seriesName: string;
  category: string;
  value: number;
  seriesIndex: number;
  categoryIndex: number;
}

export type ChartBackground = 'dark' | 'light';

@Component({
  selector: 'uc-bar-chart-3d',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bar-chart-3d.html',
  styleUrl: './bar-chart-3d.scss'
})
export class BarChart3dComponent implements AfterViewInit, OnChanges {
  readonly label = input('3D Bar Chart');
  readonly categories = input.required<string[]>();
  readonly data = input.required<readonly ChartDataSeries[]>();
  readonly height = input('460px');
  readonly background = input<ChartBackground>('dark');
  readonly autoRotate = input(false);

  readonly barClicked = output<ChartBarEvent>();

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('chartCanvas');
  private readonly destroyRef = inject(DestroyRef);

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private animationId = 0;
  private barMeshes: THREE.Mesh[] = [];
  private chartObjects: THREE.Object3D[] = [];
  private hoveredMesh: THREE.Mesh | null = null;
  private resizeObserver!: ResizeObserver;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2(-9999, -9999);

  readonly fps = signal(0);
  private fpsFrames = 0;
  private fpsLast = performance.now();

  ngAfterViewInit(): void {
    this.initScene();
    this.buildBars();
    this.startLoop();
    this.watchResize();

    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(this.animationId);
      this.resizeObserver?.disconnect();
      const canvas = this.canvasRef().nativeElement;
      canvas.removeEventListener('mousemove', this.onMouseMove);
      canvas.removeEventListener('click', this.onCanvasClick);
      this.controls?.dispose();
      this.renderer?.dispose();
    });
  }

  ngOnChanges(): void {
    if (!this.scene) return;
    this.applyBackground();
    this.buildBars();
    this.controls.autoRotate = this.autoRotate();
  }

  private initScene(): void {
    const canvas = this.canvasRef().nativeElement;
    const w = canvas.clientWidth || 600;
    const h = canvas.clientHeight || 460;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(w, h);

    this.scene = new THREE.Scene();
    this.applyBackground();

    this.camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 200);
    this.camera.position.set(0, 9, 16);
    this.camera.lookAt(0, 2, 0);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 40;
    this.controls.target.set(0, 2, 0);
    this.controls.autoRotate = this.autoRotate();
    this.controls.autoRotateSpeed = 1.0;

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight.position.set(10, 14, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.setScalar(1024);
    this.scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x4488aa, 0.35);
    fillLight.position.set(-8, 4, -8);
    this.scene.add(fillLight);

    const grid = new THREE.GridHelper(30, 30, 0x1e3650, 0x162840);
    this.scene.add(grid);

    const floorGeo = new THREE.PlaneGeometry(30, 30);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x0a1a28, transparent: true, opacity: 0.7 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    floor.position.y = -0.01;
    this.scene.add(floor);

    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('click', this.onCanvasClick);
  }

  private applyBackground(): void {
    const bg = this.background();
    const color = bg === 'light' ? 0xe8f0f8 : 0x08141e;
    this.scene.background = new THREE.Color(color);
    this.scene.fog = new THREE.Fog(color, 22, 55);
  }

  private buildBars(): void {
    // Dispose old bars
    for (const m of this.barMeshes) {
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.barMeshes = [];

    // Dispose old labels / lines
    for (const obj of this.chartObjects) {
      this.scene.remove(obj);
      if (obj instanceof THREE.Sprite) {
        obj.material.map?.dispose();
        obj.material.dispose();
      } else if (obj instanceof THREE.Line) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    }
    this.chartObjects = [];
    this.hoveredMesh = null;

    const data = this.data();
    const categories = this.categories();
    if (!data.length || !categories.length) return;

    const allVals = data.flatMap((s) => s.values.filter(isFinite));
    const maxVal = Math.max(...allVals, 0.001);
    const maxBarH = 5.0;
    const valueScale = maxBarH / maxVal;

    const barW = 0.44;
    const barGap = 0.08;
    const groupGap = 0.9;
    const M = data.length;
    const N = categories.length;
    const groupW = M * barW + (M - 1) * barGap;
    const totalW = N * groupW + (N - 1) * groupGap;

    const isDark = this.background() === 'dark';
    const labelCol = isDark ? '#7aaecb' : '#2c4f6a';
    const valLabelCol = isDark ? '#d8eeff' : '#1a3a55';
    const axisCol = isDark ? 0x2c5070 : 0x4a789a;

    for (let ci = 0; ci < N; ci++) {
      const groupCx = -totalW / 2 + groupW / 2 + ci * (groupW + groupGap);

      for (let si = 0; si < M; si++) {
        const value = data[si].values[ci] ?? 0;
        const targetH = Math.max(value * valueScale, 0.001);

        const geo = new THREE.BoxGeometry(barW, 1, barW);
        geo.translate(0, 0.5, 0);

        const baseColor = new THREE.Color(data[si].color);
        const mat = new THREE.MeshPhongMaterial({
          color: baseColor.clone(),
          emissive: new THREE.Color(0x000000),
          shininess: 70,
          specular: new THREE.Color(0x223344)
        });

        const mesh = new THREE.Mesh(geo, mat);
        const barX = groupCx + (si - (M - 1) / 2) * (barW + barGap);
        mesh.position.set(barX, 0, 0);
        mesh.scale.y = 0.001;
        mesh.castShadow = true;

        mesh.userData = {
          targetHeight: targetH,
          value,
          seriesName: data[si].name,
          seriesIndex: si,
          category: categories[ci],
          categoryIndex: ci
        };

        this.scene.add(mesh);
        this.barMeshes.push(mesh);

        // Value label above bar
        const valStr = Number.isInteger(value) ? String(value) : value.toFixed(1);
        const valSprite = this.makeTextSprite(valStr, 18, valLabelCol, 112, 38);
        valSprite.position.set(barX, targetH + 0.48, 0);
        valSprite.scale.set(1.1, 0.36, 1);
        this.scene.add(valSprite);
        this.chartObjects.push(valSprite);
      }

      // Category label at floor
      const catSprite = this.makeTextSprite(categories[ci], 20, labelCol, 220, 48);
      catSprite.position.set(groupCx, 0, 0.7);
      catSprite.scale.set(2.2, 0.5, 1);
      this.scene.add(catSprite);
      this.chartObjects.push(catSprite);
    }

    // Y axis line
    const axisX = -totalW / 2 - 0.5;
    this.addLine(
      new THREE.Vector3(axisX, 0, 0),
      new THREE.Vector3(axisX, maxBarH + 0.8, 0),
      axisCol
    );

    // Tick marks + labels
    const ticks = 5;
    const lineMat = new THREE.LineBasicMaterial({ color: axisCol });
    for (let t = 0; t <= ticks; t++) {
      const tickY = (maxBarH / ticks) * t;
      const tickVal = (maxVal / ticks) * t;
      const tickStr = Number.isInteger(tickVal) ? String(Math.round(tickVal)) : tickVal.toFixed(1);

      // Tick mark
      const tGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(axisX - 0.1, tickY, 0),
        new THREE.Vector3(axisX + 0.1, tickY, 0)
      ]);
      const tickLine = new THREE.Line(tGeo, lineMat.clone());
      this.scene.add(tickLine);
      this.chartObjects.push(tickLine);

      // Tick label
      const tSprite = this.makeTextSprite(tickStr, 16, labelCol, 88, 34);
      tSprite.position.set(axisX - 1.0, tickY, 0);
      tSprite.scale.set(0.95, 0.33, 1);
      this.scene.add(tSprite);
      this.chartObjects.push(tSprite);
    }
  }

  private addLine(from: THREE.Vector3, to: THREE.Vector3, color: number): void {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({ color });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.chartObjects.push(line);
  }

  private makeTextSprite(text: string, fontSize: number, color: string, cw = 192, ch = 48): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, cw, ch);
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cw / 2, ch / 2);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    return new THREE.Sprite(mat);
  }

  private readonly onMouseMove = (event: MouseEvent): void => {
    const canvas = this.canvasRef().nativeElement;
    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  };

  private readonly onCanvasClick = (): void => {
    if (!this.hoveredMesh) return;
    const ud = this.hoveredMesh.userData;
    this.barClicked.emit({
      seriesName: ud['seriesName'] as string,
      category: ud['category'] as string,
      value: ud['value'] as number,
      seriesIndex: ud['seriesIndex'] as number,
      categoryIndex: ud['categoryIndex'] as number
    });
  };

  private startLoop(): void {
    const loop = (): void => {
      this.animationId = requestAnimationFrame(loop);

      // Animate bar growth (ease-out)
      for (const mesh of this.barMeshes) {
        const target = mesh.userData['targetHeight'] as number;
        if (mesh.scale.y < target - 0.001) {
          mesh.scale.y = THREE.MathUtils.lerp(mesh.scale.y, target, 0.1);
        } else {
          mesh.scale.y = target;
        }
      }

      // Hover detection
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const hits = this.raycaster.intersectObjects(this.barMeshes);
      const hit = (hits[0]?.object as THREE.Mesh | undefined) ?? null;

      if (hit !== this.hoveredMesh) {
        if (this.hoveredMesh) {
          (this.hoveredMesh.material as THREE.MeshPhongMaterial).emissive.setHex(0x000000);
        }
        if (hit && this.barMeshes.includes(hit)) {
          (hit.material as THREE.MeshPhongMaterial).emissive.setHex(0x1e4060);
          this.hoveredMesh = hit;
        } else {
          this.hoveredMesh = null;
        }
      }

      // FPS counter
      this.fpsFrames++;
      const now = performance.now();
      if (now - this.fpsLast >= 1000) {
        this.fps.set(this.fpsFrames);
        this.fpsFrames = 0;
        this.fpsLast = now;
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
      if (w === 0 || h === 0) return;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
    const canvas = this.canvasRef().nativeElement;
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
  }
}
