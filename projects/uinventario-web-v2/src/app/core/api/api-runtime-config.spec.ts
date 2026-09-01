import { ApiRuntimeConfig, validateRuntimeConfiguration } from './api-runtime-config';

describe('API runtime configuration', () => {
  it('loads the dynamic configuration inside the Web V2 service-worker scope', async () => {
    const base = document.createElement('base');
    base.href = '/v2/';
    document.head.prepend(base);
    const request = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ environment: 'dev', apiBaseUrl: '/api/v1' }),
    });
    vi.stubGlobal('fetch', request);
    try {
      const config = new ApiRuntimeConfig();
      await config.load();
      expect(request).toHaveBeenCalledWith('/v2/config.json', { cache: 'no-store' });
      expect(config.environment).toBe('dev');
    } finally {
      base.remove();
      vi.unstubAllGlobals();
    }
  });

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
