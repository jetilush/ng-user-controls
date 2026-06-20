import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { GraphEdge, GraphNode, NetworkGraphComponent } from '../../user-controls/network-graph/network-graph';

type TopologyKey = 'architecture' | 'star' | 'social' | 'deps';

interface Topology { nodes: GraphNode[]; edges: GraphEdge[]; }

const TOPOLOGIES: Record<TopologyKey, Topology> = {
  architecture: {
    nodes: [
      { id: 'ui',     label: 'UI',      color: '#34d399' },
      { id: 'cdn',    label: 'CDN',     color: '#f87171' },
      { id: 'auth',   label: 'Auth',    color: '#3b82f6' },
      { id: 'api',    label: 'API',     color: '#22d3ee', size: 1.3 },
      { id: 'db',     label: 'DB',      color: '#a78bfa', size: 1.3 },
      { id: 'cache',  label: 'Cache',   color: '#f59e0b' },
      { id: 'queue',  label: 'Queue',   color: '#fb923c' },
      { id: 'worker', label: 'Worker',  color: '#e879f9' }
    ],
    edges: [
      { from: 'ui',     to: 'cdn'    }, { from: 'ui',     to: 'auth'   },
      { from: 'ui',     to: 'api'    }, { from: 'auth',   to: 'api'    },
      { from: 'api',    to: 'db'     }, { from: 'api',    to: 'cache'  },
      { from: 'api',    to: 'queue'  }, { from: 'queue',  to: 'worker' },
      { from: 'worker', to: 'db'     }, { from: 'cache',  to: 'db'     }
    ]
  },
  star: {
    nodes: [
      { id: 'hub', label: 'Hub',      color: '#f59e0b', size: 1.7 },
      { id: 'c1',  label: 'Client A', color: '#3b82f6' },
      { id: 'c2',  label: 'Client B', color: '#22d3ee' },
      { id: 'c3',  label: 'Client C', color: '#a78bfa' },
      { id: 'c4',  label: 'Client D', color: '#34d399' },
      { id: 'c5',  label: 'Client E', color: '#f87171' },
      { id: 'c6',  label: 'Client F', color: '#fb923c' },
      { id: 'c7',  label: 'Client G', color: '#e879f9' },
      { id: 'c8',  label: 'Client H', color: '#60a5fa' }
    ],
    edges: [
      { from: 'hub', to: 'c1' }, { from: 'hub', to: 'c2' },
      { from: 'hub', to: 'c3' }, { from: 'hub', to: 'c4' },
      { from: 'hub', to: 'c5' }, { from: 'hub', to: 'c6' },
      { from: 'hub', to: 'c7' }, { from: 'hub', to: 'c8' }
    ]
  },
  social: {
    nodes: [
      { id: 'alice', label: 'Alice', color: '#f87171' },
      { id: 'bob',   label: 'Bob',   color: '#3b82f6' },
      { id: 'carol', label: 'Carol', color: '#a78bfa' },
      { id: 'dave',  label: 'Dave',  color: '#34d399' },
      { id: 'eve',   label: 'Eve',   color: '#f59e0b' },
      { id: 'frank', label: 'Frank', color: '#22d3ee' },
      { id: 'grace', label: 'Grace', color: '#e879f9' },
      { id: 'henry', label: 'Henry', color: '#fb923c' },
      { id: 'iris',  label: 'Iris',  color: '#60a5fa' },
      { id: 'jack',  label: 'Jack',  color: '#4ade80' }
    ],
    edges: [
      { from: 'alice', to: 'bob'   }, { from: 'alice', to: 'carol' },
      { from: 'alice', to: 'eve'   }, { from: 'bob',   to: 'dave'  },
      { from: 'bob',   to: 'frank' }, { from: 'carol', to: 'grace' },
      { from: 'carol', to: 'dave'  }, { from: 'dave',  to: 'henry' },
      { from: 'eve',   to: 'iris'  }, { from: 'eve',   to: 'frank' },
      { from: 'frank', to: 'jack'  }, { from: 'grace', to: 'iris'  },
      { from: 'henry', to: 'jack'  }
    ]
  },
  deps: {
    nodes: [
      { id: 'app',     label: 'App',        color: '#34d399', size: 1.4 },
      { id: 'angular', label: 'Angular',    color: '#f87171', size: 1.2 },
      { id: 'rxjs',    label: 'RxJS',       color: '#a78bfa' },
      { id: 'ts',      label: 'TypeScript', color: '#3b82f6' },
      { id: 'three',   label: 'Three.js',   color: '#f59e0b' },
      { id: 'cdk',     label: 'CDK',        color: '#22d3ee' },
      { id: 'zone',    label: 'Zone.js',    color: '#fb923c' },
      { id: 'node',    label: 'Node.js',    color: '#60a5fa', size: 1.2 },
      { id: 'npm',     label: 'npm',        color: '#e879f9' }
    ],
    edges: [
      { from: 'app',     to: 'angular' }, { from: 'app',     to: 'three'   },
      { from: 'app',     to: 'node'    }, { from: 'angular', to: 'rxjs'    },
      { from: 'angular', to: 'ts'      }, { from: 'angular', to: 'cdk'     },
      { from: 'angular', to: 'zone'    }, { from: 'cdk',     to: 'rxjs'    },
      { from: 'rxjs',    to: 'ts'      }, { from: 'node',    to: 'npm'     },
      { from: 'three',   to: 'ts'      }
    ]
  }
};

@Component({
  selector: 'app-network-graph-docs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NetworkGraphComponent],
  templateUrl: './network-graph-docs.html',
  styleUrl: './network-graph-docs.scss'
})
export class NetworkGraphDocsComponent {
  private readonly graphRef = viewChild(NetworkGraphComponent);

  protected readonly topologyKey = signal<TopologyKey>('architecture');
  protected readonly showLabels  = signal(true);
  protected readonly autoRotate  = signal(false);
  protected readonly lastNode    = signal<GraphNode | null>(null);
  protected readonly lastEdge    = signal<GraphEdge | null>(null);

  protected readonly topologyKeys: TopologyKey[]                  = ['architecture', 'star', 'social', 'deps'];
  protected readonly topologyLabels: Record<TopologyKey, string>  = {
    architecture: 'System Arch',
    star:         'Star',
    social:       'Social',
    deps:         'Dependencies'
  };

  protected get activeTopology(): Topology {
    return TOPOLOGIES[this.topologyKey()];
  }

  protected readonly usageCode =
`<uc-network-graph
  label="My Graph"
  [nodes]="nodes()"
  [edges]="edges()"
  [showLabels]="true"
  height="460px"
  (nodeClicked)="onNode($event)"
  (edgeClicked)="onEdge($event)"
/>`;

  protected setTopology(key: TopologyKey): void {
    this.topologyKey.set(key);
  }

  protected toggleLabels(): void {
    this.showLabels.update((v) => !v);
  }

  protected toggleAutoRotate(): void {
    this.autoRotate.update((v) => !v);
  }

  protected onResetLayout(): void {
    this.graphRef()?.resetLayout();
  }

  protected onNodeClicked(node: GraphNode): void {
    this.lastNode.set(node);
    this.lastEdge.set(null);
  }

  protected onEdgeClicked(edge: GraphEdge): void {
    this.lastEdge.set(edge);
    this.lastNode.set(null);
  }
}
