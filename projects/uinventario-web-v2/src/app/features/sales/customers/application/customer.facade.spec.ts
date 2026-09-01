import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerGateway } from '../domain/customer.gateway';
import { Customer } from '../domain/customer.models';
import { CustomerFacade } from './customer.facade';

describe('CustomerFacade', () => {
  const gateway = {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
    history: vi.fn(),
    credit: vi.fn(),
    configureCredit: vi.fn(),
    privacyPolicy: vi.fn(),
    updatePrivacyPolicy: vi.fn(),
    privacyReport: vi.fn(),
    exportPrivacy: vi.fn(),
    createLegalHold: vi.fn(),
    releaseLegalHold: vi.fn(),
    anonymize: vi.fn(),
  };
  let facade: CustomerFacade;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [CustomerFacade, { provide: CustomerGateway, useValue: gateway }],
    });
    facade = TestBed.inject(CustomerFacade);
  });

  it('creates new customers and preserves optimistic versions on updates', () => {
    const input = { name: 'Ana Pérez', dataProcessingConsent: false };
    const customer = { id: 'customer-1', version: 4 } as Customer;
    gateway.create.mockReturnValue(of(customer));
    gateway.update.mockReturnValue(of(customer));

    facade.save(input).subscribe();
    facade.save(input, customer).subscribe();

    expect(gateway.create).toHaveBeenCalledWith(input);
    expect(gateway.update).toHaveBeenCalledWith('customer-1', input, 4);
  });

  it('forwards privacy actions through the customer boundary', () => {
    const input = { reason: 'Solicitud validada', requestReference: 'REQ-42' };
    gateway.anonymize.mockReturnValue(of({ anonymized: true }));
    gateway.createLegalHold.mockReturnValue(of({ id: 'hold-1' }));

    facade.anonymize('customer-1', input).subscribe();
    facade.createLegalHold('customer-1', { ...input, expiresAt: '2027-01-01' }).subscribe();

    expect(gateway.anonymize).toHaveBeenCalledWith('customer-1', input);
    expect(gateway.createLegalHold).toHaveBeenCalledWith('customer-1', {
      ...input,
      expiresAt: '2027-01-01',
    });
  });
});
