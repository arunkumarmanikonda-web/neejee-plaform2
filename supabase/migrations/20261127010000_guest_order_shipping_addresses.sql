-- Guest orders own a delivery address via Order.addressId. A guest address
-- has no account owner; the existing signed-in address book uses User.id.
ALTER TABLE public."Address" ALTER COLUMN "userId" DROP NOT NULL;
