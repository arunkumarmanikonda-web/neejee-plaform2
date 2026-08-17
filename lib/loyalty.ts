// Public loyalty entry point.
// Keep the mature feature implementation intact while overriding only the
// concurrency-sensitive paid-order earn and generic redeem operations.
export * from './loyalty-legacy';
export { processOrderForLoyalty, redeemPoints } from './loyalty-order-processing';
