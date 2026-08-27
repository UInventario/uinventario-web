import { RuntimeConfigService } from './runtime-config.service';

describe('RuntimeConfigService', () => {
  afterEach(() => vi.unstubAllGlobals());

  function respond(config: unknown, ok = true): void {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok,
        json: vi.fn().mockResolvedValue(config),
      } as unknown as Response),
    );
  }

  it('loads and normalizes a public environment configuration', async () => {
    respond({
      environment: 'dev',
      apiBaseUrl: 'https://api-dev.example.invalid/api/v1/',
    });
    const service = new RuntimeConfigService();

    await service.load();

    expect(service.environment()).toBe('dev');
    expect(service.apiBaseUrl()).toBe('https://api-dev.example.invalid/api/v1');
    expect(fetch).toHaveBeenCalledWith('/config.json', { cache: 'no-store' });
  });

  it.each([
    [{ apiBaseUrl: 'http://localhost:3000/api/v1' }, 'environment válido'],
    [{ environment: 'prod' }, 'requiere apiBaseUrl'],
    [{ environment: 'prod', apiBaseUrl: 'http://api.example.invalid/api/v1' }, 'no es segura'],
    [
      { environment: 'dev', apiBaseUrl: 'https://example-user@api.example.invalid/api/v1' },
      'no es segura',
    ],
  ])('rejects an invalid runtime contract', async (config, message) => {
    respond(config);

    await expect(new RuntimeConfigService().load()).rejects.toThrow(message);
  });

  it('fails clearly when config.json is unavailable', async () => {
    respond({}, false);

    await expect(new RuntimeConfigService().load()).rejects.toThrow(
      'No fue posible cargar la configuración de UInventario.',
    );
  });
});
