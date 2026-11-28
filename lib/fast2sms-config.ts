export function fast2smsEntityId() {
  return (process.env.FAST2SMS_ENTITY_ID || process.env.FAST2SMS_DLT_ENTITY_ID || '').trim();
}

export function fast2smsRoute() {
  return (process.env.FAST2SMS_ROUTE || 'dlt').trim() || 'dlt';
}
