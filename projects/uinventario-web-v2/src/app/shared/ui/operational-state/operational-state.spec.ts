import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { OperationalState } from './operational-state';

describe('OperationalState', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OperationalState],
      providers: [provideNoopAnimations()],
    }).compileComponents();
  });

  it.each([
    ['loading', 'Cargando información'],
    ['empty', 'Aún no hay información'],
    ['error', 'No pudimos completar la operación'],
    ['offline', 'Sin conexión'],
    ['forbidden', 'Permisos insuficientes'],
  ] as const)('renders the %s state', (kind, title) => {
    const fixture = TestBed.createComponent(OperationalState);
    fixture.componentRef.setInput('kind', kind);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(title);
  });

  it('emits the recovery action', () => {
    const fixture = TestBed.createComponent(OperationalState);
    fixture.componentRef.setInput('kind', 'error');
    fixture.componentRef.setInput('actionLabel', 'Reintentar');
    let invoked = false;
    fixture.componentInstance.actionInvoked.subscribe(() => (invoked = true));
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector('button')?.click();
    expect(invoked).toBe(true);
  });
});
