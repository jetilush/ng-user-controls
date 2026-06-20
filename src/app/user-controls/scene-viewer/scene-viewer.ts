import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnChanges,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';

export type SceneBackground = 'dark' | 'light' | 'space';

export interface SceneObject {
  type: 'box' | 'sphere' | 'torus' | 'cone' | 'cylinder';
  color?: string;
  wireframe?: boolean;
  positionX?: number;
  positionY?: number;
  positionZ?: number;
  scale?: number;
}

@Component({
  selector: 'uc-scene-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scene-viewer.html',
  styleUrl: './scene-viewer.scss'
})
export class SceneViewerComponent implements AfterViewInit, OnChanges {
  readonly label = input('3D Scene');
  readonly background = input<SceneBackground>('dark');
  readonly objects = input<readonly SceneObject[]>([]);
  readonly autoRotate = input(true);
  readonly showGrid = input(true);
  readonly showAxes = input(false);
  readonly height = input('480px');

  readonly objectClicked = output<SceneObject>();

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('sceneCanvas');
  private readonly destroyRef = inject(DestroyRef);

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private animationId = 0;
  private meshes: Array<{ mesh: THREE.Mesh; obj: SceneObject }> = [];
  private resizeObserver!: ResizeObserver;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  readonly fps = signal(0);
  private fpsFrames = 0;
  private fpsLast = performance.now();

  ngAfterViewInit(): void {
    this.initScene();
    this.buildObjects();
    this.startLoop();
    this.watchResize();

    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(this.animationId);
      this.resizeObserver?.disconnect();
      this.renderer?.dispose();
    });
  }

  ngOnChanges(): void {
    if (!this.scene) {
      return;
    }

    this.applyBackground();
    this.buildObjects();
  }

  onCanvasClick(event: MouseEvent): void {
    const canvas = this.canvasRef().nativeElement;
    const rect = canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(this.meshes.map((m) => m.mesh));

    if (intersects.length > 0) {
      const hit = intersects[0].object as THREE.Mesh;
      const found = this.meshes.find((m) => m.mesh === hit);
      if (found) {
        this.objectClicked.emit(found.obj);
      }
    }
  }

  private initScene(): void {
    const canvas = this.canvasRef().nativeElement;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    this.scene = new THREE.Scene();
    this.applyBackground();

    this.camera = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    this.camera.position.set(4, 3.5, 6);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.autoRotate = this.autoRotate();
    this.controls.autoRotateSpeed = 0.8;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(6, 10, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.setScalar(1024);
    this.scene.add(dirLight);

    const fillLight = new THREE.PointLight(0x4488ff, 0.6, 30);
    fillLight.position.set(-6, 4, -6);
    this.scene.add(fillLight);

    if (this.showGrid()) {
      const grid = new THREE.GridHelper(14, 14, 0x444466, 0x222244);
      grid.position.y = -1.5;
      this.scene.add(grid);
    }

    if (this.showAxes()) {
      this.scene.add(new THREE.AxesHelper(4));
    }
  }

  private applyBackground(): void {
    const bg = this.background();
    if (bg === 'dark') {
      this.scene.background = new THREE.Color(0x10182a);
      this.scene.fog = new THREE.FogExp2(0x10182a, 0.035);
    } else if (bg === 'space') {
      this.scene.background = new THREE.Color(0x020409);
      this.scene.fog = new THREE.FogExp2(0x020409, 0.022);
      this.addStarfield();
    } else {
      this.scene.background = new THREE.Color(0xf0f4fb);
      this.scene.fog = new THREE.FogExp2(0xf0f4fb, 0.03);
    }
  }

  private addStarfield(): void {
    const existing = this.scene.getObjectByName('starfield');
    if (existing) {
      return;
    }

    const geometry = new THREE.BufferGeometry();
    const count = 2000;
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 200;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.18 });
    const stars = new THREE.Points(geometry, mat);
    stars.name = 'starfield';
    this.scene.add(stars);
  }

  private buildObjects(): void {
    for (const { mesh } of this.meshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }

    this.meshes = [];

    const sourceObjects = this.objects().length > 0 ? this.objects() : this.defaultObjects();

    for (const obj of sourceObjects) {
      const geometry = this.buildGeometry(obj.type);
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(obj.color ?? '#4f8ef7'),
        wireframe: obj.wireframe ?? false,
        metalness: 0.25,
        roughness: 0.55
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(obj.positionX ?? 0, obj.positionY ?? 0, obj.positionZ ?? 0);
      const s = obj.scale ?? 1;
      mesh.scale.set(s, s, s);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      this.scene.add(mesh);
      this.meshes.push({ mesh, obj });
    }
  }

  private buildGeometry(type: SceneObject['type']): THREE.BufferGeometry {
    switch (type) {
      case 'sphere':
        return new THREE.SphereGeometry(0.9, 48, 48);
      case 'torus':
        return new THREE.TorusGeometry(0.75, 0.28, 24, 72);
      case 'cone':
        return new THREE.ConeGeometry(0.8, 1.6, 48);
      case 'cylinder':
        return new THREE.CylinderGeometry(0.6, 0.6, 1.6, 48);
      default:
        return new THREE.BoxGeometry(1.2, 1.2, 1.2);
    }
  }

  private defaultObjects(): SceneObject[] {
    return [
      { type: 'box', color: '#3b82f6', positionX: -2.5, positionY: 0.1 },
      { type: 'sphere', color: '#22d3ee', positionX: 0, positionY: 0 },
      { type: 'torus', color: '#a78bfa', positionX: 2.5, positionY: 0.1 },
      { type: 'cone', color: '#f59e0b', positionX: -1.2, positionY: 0.1, positionZ: -2.2, scale: 0.85 },
      { type: 'cylinder', color: '#34d399', positionX: 1.2, positionY: 0.1, positionZ: -2.2, scale: 0.85 }
    ];
  }

  private startLoop(): void {
    const loop = () => {
      this.animationId = requestAnimationFrame(loop);

      this.controls.autoRotate = this.autoRotate();
      this.controls.update();

      for (const { mesh } of this.meshes) {
        mesh.rotation.x += 0.003;
        mesh.rotation.y += 0.007;
      }

      this.renderer.render(this.scene, this.camera);
      this.trackFps();
    };

    loop();
  }

  private trackFps(): void {
    this.fpsFrames++;
    const now = performance.now();
    if (now - this.fpsLast >= 1000) {
      this.fps.set(this.fpsFrames);
      this.fpsFrames = 0;
      this.fpsLast = now;
    }
  }

  private watchResize(): void {
    const canvas = this.canvasRef().nativeElement;
    const container = canvas.parentElement!;

    this.resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });

    this.resizeObserver.observe(container);
  }
}
