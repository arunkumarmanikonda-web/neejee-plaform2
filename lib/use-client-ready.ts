'use client';
import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

// Keep the first browser render consistent with the server before reading a persisted bag.
export function useClientReady() {
  return useSyncExternalStore(subscribe, clientReady, serverReady);
}
