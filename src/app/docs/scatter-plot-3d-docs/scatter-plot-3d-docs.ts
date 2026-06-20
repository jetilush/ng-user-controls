import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ScatterPlot3dComponent, ScatterPoint } from '../../user-controls/scatter-plot-3d/scatter-plot-3d';

type PresetKey = 'clusters' | 'helix' | 'shell' | 'wave';

// Normal distribution sample (Box-Muller)
function randn(): number {
  const u = Math.max(1e-10, Math.random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

function makeClusters(): ScatterPoint[] {
  const groups = [
    { cx: 2, cy: 2, cz: 2, series: 'Alpha', color: '#3b82f6' },
    { cx: 8, cy: 7, cz: 2, series: 'Beta',  color: '#f59e0b' },
    { cx: 4, cy: 3, cz: 8, series: 'Gamma', color: '#34d399' }
  ];
  const pts: ScatterPoint[] = [];
  for (const g of groups) {
    for (let i = 0; i < 60; i++) {
      pts.push({ x: g.cx + randn() * 1.1, y: g.cy + randn() * 1.1, z: g.cz + randn() * 1.1, series: g.series, color: g.color });
    }
  }
  return pts;
}

function makeHelix(): ScatterPoint[] {
  const pts: ScatterPoint[] = [];
  for (let t = 0; t <= 6 * Math.PI; t += 0.18) {
    const hue = t / (6 * Math.PI);
    // blue → purple → pink gradient along the helix
    const r = Math.round(59  + hue * 190);
    const g = Math.round(130 - hue * 90);
    const b = Math.round(246 - hue * 10);
    pts.push({
      x: 5 + 4 * Math.cos(t),
      y: t * 10 / (6 * Math.PI),
      z: 5 + 4 * Math.sin(t),
      series: 'Helix',
      color: `rgb(${r},${g},${b})`
    });
  }
  return pts;
}

function makeShell(): ScatterPoint[] {
  const pts: ScatterPoint[] = [];
  for (let i = 0; i < 250; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = 4 + randn() * 0.18;
    pts.push({
      x: 5 + r * Math.sin(phi) * Math.cos(theta),
      y: 5 + r * Math.sin(phi) * Math.sin(theta),
      z: 5 + r * Math.cos(phi),
      series: 'Shell',
      color: '#22d3ee'
    });
  }
  return pts;
}

function makeWave(): ScatterPoint[] {
  const pts: ScatterPoint[] = [];
  const GRID = 18;
  for (let xi = 0; xi < GRID; xi++) {
    for (let zi = 0; zi < GRID; zi++) {
      const x = (xi / (GRID - 1)) * 10;
      const z = (zi / (GRID - 1)) * 10;
      const y = 5 + 3 * Math.sin(x * 0.9) * Math.cos(z * 0.9) + randn() * 0.12;
      // Heat-map color based on y
      const t = (y - 2) / 8;
      const cr = Math.round(Math.min(255, t < 0.5 ? 0 : (t - 0.5) * 510));
      const cg = Math.round(Math.min(255, t < 0.5 ? t * 510 : (1 - t) * 510));
      const cb = Math.round(Math.min(255, t < 0.5 ? 255 - t * 510 : 0));
      pts.push({ x, y, z, series: 'Wave', color: `rgb(${cr},${cg},${cb})` });
    }
  }
  return pts;
}

const PRESETS: Record<PresetKey, ScatterPoint[]> = {
  clusters: makeClusters(),
  helix:    makeHelix(),
  shell:    makeShell(),
  wave:     makeWave()
};

@Component({
  selector: 'app-scatter-plot-3d-docs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScatterPlot3dComponent],
  templateUrl: './scatter-plot-3d-docs.html',
  styleUrl: './scatter-plot-3d-docs.scss'
})
export class ScatterPlot3dDocsComponent {
  protected readonly preset      = signal<PresetKey>('clusters');
  protected readonly autoRotate  = signal(false);
  protected readonly lastClicked = signal<ScatterPoint | null>(null);

  protected readonly presets: PresetKey[]                 = ['clusters', 'helix', 'shell', 'wave'];
  protected readonly presetLabels: Record<PresetKey, string> = {
    clusters: 'Clusters',
    helix:    'Helix',
    shell:    'Shell',
    wave:     'Wave'
  };
  protected readonly presetDesc: Record<PresetKey, string> = {
    clusters: '3 Gaussian clusters · 180 points',
    helix:    'Double-turn helix · gradient color',
    shell:    'Points on a sphere surface · 250 pts',
    wave:     'Sampled sin·cos surface · 324 pts'
  };

  protected get activePoints(): ScatterPoint[] {
    return PRESETS[this.preset()];
  }

  protected readonly usageCode =
`<uc-scatter-plot-3d
  label="My Data"
  [points]="dataPoints()"
  xLabel="Temperature"
  yLabel="Pressure"
  zLabel="Volume"
  height="460px"
  (pointClicked)="onPoint($event)"
/>`;

  protected setPreset(key: PresetKey): void { this.preset.set(key); }
  protected toggleAutoRotate(): void { this.autoRotate.update((v) => !v); }
  protected onPointClicked(pt: ScatterPoint): void { this.lastClicked.set(pt); }
}
