import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthorizationService } from '../../../core/authorization/authorization.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  selector: 'ui-administration-default-page',
  styles: `
    :host {
      display: block;
    }
    .workspace {
      display: grid;
      gap: 1rem;
      padding: 1.25rem;
    }
    header p,
    header h1,
    header span {
      margin: 0;
    }
    header p {
      color: var(--p-primary-600);
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    header h1 {
      margin: 0.15rem 0;
      font-size: clamp(1.5rem, 3vw, 2rem);
    }
    header span {
      color: var(--p-text-muted-color);
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
      gap: 0.85rem;
    }
    a {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 0.85rem;
      align-items: center;
      min-height: 7rem;
      padding: 1rem;
      border: 1px solid var(--p-surface-200);
      border-radius: 1rem;
      background: var(--p-surface-0);
      color: inherit;
      text-decoration: none;
      box-shadow: 0 0.25rem 1rem color-mix(in srgb, var(--p-primary-900) 6%, transparent);
    }
    a:hover,
    a:focus-visible {
      border-color: var(--p-primary-400);
      outline: none;
      transform: translateY(-1px);
    }
    i:first-child {
      display: grid;
      place-items: center;
      width: 2.75rem;
      height: 2.75rem;
      border-radius: 0.8rem;
      background: var(--p-primary-50);
      color: var(--p-primary-600);
      font-size: 1.2rem;
    }
    strong,
    span {
      display: block;
    }
    span {
      margin-top: 0.25rem;
      color: var(--p-text-muted-color);
      font-size: 0.86rem;
      line-height: 1.4;
    }
  `,
  template: `
    <section class="workspace" aria-labelledby="administration-title">
      <header>
        <p>Configuración segura</p>
        <h1 id="administration-title">Administración</h1>
        <span>Elige el área que deseas configurar.</span>
      </header>
      <div class="cards">
        @if (canManageTenant()) {
          <a routerLink="empresa">
            <i class="pi pi-building" aria-hidden="true"></i>
            <div>
              <strong>Empresa y sucursales</strong
              ><span>Configura puntos de operación, bodegas y cajas.</span>
            </div>
            <i class="pi pi-arrow-right" aria-hidden="true"></i>
          </a>
        }
        @if (canManageAccess()) {
          <a routerLink="accesos">
            <i class="pi pi-users" aria-hidden="true"></i>
            <div>
              <strong>Usuarios y accesos</strong
              ><span>Asigna roles y limita sucursales y cajas.</span>
            </div>
            <i class="pi pi-arrow-right" aria-hidden="true"></i>
          </a>
        }
        @if (canManageTenant()) {
          <a routerLink="integraciones">
            <i class="pi pi-cloud" aria-hidden="true"></i>
            <div>
              <strong>Integraciones</strong
              ><span>Supervisa adaptadores, contratos externos, webhooks y errores.</span>
            </div>
            <i class="pi pi-arrow-right" aria-hidden="true"></i>
          </a>
        }
        @if (canManageTenant()) {
          <a routerLink="comercio">
            <i class="pi pi-shop" aria-hidden="true"></i>
            <div>
              <strong>Comercio electrónico</strong
              ><span>Conecta marketplaces, credenciales y webhooks externos.</span>
            </div>
            <i class="pi pi-arrow-right" aria-hidden="true"></i>
          </a>
        }
      </div>
    </section>
  `,
})
export class AdministrationDefaultPage {
  private readonly authorization = inject(AuthorizationService);
  protected readonly canManageTenant = computed(() => this.authorization.has('TENANT_MANAGE'));
  protected readonly canManageAccess = computed(() => this.authorization.has('ACCESS_MANAGE'));
}
