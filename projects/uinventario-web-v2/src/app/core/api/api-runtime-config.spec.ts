import { validateRuntimeConfiguration } from './api-runtime-config';

describe('API runtime configuration', () => {
  it('accepts the relative proxy URL used by deployed environments', () => {
    expect(validateRuntimeConfiguration({ environment: 'dev', apiBaseUrl: '/api/v1/' })).toEqual({
      environment: 'dev',
      apiBaseUrl: '/api/v1',
    });
  });

  it('requires HTTPS outside local development', () => {
    expect(() =>
      validateRuntimeConfiguration({
        environment: 'prod',
        apiBaseUrl: 'http://api.example.test/api/v1',
      }),
    ).toThrow(/segura/);
  });

  it('rejects credentials and protocol-relative URLs', () => {
    expect(() =>
      validateRuntimeConfiguration({
        environment: 'prod',
        apiBaseUrl: 'https://user:secret@api.example.test/api/v1',
      }),
    ).toThrow(/segura/);
    expect(() =>
      validateRuntimeConfiguration({ environment: 'dev', apiBaseUrl: '//api.example.test' }),
    ).toThrow(/seguro/);
  });
});
