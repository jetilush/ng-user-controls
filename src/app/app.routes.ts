import { Routes } from '@angular/router';

export const routes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'docs/list-view'
	},
	{
		path: 'docs/list-view',
		loadComponent: () => import('./docs/list-view-docs/list-view-docs').then((m) => m.ListViewDocsComponent)
	},
	{
		path: 'docs/code-editor',
		loadComponent: () => import('./docs/code-editor-docs/code-editor-docs').then((m) => m.CodeEditorDocsComponent)
	},
	{
		path: 'docs/data-grid',
		loadComponent: () => import('./docs/data-grid-docs/data-grid-docs').then((m) => m.DataGridDocsComponent)
	},
	{
		path: 'docs/tree-view',
		loadComponent: () => import('./docs/tree-view-docs/tree-view-docs').then((m) => m.TreeViewDocsComponent)
	},
	{
		path: 'docs/scene-viewer',
		loadComponent: () => import('./docs/scene-viewer-docs/scene-viewer-docs').then((m) => m.SceneViewerDocsComponent)
	},
	{
		path: 'docs/bar-chart-3d',
		loadComponent: () => import('./docs/bar-chart-3d-docs/bar-chart-3d-docs').then((m) => m.BarChart3dDocsComponent)
	},
	{
		path: 'docs/surface-plot',
		loadComponent: () => import('./docs/surface-plot-docs/surface-plot-docs').then((m) => m.SurfacePlotDocsComponent)
	},
	{
		path: 'docs/network-graph',
		loadComponent: () => import('./docs/network-graph-docs/network-graph-docs').then((m) => m.NetworkGraphDocsComponent)
	},
	{
		path: '**',
		redirectTo: 'docs/list-view'
	}
];
