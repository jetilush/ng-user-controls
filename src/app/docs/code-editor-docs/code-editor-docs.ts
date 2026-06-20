import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CodeEditorComponent } from '../../user-controls/code-editor/code-editor';

@Component({
  selector: 'app-code-editor-docs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CodeEditorComponent],
  templateUrl: './code-editor-docs.html',
  styleUrl: './code-editor-docs.scss'
})
export class CodeEditorDocsComponent {
  protected readonly currentCode = signal(`type TeamMember = {
  id: string;
  name: string;
  role: 'designer' | 'developer' | 'qa';
};

const team: TeamMember[] = [
  { id: '1', name: 'Ana Silva', role: 'designer' },
  { id: '2', name: 'James Carter', role: 'developer' },
  { id: '3', name: 'Mina Park', role: 'qa' }
];

export function activeMemberNames(list: TeamMember[]): string[] {
  return list.map((member) => member.name);
}

console.log(activeMemberNames(team));
`);

  protected readonly usageCode = `<uc-code-editor
  label="TypeScript Example"
  [value]="currentCode()"
  language="typescript"
  theme="vs-dark"
  height="420px"
  (valueChanged)="onCodeChanged($event)"
/>`;

  protected onCodeChanged(value: string): void {
    this.currentCode.set(value);
  }
}
