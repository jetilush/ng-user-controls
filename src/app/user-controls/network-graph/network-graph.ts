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

export interface GraphNode {
  id: string;
  label?: string;
  color?: string;
  size?: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  color?: string;
}

export type GraphBackground = 'dark' | 'light';

interface NodePhysics {
  node: GraphNode;
  mesh: THREE.Mesh;
  sprite: THREE.Sprite | null;
  index: number;
  vx: number; vy: number; vz: number;
}

@Component({
  selector: 'uc-network-graph',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './network-graph.html',
  styleUrl: './network-graph.scss'
})
export class NetworkGraphComponent implements AfterViewInit, OnChanges {
  readonly label      = input('Network Graph');
  readonly nodes      = input.required<readonly GraphNode[]>();
  readonly edges      = input.required<readonly GraphEdge[]>();
  readonly showLabels = input(true);
  readonly background = input<GraphBackground>('dark');
  readonly autoRotate = input(false);
  readonly height     = input('460px');

  readonly nodeClicked = output<GraphNode>();
  readonly edgeClicked = output<GraphEdge>();

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('graphCanvas');
  private readonly destroyRef = inject(DestroyRef);

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private animationId = 0;
  private resizeObserver!: ResizeObserver;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2(-9999, -9999);

  private nodePhysics: NodePhysics[] = [];
  private nodeMap = new Map<string, NodePhysics>();
  private edgesData: GraphEdge[] = [];
  private edgeGeo?: THREE.BufferGeometry;
  private edgeLines?: THREE.LineSegments;
  private hoveredMesh: THREE.Mesh | null = null;
  private simFrames = 0;
  private readonly MAX_SIM = 450;

  readonly fps          = signal(0);
  readonly selectedNode = signal<GraphNode | null>(null);
  private fpsFrames = 0;
  private fpsLast   = performance.now();

  ngAfterViewInit(): void {
    this.initScene();
    this.buildGraph();
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
    this.buildGraph();
    this.controls.autoRotate = this.autoRotate();
  }

  /** Public API — rerandomise positions and restart the simulation. */
  resetLayout(): void {
    this.randomizePositions();
    this.simFrames = 0;
  }

  // ── Scene init ─────────────────────────────────────────────────────────────

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
    this.camera.position.set(0, 0, 22);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping   = true;
    this.controls.dampingFactor   = 0.06;
    this.controls.minDistance     = 3;
    this.controls.maxDistance     = 60;
    this.controls.autoRotate      = this.autoRotate();
    this.controls.autoRotateSpeed = 0.6;

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(10, 15, 10);
    this.scene.add(dir);
    const fill = new THREE.DirectionalLight(0x4488cc, 0.3);
    fill.position.set(-8, 5, -8);
    this.scene.add(fill);

