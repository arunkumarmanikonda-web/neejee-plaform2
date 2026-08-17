-- Add covering indexes for high-traffic ecommerce foreign keys.
-- These indexes are additive only and are safe for existing relations.

CREATE INDEX IF NOT EXISTS "Variant_productId_idx"
  ON public."Variant" ("productId");

CREATE INDEX IF NOT EXISTS "Address_userId_idx"
  ON public."Address" ("userId");

CREATE INDEX IF NOT EXISTS "CartItem_cartId_idx"
  ON public."CartItem" ("cartId");

CREATE INDEX IF NOT EXISTS "CartItem_productId_idx"
  ON public."CartItem" ("productId");

CREATE INDEX IF NOT EXISTS "CartItem_variantId_idx"
  ON public."CartItem" ("variantId");

CREATE INDEX IF NOT EXISTS "Category_parentId_idx"
  ON public."Category" ("parentId");

CREATE INDEX IF NOT EXISTS "Order_addressId_idx"
  ON public."Order" ("addressId");

CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx"
  ON public."OrderItem" ("orderId");

CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx"
  ON public."OrderItem" ("productId");

CREATE INDEX IF NOT EXISTS "OrderItem_variantId_idx"
  ON public."OrderItem" ("variantId");

CREATE INDEX IF NOT EXISTS "Review_productId_idx"
  ON public."Review" ("productId");

CREATE INDEX IF NOT EXISTS "Review_userId_idx"
  ON public."Review" ("userId");

CREATE INDEX IF NOT EXISTS "Wishlist_productId_idx"
  ON public."Wishlist" ("productId");

CREATE INDEX IF NOT EXISTS "AiPreview_userId_idx"
  ON public."AiPreview" ("userId");
