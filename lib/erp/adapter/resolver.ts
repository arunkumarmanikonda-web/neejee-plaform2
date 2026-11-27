import type { ErpAdapter, ErpAdapterKind } from './contracts';
import { bridgeConfig, createHttpAdapter } from './http';
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

  return createHttpAdapter(process.env.ERP_API_ORIGIN,process.env.ERP_API_TOKEN);
}

export function erpSourceSummary(env:Partial<NodeJS.ProcessEnv>=process.env) {
  if (env.ERP_STOCK_FEED_URL) return 'A stock feed is configured for reconciliation. Open reconciliation to check the feed.';
  if (resolveErpAdapterKind(env.ERP_ADAPTER)==='real') {
    try { bridgeConfig(env.ERP_API_ORIGIN,env.ERP_API_TOKEN); }
    catch { return 'External ERP setup is incomplete. Staff can compare an independent stock CSV in reconciliation.'; }
    return 'A read-only ERP bridge is configured. Open reconciliation to verify a live catalogue, price and stock read.';
  }
  return 'Demo adapter selected. Staff can upload an independent stock CSV for an operational comparison.';
}
