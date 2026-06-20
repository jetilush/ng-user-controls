import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TreeViewCheckState, TreeViewComponent, TreeViewNode } from '../../user-controls/tree-view/tree-view';

@Component({
  selector: 'app-tree-view-docs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TreeViewComponent],
  templateUrl: './tree-view-docs.html',
  styleUrl: './tree-view-docs.scss'
})
export class TreeViewDocsComponent {
  private readonly initialNodes: readonly TreeViewNode[] = [
    {
      id: 'platform',
      label: 'Platform',
      expanded: true,
      children: [
        {
          id: 'platform-web',
          label: 'Web',
          expanded: true,
          children: [
            { id: 'platform-web-landing', label: 'Landing' },
            { id: 'platform-web-dashboard', label: 'Dashboard' }
          ]
        },
        {
          id: 'platform-api',
          label: 'API',
          children: [
            { id: 'platform-api-auth', label: 'Auth Service' },
            { id: 'platform-api-users', label: 'Users Service' }
          ]
        }
      ]
    },
    {
      id: 'operations',
      label: 'Operations',
      children: [
        { id: 'operations-monitoring', label: 'Monitoring' },
        { id: 'operations-alerts', label: 'Alerts' },
        { id: 'operations-security', label: 'Security' }
      ]
    },
    {
      id: 'design-system',
      label: 'Design System',
      children: [
        { id: 'design-system-tokens', label: 'Tokens' },
        { id: 'design-system-components', label: 'Components' }
      ]
    }
  ];

  protected readonly nodes = signal<readonly TreeViewNode[]>(this.initialNodes);
  protected readonly selectedNode = signal<TreeViewNode | null>(null);
  protected readonly checkState = signal<TreeViewCheckState>({
    checkedIds: [],
    indeterminateIds: []
  });

  protected readonly usageCode = `<uc-tree-view
  label="Project tree"
  [nodes]="nodes()"
  [checkable]="true"
  [draggable]="true"
  (nodeSelected)="onNodeSelected($event)"
  (nodesReordered)="onNodesReordered($event)"
  (checkedStateChanged)="onCheckedStateChanged($event)"
/>`;

  protected onNodeSelected(node: TreeViewNode): void {
    this.selectedNode.set(node);
  }

  protected onNodesReordered(nodes: readonly TreeViewNode[]): void {
    this.nodes.set(nodes);
  }

  protected onCheckedStateChanged(state: TreeViewCheckState): void {
    this.checkState.set(state);
  }

  protected resetTree(): void {
    this.nodes.set(this.initialNodes);
    this.selectedNode.set(null);
    this.checkState.set({ checkedIds: [], indeterminateIds: [] });
  }
}
