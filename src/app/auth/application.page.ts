import { Component, inject } from '@angular/core';
import { SessionApiService } from './session-api.service';

@Component({
  selector: 'app-application-page',
  template: `<main>
    <header>
      <div><span class="brand">UI</span><strong>{{ session()?.tenant?.name }}</strong></div>
      <button type="button" (click)="logout()">Cerrar sesión</button>
    </header>
    <nav aria-label="Módulos principales"><a aria-current="page">Productos</a></nav>
    <section aria-labelledby="products-title">
      <p class="eyebrow">Catálogo</p>
      <h1 id="products-title">Productos</h1>
      <p class="context">
        {{ session()?.context?.branch?.name }} · {{ session()?.context?.warehouse?.name }} ·
        {{ session()?.context?.cashRegister?.name }}
      </p>
      <div class="empty">
        <h2>Aún no hay productos</h2>
        <p>Tu empresa ya está lista. El siguiente paso es crear el primer producto.</p>
      </div>
    </section>
  </main>`,
  styles: `
    main {
      min-height: 100vh;
      background: #f4f7fa;
      color: #17212b;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 4.2rem;
      padding: 0 1.5rem;
      background: #fff;
      border-bottom: 1px solid #dbe3ea;
    }
    header div {
      display: flex;
      align-items: center;
      gap: 0.8rem;
    }
    .brand {
      display: grid;
      width: 2.5rem;
      height: 2.5rem;
      place-items: center;
      border-radius: 0.65rem;
      background: #0b5cab;
      color: white;
      font-weight: 800;
    }
    button {
      border: 0;
      border-radius: 0.6rem;
      padding: 0.65rem 0.8rem;
      background: #e9f1f8;
      color: #0b5cab;
      cursor: pointer;
      font-weight: 700;
    }
    nav {
      padding: 0.75rem 1.5rem 0;
      background: #fff;
    }
    nav a {
      display: inline-block;
      padding: 0.7rem 1rem;
      border-bottom: 3px solid #0b5cab;
      color: #0b5cab;
      font-weight: 700;
    }
    section {
      max-width: 70rem;
      margin: 0 auto;
      padding: 2.5rem 1.5rem;
    }
    .eyebrow {
      margin: 0;
      color: #0b5cab;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0.35rem 0;
      font-size: clamp(2rem, 5vw, 3rem);
    }
    .context {
      margin: 0;
      color: #5b6f80;
    }
    .empty {
      margin-top: 2rem;
      padding: clamp(2rem, 7vw, 4rem);
      border: 1px dashed #aebdca;
      border-radius: 1rem;
      background: #fff;
      text-align: center;
    }
    .empty h2 {
      margin: 0;
      color: #263d52;
    }
    .empty p {
      color: #5b6f80;
    }
    @media (max-width: 36rem) {
      header {
        padding: 0 0.9rem;
      }
      header strong {
        max-width: 9rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      section {
        padding: 1.7rem 1rem;
      }
      .context {
        line-height: 1.7;
      }
    }
  `,
})
export class ApplicationPage {
  private readonly sessions = inject(SessionApiService);
  protected readonly session = this.sessions.session;

  protected logout(): void {
    this.sessions.logout().subscribe({ error: () => undefined });
  }
}
