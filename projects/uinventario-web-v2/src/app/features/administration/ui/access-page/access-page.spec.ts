import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AccessFacade } from '../../application/access.facade';
import { AccessPage } from './access-page';

describe('AccessPage', () => {
  const facade = {
    load: vi.fn(),
    createRole: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    retireUser: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    facade.load.mockReturnValue(
      of({
        roles: [{ id: 'role-1', name: 'Cajero', permissions: ['SALES_MANAGE'] }],
        users: [
          {
            id: 'user-1',
            email: 'operator@example.com',
            active: true,
            roles: [{ id: 'role-1', name: 'Cajero', permissions: ['SALES_MANAGE'] }],
            branches: [{ id: 'branch-1', name: 'Centro' }],
            cashRegisters: [],
            manageable: true,
          },
        ],
        branches: [
          {
            id: 'branch-1',
            name: 'Centro',
            active: true,
            cashRegisters: [{ id: 'cash-1', name: 'Caja 1', code: 'C1', branchId: 'branch-1' }],
          },
        ],
      }),
    );
    TestBed.configureTestingModule({
      imports: [AccessPage],
      providers: [{ provide: AccessFacade, useValue: facade }],
    });
  });

  it('keeps people and the permission matrix in separate operational views', () => {
    const fixture = TestBed.createComponent(AccessPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('operator@example.com');
    expect(element.querySelector('table')).toBeNull();
    element.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click();
    fixture.detectChanges();

    expect(element.querySelector('table')).not.toBeNull();
    expect(element.textContent).toContain('Operar ventas');
  });

  it('requires the exact email before enabling access retirement', () => {
    const fixture = TestBed.createComponent(AccessPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    element
      .querySelector<HTMLButtonElement>('[aria-label="Retirar operator@example.com"]')!
      .click();
    fixture.detectChanges();

    const confirm = element.querySelector<HTMLButtonElement>('.danger-button')!;
    const input = element.querySelector<HTMLInputElement>('.retirement-dialog input')!;
    expect(confirm.disabled).toBe(true);
    input.value = 'operator@example.com';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(confirm.disabled).toBe(false);
  });
});
