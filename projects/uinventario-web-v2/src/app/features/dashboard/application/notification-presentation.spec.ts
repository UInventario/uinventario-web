import { NOTIFICATION_EVENT_TYPES } from '../domain/dashboard.models';
import { NOTIFICATION_LABELS, notificationDestination } from './notification-presentation';

describe('notification presentation', () => {
  it('gives every API event a readable label and actionable destination', () => {
    for (const type of NOTIFICATION_EVENT_TYPES) {
      expect(NOTIFICATION_LABELS[type]).toBeTruthy();
      expect(notificationDestination(type).label).toBeTruthy();
      expect(notificationDestination(type).commands[0]).toMatch(/^\//);
    }
  });

  it('routes operational alerts to the corresponding focused workspace', () => {
    expect(notificationDestination('STOCK_LOW')).toEqual({
      label: 'Revisar alertas de inventario',
      commands: ['/inventario/control'],
      queryParams: { view: 'alerts' },
    });
    expect(notificationDestination('CASH_DIFFERENCE').commands).toEqual(['/reportes/caja']);
    expect(notificationDestination('PURCHASE_PENDING').commands).toEqual(['/compras/ordenes']);
  });
});
