import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { Gauge3dComponent, GaugeThreshold } from '../../user-controls/gauge-3d/gauge-3d';

const TRAFFIC: GaugeThreshold[]     = [{ value: 60,  color: '#22c55e' }, { value: 80, color: '#eab308' }, { value: 100, color: '#ef4444' }];
const PERFORMANCE: GaugeThreshold[] = [{ value: 70,  color: '#22c55e' }, { value: 90, color: '#eab308' }, { value: 100, color: '#ef4444' }];
const HEALTH: GaugeThreshold[]      = [{ value: 30,  color: '#ef4444' }, { value: 70, color: '#eab308' }, { value: 100, color: '#22c55e' }];
const TEMP: GaugeThreshold[]        = [{ value: 50,  color: '#3b82f6' }, { value: 75, color: '#eab308' }, { value: 110, color: '#ef4444' }];

type ThemeKey = 'traffic' | 'performance' | 'health' | 'temp';

@Component({
  selector: 'app-gauge-3d-docs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Gauge3dComponent],
  templateUrl: './gauge-3d-docs.html',
  styleUrl: './gauge-3d-docs.scss'
})
export class Gauge3dDocsComponent {
  protected readonly sliderValue    = signal(65);
  protected readonly themeKey       = signal<ThemeKey>('traffic');
  protected readonly background     = signal<'dark' | 'light'>('dark');

  protected readonly themes: ThemeKey[]                      = ['traffic', 'performance', 'health', 'temp'];
  protected readonly themeLabels: Record<ThemeKey, string>   = {
    traffic:     'Traffic Light',
    performance: 'Performance',
    health:      'Health',
    temp:        'Temperature'
  };
  protected readonly themeThresholds: Record<ThemeKey, GaugeThreshold[]> = {
    traffic: TRAFFIC, performance: PERFORMANCE, health: HEALTH, temp: TEMP
  };
  protected readonly themeUnits: Record<ThemeKey, string> = {
    traffic: '%', performance: '%', health: 'pts', temp: '°C'
  };
  protected readonly themeMax: Record<ThemeKey, number> = {
    traffic: 100, performance: 100, health: 100, temp: 110
  };

  // Dashboard gauges (fixed values for display)
  protected readonly dashGauges = [
    { label: 'CPU Usage',  value: 72,  unit: '%',  thresholds: TRAFFIC,     min: 0, max: 100 },
    { label: 'Memory',     value: 88,  unit: '%',  thresholds: PERFORMANCE, min: 0, max: 100 },
    { label: 'Health',     value: 74,  unit: 'pts',thresholds: HEALTH,      min: 0, max: 100 },
    { label: 'CPU Temp',   value: 68,  unit: '°C', thresholds: TEMP,        min: 0, max: 110 }
  ];

  protected readonly usageCode =
`<uc-gauge-3d
  label="CPU Usage"
  [value]="cpuValue()"
  [min]="0"
  [max]="100"
  unit="%"
  [thresholds]="[
    { value: 60,  color: '#22c55e' },
    { value: 80,  color: '#eab308' },
    { value: 100, color: '#ef4444' }
  ]"
  height="380px"
/>`;

  protected onSlider(e: Event): void {
    this.sliderValue.set(+(e.target as HTMLInputElement).value);
  }

  protected setPreset(v: number): void {
    this.sliderValue.set(v);
  }

  protected setTheme(key: ThemeKey): void {
    this.themeKey.set(key);
  }

  protected toggleBackground(): void {
    this.background.update((b) => (b === 'dark' ? 'light' : 'dark'));
  }
}
