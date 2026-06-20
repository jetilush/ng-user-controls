import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  SurfaceColorScale,
  SurfacePlotComponent,
  SurfacePointEvent
} from '../../user-controls/surface-plot/surface-plot';

type PresetKey = 'ripple' | 'saddle' | 'hills' | 'peaks';

function makeGrid(N: number, fn: (x: number, z: number) => number): number[][] {
  const grid: number[][] = [];
  for (let r = 0; r < N; r++) {
    const row: number[] = [];
    for (let c = 0; c < N; c++) {
      const x = (c / (N - 1)) * 2 * Math.PI - Math.PI;
      const z = (r / (N - 1)) * 2 * Math.PI - Math.PI;
      row.push(fn(x, z));
    }
    grid.push(row);
  }
  return grid;
}

const N = 36;

const PRESETS: Record<PresetKey, number[][]> = {
  ripple: makeGrid(N, (x, z) => {
    const r = Math.sqrt(x * x + z * z);
    return Math.sin(r * 2.0) / (r * 0.4 + 0.2);
  }),
  saddle: makeGrid(N, (x, z) => (x * x - z * z) * 0.28),
  hills:  makeGrid(N, (x, z) => Math.sin(x * 1.4) * Math.cos(z * 1.4)),
  peaks:  makeGrid(N, (x, z) => {
    const g = (cx: number, cz: number, h: number, s: number) =>
      h * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * s * s));
    return g(0, 0, 2, 1.1) + g(-2, -2, 1.6, 0.75) + g(2, 1.5, 1.8, 0.85) + g(-1.5, 2, 1.1, 0.65);
  })
};

@Component({
  selector: 'app-surface-plot-docs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SurfacePlotComponent],
  templateUrl: './surface-plot-docs.html',
  styleUrl: './surface-plot-docs.scss'
})
export class SurfacePlotDocsComponent {
  protected readonly preset      = signal<PresetKey>('ripple');
  protected readonly colorScale  = signal<SurfaceColorScale>('heat');
  protected readonly wireframe   = signal(true);
  protected readonly autoRotate  = signal(false);
  protected readonly lastHovered = signal<SurfacePointEvent | null>(null);

  protected readonly presets: PresetKey[]                  = ['ripple', 'saddle', 'hills', 'peaks'];
  protected readonly colorScales: SurfaceColorScale[]      = ['heat', 'cool', 'mono'];
  protected readonly presetLabels: Record<PresetKey, string> = {
    ripple: 'Ripple',
    saddle: 'Saddle',
    hills:  'Hills',
    peaks:  'Peaks'
  };

  protected get activeData(): number[][] {
    return PRESETS[this.preset()];
  }

  protected readonly usageCode =
`<uc-surface-plot
  label="My Surface"
  [data]="grid()"
  colorScale="heat"
  [showWireframe]="true"
  [autoRotate]="false"
  height="460px"
  (pointHovered)="onHover($event)"
/>`;

  protected setPreset(key: PresetKey): void {
    this.preset.set(key);
  }

  protected setScale(s: SurfaceColorScale): void {
    this.colorScale.set(s);
  }

  protected toggleWireframe(): void {
    this.wireframe.update((v) => !v);
  }

  protected toggleAutoRotate(): void {
    this.autoRotate.update((v) => !v);
  }

  protected onPointHovered(ev: SurfacePointEvent): void {
    this.lastHovered.set(ev);
  }
}
