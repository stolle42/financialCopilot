/**
 * The whole templating "engine" from decision 3. Values are escaped by default,
 * so a bank description containing <script> renders as text instead of running.
 * Opt out deliberately with raw().
 */
const RAW = Symbol('raw');

type Raw = { readonly [RAW]: string };

export function raw(value: string): Raw {
  return { [RAW]: value };
}

export type Renderable = string | number | null | undefined | Raw | Renderable[];

export function html(strings: TemplateStringsArray, ...values: Renderable[]): Raw {
  let out = strings[0] ?? '';
  for (let i = 0; i < values.length; i++) {
    out += render(values[i]) + (strings[i + 1] ?? '');
  }
  return raw(out);
}

export function renderToString(value: Renderable): string {
  return render(value);
}

function render(value: Renderable): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(render).join('');
  if (typeof value === 'object' && RAW in value) return value[RAW];
  return escape(String(value));
}

function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatMinor(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
