export function csvBlob(headers: readonly string[], rows: readonly (readonly unknown[])[]): Blob {
  const content = [headers, ...rows]
    .map((row) => row.map((value) => csvCell(value)).join(','))
    .join('\r\n');
  return new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' });
}

export function downloadCsv(blob: Blob, filename: string): void {
  downloadFile(blob, filename);
}

export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
