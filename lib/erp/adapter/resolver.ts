import type { ErpAdapter, ErpAdapterKind } from './contracts';
import { mockErpAdapter } from './mock';

export const ERP_ADAPTER_ENV_KEY = 'ERP_ADAPTER' as const;

export function resolveErpAdapterKind(rawValue?: string | null): ErpAdapterKind {
  const normalized = String(rawValue ?? 'mock')
    .trim()
    .toLowerCase();

  if (normalized === 'real') {
    return 'real';
  }

  return 'mock';
}

export function getErpAdapter(rawValue?: string | null): ErpAdapter {
  const kind = resolveErpAdapterKind(rawValue ?? process.env[ERP_ADAPTER_ENV_KEY]);

  if (kind === 'mock') {
    return mockErpAdapter;
  }

  throw new Error(
    'Real ERP adapter not implemented yet. Set ERP_ADAPTER=mock to use the deterministic adapter.'
  );
}