    // Edge raycasting threshold
    (this.raycaster.params as unknown as Record<string, unknown>)['Line'] = { threshold: 0.28 };

    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('click', this.onClick);
  }

  private applyBackground(): void {
    const col = this.background() === 'dark' ? 0x08141e : 0xe8f0f8;
    this.scene.background = new THREE.Color(col);
    this.scene.fog = new THREE.FogExp2(col, 0.022);
  }

  // ── Graph build ─────────────────────────────────────────────────────────────

  private buildGraph(): void {
    for (const np of this.nodePhysics) {
      this.scene.remove(np.mesh);
      np.mesh.geometry.dispose();
      (np.mesh.material as THREE.Material).dispose();
      if (np.sprite) { this.scene.remove(np.sprite); np.sprite.material.map?.dispose(); np.sprite.material.dispose(); }
    }
    this.nodePhysics = [];
    this.nodeMap.clear();

    if (this.edgeLines) {
      this.scene.remove(this.edgeLines);
      this.edgeGeo?.dispose();
      (this.edgeLines.material as THREE.Material).dispose();
      this.edgeLines = undefined;
    }

    this.selectedNode.set(null);
    this.hoveredMesh = null;
    this.edgesData = [...this.edges()];

    const nodesData = this.nodes();
    if (!nodesData.length) return;

    const isDark = this.background() === 'dark';
    const labelColor = isDark ? '#c8e4ff' : '#1a3a55';

    for (const node of nodesData) {
      const r   = 0.4 * (node.size ?? 1);
      const geo = new THREE.SphereGeometry(r, 24, 24);
      const mat = new THREE.MeshPhongMaterial({
        color:    new THREE.Color(node.color ?? '#4488cc'),
        emissive: new THREE.Color(0x000000),
        shininess: 80,
        specular:  new THREE.Color(0x223344)
      });
      const mesh = new THREE.Mesh(geo, mat);
      this.scene.add(mesh);

      let sprite: THREE.Sprite | null = null;
      if (this.showLabels()) {
        sprite = this.makeSprite(node.label ?? node.id, labelColor);
        sprite.scale.set(1.5, 0.4, 1);
        this.scene.add(sprite);
      }

      const np: NodePhysics = { node, mesh, sprite, index: this.nodePhysics.length, vx: 0, vy: 0, vz: 0 };
      this.nodePhysics.push(np);
      this.nodeMap.set(node.id, np);
    }

    this.randomizePositions();

    if (this.edgesData.length) {
      const positions = new Float32Array(this.edgesData.length * 6);
      const colors    = new Float32Array(this.edgesData.length * 6);

      for (let i = 0; i < this.edgesData.length; i++) {
        const c = new THREE.Color(this.edgesData[i].color ?? '#1e3a5a');
        colors[i * 6]     = c.r; colors[i * 6 + 1] = c.g; colors[i * 6 + 2] = c.b;
        colors[i * 6 + 3] = c.r; colors[i * 6 + 4] = c.g; colors[i * 6 + 5] = c.b;
      }

      this.edgeGeo = new THREE.BufferGeometry();
      this.edgeGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      this.edgeGeo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

      this.edgeLines = new THREE.LineSegments(
        this.edgeGeo,
        new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55 })
      );
      this.scene.add(this.edgeLines);
    }

    this.simFrames = 0;
  }

  private randomizePositions(): void {
    for (const np of this.nodePhysics) {
      const r     = 5 * Math.cbrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      np.mesh.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
      np.vx = np.vy = np.vz = 0;
    }
  }

  // ── Physics ─────────────────────────────────────────────────────────────────

  private stepPhysics(): void {
    const N  = this.nodePhysics.length;
    const fx = new Float32Array(N);
    const fy = new Float32Array(N);
    const fz = new Float32Array(N);

    // Repulsion (all pairs)
    const K_REP = 7.0;
    for (let i = 0; i < N; i++) {
      const pi = this.nodePhysics[i].mesh.position;
      for (let j = i + 1; j < N; j++) {
        const pj = this.nodePhysics[j].mesh.position;
        const dx = pi.x - pj.x, dy = pi.y - pj.y, dz = pi.z - pj.z;
        const d2 = Math.max(dx * dx + dy * dy + dz * dz, 0.25);
        const d  = Math.sqrt(d2);
        const f  = K_REP / d2;
        fx[i] += f * dx / d; fy[i] += f * dy / d; fz[i] += f * dz / d;
        fx[j] -= f * dx / d; fy[j] -= f * dy / d; fz[j] -= f * dz / d;
      }
    }

    // Spring attraction along edges
    const K_SPR = 0.04;
    const REST  = 3.2;
    for (const edge of this.edgesData) {
      const ni = this.nodeMap.get(edge.from);
      const nj = this.nodeMap.get(edge.to);
      if (!ni || !nj) continue;
      const dx = nj.mesh.position.x - ni.mesh.position.x;
      const dy = nj.mesh.position.y - ni.mesh.position.y;
      const dz = nj.mesh.position.z - ni.mesh.position.z;
      const d  = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 0.1);
      const f  = K_SPR * (d - REST);
      fx[ni.index] += f * dx / d; fy[ni.index] += f * dy / d; fz[ni.index] += f * dz / d;
      fx[nj.index] -= f * dx / d; fy[nj.index] -= f * dy / d; fz[nj.index] -= f * dz / d;
    }

    // Centre gravity + integrate
    const K_GRAV = 0.005;
    const DAMP   = 0.88;
    let energy = 0;

    for (let i = 0; i < N; i++) {
      const np = this.nodePhysics[i];
      fx[i] -= np.mesh.position.x * K_GRAV;
      fy[i] -= np.mesh.position.y * K_GRAV;
      fz[i] -= np.mesh.position.z * K_GRAV;

      np.vx = (np.vx + fx[i]) * DAMP;
      np.vy = (np.vy + fy[i]) * DAMP;
      np.vz = (np.vz + fz[i]) * DAMP;
      np.mesh.position.x += np.vx;
      np.mesh.position.y += np.vy;
      np.mesh.position.z += np.vz;
      energy += np.vx * np.vx + np.vy * np.vy + np.vz * np.vz;
    }

    if (energy < 0.001) this.simFrames = this.MAX_SIM;
  }

  private updateEdges(): void {
    if (!this.edgeGeo || !this.edgesData.length) return;
    const pos = this.edgeGeo.attributes['position'] as THREE.BufferAttribute;
    for (let i = 0; i < this.edgesData.length; i++) {
      const fn = this.nodeMap.get(this.edgesData[i].from);
      const tn = this.nodeMap.get(this.edgesData[i].to);
      if (!fn || !tn) continue;
      pos.setXYZ(i * 2,     fn.mesh.position.x, fn.mesh.position.y, fn.mesh.position.z);
      pos.setXYZ(i * 2 + 1, tn.mesh.position.x, tn.mesh.position.y, tn.mesh.position.z);
    }
    pos.needsUpdate = true;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private makeSprite(text: string, color: string): THREE.Sprite {
    const cv  = document.createElement('canvas');
    cv.width  = 192; cv.height = 48;
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, 192, 48);
    ctx.font = 'bold 20px system-ui,sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 96, 24);
    return new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false
    }));
  }

  // ── Events ──────────────────────────────────────────────────────────────────

  private readonly onMouseMove = (e: MouseEvent): void => {
    const c = this.canvasRef().nativeElement;
    const r = c.getBoundingClientRect();
    this.mouse.x =  ((e.clientX - r.left) / r.width)  * 2 - 1;
    this.mouse.y = -((e.clientY - r.top)  / r.height) * 2 + 1;
  };

  private readonly onClick = (): void => {
    if (this.hoveredMesh) {
      const np = this.nodePhysics.find((n) => n.mesh === this.hoveredMesh);
      if (np) { this.selectedNode.set(np.node); this.nodeClicked.emit(np.node); }
      return;
    }
    if (this.edgeLines) {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const hits = this.raycaster.intersectObject(this.edgeLines);
      const idx  = (hits[0] as unknown as Record<string, number> | undefined)?.['index'];
      if (idx !== undefined) {
        const edge = this.edgesData[Math.floor(idx / 2)];
        if (edge) this.edgeClicked.emit(edge);
      }
    }
  };

  // ── Render loop ─────────────────────────────────────────────────────────────

  private startLoop(): void {
    const loop = (): void => {
      this.animationId = requestAnimationFrame(loop);

      if (this.simFrames < this.MAX_SIM) {
        this.stepPhysics();
        this.simFrames++;
        this.updateEdges();
        for (const np of this.nodePhysics) {
          if (np.sprite) {
            const r = 0.4 * (np.node.size ?? 1);
            np.sprite.position.set(np.mesh.position.x, np.mesh.position.y + r + 0.38, np.mesh.position.z);
          }
        }
      }

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const hits = this.raycaster.intersectObjects(this.nodePhysics.map((n) => n.mesh));
      const hit  = (hits[0]?.object as THREE.Mesh | undefined) ?? null;
      if (hit !== this.hoveredMesh) {
        if (this.hoveredMesh) (this.hoveredMesh.material as THREE.MeshPhongMaterial).emissive.setHex(0x000000);
        if (hit) (hit.material as THREE.MeshPhongMaterial).emissive.setHex(0x1e4060);
        this.hoveredMesh = hit;
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
