import { Routes } from '@angular/router';

export const rosterBuilderRoutes: Routes = [
  { path: '', loadComponent: () => import('./containers/roster-builder.page').then((m) => m.RosterBuilderPage) },
];
