import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  BarChart3dComponent,
  ChartBackground,
  ChartBarEvent,
  ChartDataSeries
} from '../../user-controls/bar-chart-3d/bar-chart-3d';

const DATASETS: Record<string, { categories: string[]; data: ChartDataSeries[] }> = {
  regional: {
    categories: ['Q1', 'Q2', 'Q3', 'Q4'],
    data: [
      { name: 'Americas', color: '#3b82f6', values: [42, 58, 75, 91] },
      { name: 'Europe',   color: '#22d3ee', values: [35, 47, 63, 78] },
      { name: 'Asia',     color: '#a78bfa', values: [28, 44, 55, 70] }
    ]
  },
  performance: {
    categories: ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Sprint 5'],
    data: [
      { name: 'Frontend', color: '#34d399', values: [72, 85, 90, 88, 95] },
      { name: 'Backend',  color: '#f59e0b', values: [65, 78, 82, 91, 89] }
    ]
  },
  weather: {
    categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    data: [
      { name: 'Sydney',    color: '#f97316', values: [28, 27, 25, 20, 17, 14] },
      { name: 'New York',  color: '#60a5fa', values: [2, 4, 9, 15, 21, 26]  },
      { name: 'London',    color: '#a3e635', values: [8, 9, 11, 14, 17, 20] }
    ]
  }
};

type DatasetKey = keyof typeof DATASETS;

@Component({
  selector: 'app-bar-chart-3d-docs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BarChart3dComponent],
  templateUrl: './bar-chart-3d-docs.html',
  styleUrl: './bar-chart-3d-docs.scss'
})
export class BarChart3dDocsComponent {
  protected readonly datasetKey = signal<DatasetKey>('regional');
  protected readonly background = signal<ChartBackground>('dark');
  protected readonly autoRotate = signal(false);
  protected readonly lastBar = signal<ChartBarEvent | null>(null);

  protected readonly datasetKeys: DatasetKey[] = ['regional', 'performance', 'weather'];
  protected readonly datasetLabels: Record<DatasetKey, string> = {
    regional: 'Regional Sales',
    performance: 'Team Performance',
    weather: 'Avg Temperature'
  };

  protected get activeDataset() {
    return DATASETS[this.datasetKey()];
  }

  protected readonly usageCode = `<uc-bar-chart-3d
  label="Regional Sales"
  [categories]="['Q1', 'Q2', 'Q3', 'Q4']"
  [data]="seriesData()"
  background="dark"
  [autoRotate]="false"
  height="460px"
  (barClicked)="onBarClicked($event)"
/>`;

  protected setDataset(key: DatasetKey): void {
    this.datasetKey.set(key);
  }

  protected toggleBackground(): void {
    this.background.update((b) => (b === 'dark' ? 'light' : 'dark'));
  }

  protected toggleAutoRotate(): void {
    this.autoRotate.update((v) => !v);
  }

  protected onBarClicked(event: ChartBarEvent): void {
    this.lastBar.set(event);
  }
}
