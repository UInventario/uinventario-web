import { describe, expect, it } from 'vitest';
import { csvBlob } from './csv-export';

describe('report CSV export', () => {
  it('escapes delimiters and neutralizes spreadsheet formulas', async () => {
    const blob = csvBlob(['Nombre', 'Valor'], [['Café, molido', '=1+1']]);
    await expect(blob.text()).resolves.toContain('"Café, molido","\'=1+1"');
  });
});
