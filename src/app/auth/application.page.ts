import { Component, inject } from '@angular/core';
import { SessionApiService } from './session-api.service';

@Component({
  selector: 'app-application-page',
  template: `<main>
    <h1>{{ session()?.tenant?.name }}</h1>
    <p>Sesión activa.</p>
  </main>`,
  styles: `
    main {
      padding: 2rem;
    }
  `,
})
export class ApplicationPage {
  private readonly sessions = inject(SessionApiService);
  protected readonly session = this.sessions.session;
}
