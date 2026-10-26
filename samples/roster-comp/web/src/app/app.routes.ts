import { Routes } from '@angular/router';

// One lazy entry per feature: `{ path: 'orders', loadChildren: () => import('../features/orders/orders.routes').then((m) => m.ordersRoutes) }`.
export const routes: Routes = [
  { path: '', loadChildren: () => import('../features/roster-builder/roster-builder.routes').then((m) => m.rosterBuilderRoutes) },
];
