import loader from '@monaco-editor/loader';
import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, effect, inject, input, output, signal, viewChild } from '@angular/core';
import type * as Monaco from 'monaco-editor';

type EditorTheme = 'vs-dark' | 'vs-light';
type EditorLanguage = 'typescript' | 'javascript' | 'json' | 'html' | 'css' | 'markdown';

@Component({
  selector: 'uc-code-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './code-editor.html',
  styleUrl: './code-editor.scss'
})
export class CodeEditorComponent implements AfterViewInit {
  readonly label = input('Code editor');
  readonly value = input('');
  readonly language = input<EditorLanguage>('typescript');
  readonly theme = input<EditorTheme>('vs-dark');
  readonly readOnly = input(false);
  readonly height = input('360px');

  readonly valueChanged = output<string>();

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('editorHost');
  private readonly destroyRef = inject(DestroyRef);
  private readonly editor = signal<Monaco.editor.IStandaloneCodeEditor | null>(null);
  private readonly monacoApi = signal<typeof Monaco | null>(null);

  constructor() {
    effect(() => {
      const instance = this.editor();
      if (!instance) {
        return;
      }

      const next = this.value();
      const model = instance.getModel();
      if (!model || model.getValue() === next) {
        return;
      }

      model.pushEditOperations(
        [],
        [
          {
            range: model.getFullModelRange(),
            text: next
          }
        ],
        () => null
      );
    });

    effect(() => {
      const instance = this.editor();
      if (!instance) {
        return;
      }

      instance.updateOptions({
        readOnly: this.readOnly()
      });
    });

    effect(() => {
      const instance = this.editor();
      const monaco = this.monacoApi();
      if (!instance || !monaco) {
        return;
      }

      const model = instance.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, this.language());
      }
    });

    effect(() => {
      const monaco = this.monacoApi();
      if (!monaco) {
        return;
      }

      monaco.editor.setTheme(this.theme());
    });

    this.destroyRef.onDestroy(() => {
      this.editor()?.dispose();
    });
  }

  async ngAfterViewInit(): Promise<void> {
    const monaco = await loader.init();
    this.monacoApi.set(monaco);

    const instance = monaco.editor.create(this.host().nativeElement, {
      value: this.value(),
      language: this.language(),
      theme: this.theme(),
      readOnly: this.readOnly(),
      automaticLayout: true,
      minimap: {
        enabled: true
      },
      roundedSelection: true,
      scrollBeyondLastLine: false,
      fontSize: 14,
      lineHeight: 22,
      tabSize: 2,
      padding: {
        top: 12,
        bottom: 12
      }
    });

    const changeDisposable = instance.onDidChangeModelContent(() => {
      this.valueChanged.emit(instance.getValue());
    });

    this.destroyRef.onDestroy(() => {
      changeDisposable.dispose();
    });

    this.editor.set(instance);
  }
}
