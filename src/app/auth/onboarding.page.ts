import { Component, inject } from '@angular/core';
import { SessionApiService } from './session-api.service';

@Component({
  selector: 'app-onboarding-page',
  template: `
    <main>
      <section aria-labelledby="onboarding-title">
        <div class="brand" aria-hidden="true">UI</div>
        <p class="eyebrow">Sesión protegida</p>
        <h1 id="onboarding-title">Prepara {{ session()?.tenant?.name }}</h1>
        <p>
          Ingresaste como <strong>{{ session()?.user?.email }}</strong
          >. Tu cuenta está lista y la configuración inicial continúa aquí.
        </p>
      </section>
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
    }
    main {
      display: grid;
      min-height: 100vh;
      place-items: center;
      padding: 1rem;
      background: #eef3f8;
    }
    section {
      width: min(100%, 42rem);
      padding: clamp(1.6rem, 5vw, 3rem);
      border-radius: 1.4rem;
      background: white;
      box-shadow: 0 1.5rem 4rem rgba(31, 55, 78, 0.12);
    }
    .brand {
      display: grid;
      width: 3rem;
      height: 3rem;
      place-items: center;
      border-radius: 0.8rem;
      background: #0b5cab;
      color: white;
      font-weight: 800;
    }
    .eyebrow {
      margin: 1.7rem 0 0.4rem;
      color: #0b5cab;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      color: #112a40;
      font-size: clamp(2rem, 7vw, 3rem);
      letter-spacing: -0.045em;
    }
    p {
      color: #5b6f80;
      line-height: 1.6;
    }
    strong {
      color: #263d52;
    }
  `,
})
export class OnboardingPage {
  private readonly sessions = inject(SessionApiService);
  protected readonly session = this.sessions.session;
}
