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
		path: '**',
		redirectTo: 'docs/list-view'
	}
];
