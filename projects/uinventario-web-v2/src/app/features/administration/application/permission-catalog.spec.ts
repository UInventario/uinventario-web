import { APP_PERMISSIONS } from '../../../core/authorization/app-permission';
import { PERMISSION_OPTIONS } from './permission-catalog';

describe('permission catalog', () => {
  it('explains every permission assignable to an operational role exactly once', () => {
    const expected = APP_PERMISSIONS.filter(
      (permission) => permission !== 'TENANT_MANAGE' && permission !== 'ACCESS_MANAGE',
    ).sort();
    const actual = PERMISSION_OPTIONS.map(({ id }) => id).sort();

    expect(actual).toEqual(expected);
    expect(new Set(actual).size).toBe(actual.length);
    expect(PERMISSION_OPTIONS.every(({ label, description }) => label && description)).toBe(true);
  });
});
