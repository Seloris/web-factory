import { TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import messages from '../i18n/messages.json';

// One language, bundled with the app: no request, no flash of raw keys.
export class MessagesLoader implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(messages);
  }
}
