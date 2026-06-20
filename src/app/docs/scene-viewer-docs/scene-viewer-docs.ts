import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { SceneBackground, SceneObject, SceneViewerComponent } from '../../user-controls/scene-viewer/scene-viewer';

@Component({
  selector: 'app-scene-viewer-docs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SceneViewerComponent],
  templateUrl: './scene-viewer-docs.html',
  styleUrl: './scene-viewer-docs.scss'
})
export class SceneViewerDocsComponent {
  protected readonly background = signal<SceneBackground>('dark');
  protected readonly autoRotate = signal(true);
  protected readonly showGrid = signal(true);
  protected readonly lastClicked = signal<SceneObject | null>(null);

  protected readonly customObjects = signal<readonly SceneObject[]>([
    { type: 'box', color: '#3b82f6', positionX: -2.5, positionY: 0.1 },
    { type: 'sphere', color: '#22d3ee', positionX: 0, positionY: 0 },
    { type: 'torus', color: '#a78bfa', positionX: 2.5, positionY: 0.1 },
    { type: 'cone', color: '#f59e0b', positionX: -1.2, positionY: 0.1, positionZ: -2.2, scale: 0.85 },
    { type: 'cylinder', color: '#34d399', positionX: 1.2, positionY: 0.1, positionZ: -2.2, scale: 0.85 }
  ]);

  protected readonly usageCode = `<uc-scene-viewer
  label="My 3D Scene"
  background="dark"
  [autoRotate]="true"
  [showGrid]="true"
  [objects]="objects()"
  height="460px"
  (objectClicked)="onObjectClicked($event)"
/>`;

  protected readonly backgrounds: SceneBackground[] = ['dark', 'light', 'space'];

  protected onObjectClicked(obj: SceneObject): void {
    this.lastClicked.set(obj);
  }

  protected setBackground(bg: SceneBackground): void {
    this.background.set(bg);
  }

  protected toggleAutoRotate(): void {
    this.autoRotate.update((v) => !v);
  }

  protected toggleGrid(): void {
    this.showGrid.update((v) => !v);
  }
}
