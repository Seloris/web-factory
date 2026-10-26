import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideTranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { provideApiConfiguration } from '../api/api-configuration';
import { routes } from './app.routes';
import { MessagesLoader } from './messages-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch()),
    // `/api` is proxied to the API by ng serve (proxy.conf.mjs).
    provideApiConfiguration('/api'),
    provideTranslateService({ loader: provideTranslateLoader(MessagesLoader), lang: 'fr', fallbackLang: 'fr' }),
  ],
};
