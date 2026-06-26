


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."AiPhotoDecision" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'ARCHIVED'
);


ALTER TYPE "public"."AiPhotoDecision" OWNER TO "postgres";


CREATE TYPE "public"."AiPhotoJobStatus" AS ENUM (
    'QUEUED',
    'RUNNING',
    'COMPLETED',
    'FAILED',
    'CANCELLED'
);


ALTER TYPE "public"."AiPhotoJobStatus" OWNER TO "postgres";


CREATE TYPE "public"."AiPhotoRequestStatus" AS ENUM (
    'SUBMITTED',
    'ACCEPTED',
    'REJECTED',
    'COMPLETED',
    'CANCELLED'
);


ALTER TYPE "public"."AiPhotoRequestStatus" OWNER TO "postgres";


CREATE TYPE "public"."AiPhotoStrategy" AS ENUM (
    'SAREE_ON_MODEL',
    'LEHENGA_ON_MODEL',
    'KURTA_ON_MODEL',
    'JEWELLERY_NECKLACE_ON_MODEL',
    'JEWELLERY_EARRING_ON_MODEL',
    'JEWELLERY_BANGLE_ON_MODEL',
    'JEWELLERY_RING_ON_HAND',
    'FURNITURE_IN_ROOM',
    'LAMP_ON_CONSOLE',
    'DECOR_ON_SHELF',
    'POTTERY_TABLE_SETTING',
    'RUG_FLOOR_TOP_DOWN',
    'PAINTING_ON_WALL',
    'GENERIC_LIFESTYLE'
);


ALTER TYPE "public"."AiPhotoStrategy" OWNER TO "postgres";


CREATE TYPE "public"."AiType" AS ENUM (
    'MIRROR',
    'SPACE',
    'GIFT_CONCIERGE'
);


ALTER TYPE "public"."AiType" OWNER TO "postgres";


CREATE TYPE "public"."BankTxnStatus" AS ENUM (
    'UNMATCHED',
    'AUTO_MATCHED',
    'MANUAL_MATCHED',
    'IGNORED',
    'DRAFT'
);


ALTER TYPE "public"."BankTxnStatus" OWNER TO "postgres";


CREATE TYPE "public"."BillStatus" AS ENUM (
    'DRAFT',
    'OPEN',
    'OVERDUE',
    'PARTIALLY_PAID',
    'PAID',
    'CANCELLED'
);


ALTER TYPE "public"."BillStatus" OWNER TO "postgres";


CREATE TYPE "public"."DisputeCategory" AS ENUM (
    'WRONG_ITEM',
    'DAMAGED',
    'NOT_RECEIVED',
    'QUALITY_ISSUE',
    'SHORT_SHIPMENT',
    'LATE_DELIVERY',
    'PAYMENT_ISSUE',
    'OTHER'
);


ALTER TYPE "public"."DisputeCategory" OWNER TO "postgres";


CREATE TYPE "public"."DisputeEventType" AS ENUM (
    'CREATED',
    'COMMENT',
    'STATUS_CHANGED',
    'EVIDENCE_ADDED',
    'RESOLUTION_PROPOSED',
    'RESOLVED'
);


ALTER TYPE "public"."DisputeEventType" OWNER TO "postgres";


CREATE TYPE "public"."DisputeResourceType" AS ENUM (
    'ORDER',
    'PURCHASE_ORDER'
);


ALTER TYPE "public"."DisputeResourceType" OWNER TO "postgres";


CREATE TYPE "public"."DisputeSeverity" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);


ALTER TYPE "public"."DisputeSeverity" OWNER TO "postgres";


CREATE TYPE "public"."DisputeStatus" AS ENUM (
    'OPEN',
    'AWAITING_CUSTOMER',
    'AWAITING_VENDOR',
    'UNDER_REVIEW',
    'RESOLVED',
    'REJECTED',
    'WITHDRAWN'
);


ALTER TYPE "public"."DisputeStatus" OWNER TO "postgres";


CREATE TYPE "public"."DropStatus" AS ENUM (
    'DRAFT',
    'SCHEDULED',
    'LIVE',
    'CLOSED'
);


ALTER TYPE "public"."DropStatus" OWNER TO "postgres";


CREATE TYPE "public"."EInvoiceStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'ACTIVE',
    'CANCELLED',
    'FAILED',
    'EXEMPT'
);


ALTER TYPE "public"."EInvoiceStatus" OWNER TO "postgres";


CREATE TYPE "public"."EmployeeStatus" AS ENUM (
    'ACTIVE',
    'ON_NOTICE',
    'EXITED',
    'ON_LEAVE',
    'TERMINATED'
);


ALTER TYPE "public"."EmployeeStatus" OWNER TO "postgres";


CREATE TYPE "public"."ExpenseGroup" AS ENUM (
    'COGS_DIRECT',
    'OPEX_MARKETING',
    'OPEX_COMMUNICATION',
    'OPEX_SHIPPING',
    'OPEX_PAYMENT',
    'OPEX_PLATFORM',
    'OPEX_PEOPLE',
    'OPEX_OFFICE',
    'OPEX_PROFESSIONAL',
    'OPEX_TAX_OTHER',
    'OPEX_OTHER',
    'WRITE_OFF'
);


ALTER TYPE "public"."ExpenseGroup" OWNER TO "postgres";


CREATE TYPE "public"."ExpenseSource" AS ENUM (
    'MANUAL',
    'RAZORPAY_WEBHOOK',
    'FAST2SMS_AUTO',
    'RESEND_AUTO',
    'SHIPROCKET_AUTO',
    'IMPORT',
    'BILL'
);


ALTER TYPE "public"."ExpenseSource" OWNER TO "postgres";


CREATE TYPE "public"."ExpenseStatus" AS ENUM (
    'DRAFT',
    'PENDING',
    'APPROVED',
    'REJECTED',
    'VOIDED'
);


ALTER TYPE "public"."ExpenseStatus" OWNER TO "postgres";


CREATE TYPE "public"."ForecastScope" AS ENUM (
    'GLOBAL',
    'CATEGORY',
    'PRODUCT'
);


ALTER TYPE "public"."ForecastScope" OWNER TO "postgres";


CREATE TYPE "public"."FulfilmentMode" AS ENUM (
    'IN_STOCK',
    'PREORDER',
    'LIMITED_DROP'
);


ALTER TYPE "public"."FulfilmentMode" OWNER TO "postgres";


CREATE TYPE "public"."InventorySubmissionStatus" AS ENUM (
    'SUBMITTED',
    'UNDER_REVIEW',
    'NEEDS_INFO',
    'APPROVED',
    'PUBLISHED',
    'REJECTED',
    'WITHDRAWN'
);


ALTER TYPE "public"."InventorySubmissionStatus" OWNER TO "postgres";


CREATE TYPE "public"."InventorySubmissionType" AS ENUM (
    'NEW_PRODUCT',
    'EDIT_EXISTING',
    'PRICE_UPDATE',
    'INVENTORY_UPDATE',
    'TAKEDOWN_REQUEST'
);


ALTER TYPE "public"."InventorySubmissionType" OWNER TO "postgres";


CREATE TYPE "public"."KycStatus" AS ENUM (
    'PENDING',
    'UNDER_REVIEW',
    'APPROVED',
    'REJECTED',
    'SUSPENDED'
);


ALTER TYPE "public"."KycStatus" OWNER TO "postgres";


CREATE TYPE "public"."MarketingApprovalStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'WITHDRAWN'
);


ALTER TYPE "public"."MarketingApprovalStatus" OWNER TO "postgres";


CREATE TYPE "public"."MarketingResourceType" AS ENUM (
    'CAMPAIGN',
    'EMAIL_BROADCAST',
    'COUPON',
    'BANNER'
);


ALTER TYPE "public"."MarketingResourceType" OWNER TO "postgres";


CREATE TYPE "public"."NotificationChannel" AS ENUM (
    'EMAIL',
    'WHATSAPP',
    'SMS'
);


ALTER TYPE "public"."NotificationChannel" OWNER TO "postgres";


CREATE TYPE "public"."NotificationStatus" AS ENUM (
    'QUEUED',
    'SENT',
    'DELIVERED',
    'FAILED',
    'SKIPPED',
    'BOUNCED'
);


ALTER TYPE "public"."NotificationStatus" OWNER TO "postgres";


CREATE TYPE "public"."OrderStatus" AS ENUM (
    'PLACED',
    'CONFIRMED',
    'PACKED',
    'SHIPPED',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
    'RETURNED',
    'REFUNDED',
    'CANCELLED_BUG'
);


ALTER TYPE "public"."OrderStatus" OWNER TO "postgres";


CREATE TYPE "public"."PageStatus" AS ENUM (
    'DRAFT',
    'PREVIEW',
    'PUBLISHED',
    'ARCHIVED'
);


ALTER TYPE "public"."PageStatus" OWNER TO "postgres";


CREATE TYPE "public"."PaymentStatus" AS ENUM (
    'PENDING',
    'PAID',
    'FAILED',
    'REFUNDED',
    'PARTIALLY_REFUNDED'
);


ALTER TYPE "public"."PaymentStatus" OWNER TO "postgres";


CREATE TYPE "public"."PayrollRunStatus" AS ENUM (
    'DRAFT',
    'COMPUTED',
    'APPROVED',
    'PAID',
    'LOCKED'
);


ALTER TYPE "public"."PayrollRunStatus" OWNER TO "postgres";


CREATE TYPE "public"."PreorderBalanceStatus" AS ENUM (
    'PENDING',
    'AWAITING_PAYMENT',
    'PAID',
    'CANCELLED'
);


ALTER TYPE "public"."PreorderBalanceStatus" OWNER TO "postgres";


CREATE TYPE "public"."ProductOwnership" AS ENUM (
    'OWNED',
    'MARKETPLACE'
);


ALTER TYPE "public"."ProductOwnership" OWNER TO "postgres";


CREATE TYPE "public"."ProductStatus" AS ENUM (
    'DRAFT',
    'PENDING_QC',
    'ACTIVE',
    'ARCHIVED',
    'REJECTED'
);


ALTER TYPE "public"."ProductStatus" OWNER TO "postgres";


CREATE TYPE "public"."PurchaseOrderStatus" AS ENUM (
    'DRAFT',
    'SENT',
    'CONFIRMED',
    'DISPATCHED',
    'RECEIVED',
    'CLOSED',
    'CANCELLED'
);


ALTER TYPE "public"."PurchaseOrderStatus" OWNER TO "postgres";


CREATE TYPE "public"."RecurringFrequency" AS ENUM (
    'WEEKLY',
    'MONTHLY',
    'QUARTERLY',
    'YEARLY'
);


ALTER TYPE "public"."RecurringFrequency" OWNER TO "postgres";


CREATE TYPE "public"."ReviewStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE "public"."ReviewStatus" OWNER TO "postgres";


CREATE TYPE "public"."Role" AS ENUM (
    'CUSTOMER',
    'SELLER',
    'ADMIN',
    'SUPER_ADMIN',
    'QC_TEAM',
    'CONTENT_EDITOR',
    'VENDOR',
    'FINANCE',
    'VENDOR_STAFF',
    'SELLER_STAFF',
    'FINANCE_OPERATOR',
    'MARKETING_OPERATOR',
    'MARKETING_MANAGER'
);


ALTER TYPE "public"."Role" OWNER TO "postgres";


CREATE TYPE "public"."SellerChangeRequestStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED'
);


ALTER TYPE "public"."SellerChangeRequestStatus" OWNER TO "postgres";


CREATE TYPE "public"."SellerDocStatus" AS ENUM (
    'SUBMITTED',
    'APPROVED',
    'REJECTED',
    'SUPERSEDED'
);


ALTER TYPE "public"."SellerDocStatus" OWNER TO "postgres";


CREATE TYPE "public"."SellerDocType" AS ENUM (
    'PAN_CARD',
    'GST_CERTIFICATE',
    'MSME_CERTIFICATE',
    'CANCELLED_CHEQUE',
    'BANK_STATEMENT',
    'ADDRESS_PROOF',
    'AADHAAR_SIGNATORY',
    'SIGNATORY_PHOTO',
    'SELLER_AGREEMENT',
    'PRODUCT_CATALOG',
    'CERTIFICATION',
    'OTHER'
);


ALTER TYPE "public"."SellerDocType" OWNER TO "postgres";


CREATE TYPE "public"."SellerTeamAccessLevel" AS ENUM (
    'FULL',
    'INVENTORY_ONLY',
    'FINANCE_ONLY'
);


ALTER TYPE "public"."SellerTeamAccessLevel" OWNER TO "postgres";


CREATE TYPE "public"."SellerTeamStatus" AS ENUM (
    'INVITED',
    'ACTIVE',
    'SUSPENDED',
    'REMOVED'
);


ALTER TYPE "public"."SellerTeamStatus" OWNER TO "postgres";


CREATE TYPE "public"."VendorChangeRequestStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED'
);


ALTER TYPE "public"."VendorChangeRequestStatus" OWNER TO "postgres";


CREATE TYPE "public"."VendorDocStatus" AS ENUM (
    'SUBMITTED',
    'APPROVED',
    'REJECTED',
    'SUPERSEDED'
);


ALTER TYPE "public"."VendorDocStatus" OWNER TO "postgres";


CREATE TYPE "public"."VendorDocType" AS ENUM (
    'PAN_CARD',
    'GST_CERTIFICATE',
    'MSME_CERTIFICATE',
    'CANCELLED_CHEQUE',
    'BANK_STATEMENT',
    'ADDRESS_PROOF',
    'AADHAAR_SIGNATORY',
    'SIGNATORY_PHOTO',
    'VENDOR_AGREEMENT',
    'INVOICE',
    'GRN_DISPUTE',
    'OTHER'
);


ALTER TYPE "public"."VendorDocType" OWNER TO "postgres";


CREATE TYPE "public"."VendorPayoutStatus" AS ENUM (
    'SCHEDULED',
    'PROCESSING',
    'PAID',
    'FAILED',
    'CANCELLED'
);


ALTER TYPE "public"."VendorPayoutStatus" OWNER TO "postgres";


CREATE TYPE "public"."VendorStatus" AS ENUM (
    'PENDING',
    'ACTIVE',
    'SUSPENDED',
    'ARCHIVED'
);


ALTER TYPE "public"."VendorStatus" OWNER TO "postgres";


CREATE TYPE "public"."VendorTeamAccessLevel" AS ENUM (
    'FULL',
    'FINANCE_ONLY',
    'OPERATIONS_ONLY'
);


ALTER TYPE "public"."VendorTeamAccessLevel" OWNER TO "postgres";


CREATE TYPE "public"."VendorTeamStatus" AS ENUM (
    'INVITED',
    'ACTIVE',
    'SUSPENDED',
    'REMOVED'
);


ALTER TYPE "public"."VendorTeamStatus" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_customer_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_customer_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."AbAssignment" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "abTestId" "text" NOT NULL,
    "variantId" "text" NOT NULL,
    "subjectKey" "text" NOT NULL,
    "subjectType" "text" NOT NULL,
    "exposedAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "convertedAt" timestamp without time zone,
    "conversionValuePaise" integer
);


ALTER TABLE "public"."AbAssignment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."AbTest" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "key" "text" NOT NULL,
    "displayName" "text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "startedAt" timestamp without time zone,
    "endedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."AbTest" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."AbVariant" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "abTestId" "text" NOT NULL,
    "key" "text" NOT NULL,
    "displayName" "text" NOT NULL,
    "payloadJson" "jsonb" NOT NULL,
    "weight" integer DEFAULT 50 NOT NULL,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."AbVariant" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."AbandonedCart" (
    "id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "userId" "text",
    "itemsJson" "text" NOT NULL,
    "subtotal" integer NOT NULL,
    "itemCount" integer NOT NULL,
    "remindersSent" integer DEFAULT 0 NOT NULL,
    "lastRemindedAt" timestamp(3) without time zone,
    "recoveredOrderId" "text",
    "recoveredAt" timestamp(3) without time zone,
    "optedOut" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "phone" "text",
    "customerName" "text",
    "recoveryStage" integer DEFAULT 0 NOT NULL,
    "nextActionAt" timestamp without time zone,
    "discountCode" "text",
    "discountPercent" integer,
    "aiCopyJson" "jsonb",
    "cartSnapshotHtml" "text",
    "paymentMethodPicked" "text",
    "lastSeenStep" "text",
    "razorpayOrderId" "text",
    "telecallerStatus" "text",
    "telecallerNotes" "text",
    "telecallerCalledAt" timestamp without time zone,
    "telecallerCallbackAt" timestamp without time zone
);


ALTER TABLE "public"."AbandonedCart" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Address" (
    "id" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "line1" "text" NOT NULL,
    "line2" "text",
    "city" "text" NOT NULL,
    "state" "text" NOT NULL,
    "pincode" "text" NOT NULL,
    "country" "text" DEFAULT 'IN'::"text" NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."Address" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."AiPhotoJob" (
    "id" "text" NOT NULL,
    "productId" "text",
    "categorySlug" "text",
    "strategy" "public"."AiPhotoStrategy" NOT NULL,
    "sourceImageUrls" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "variantCount" integer DEFAULT 6 NOT NULL,
    "modelArchetype" "text",
    "stylePreset" "text",
    "addScaleShot" boolean DEFAULT false NOT NULL,
    "imagePrompt" "text",
    "status" "public"."AiPhotoJobStatus" DEFAULT 'QUEUED'::"public"."AiPhotoJobStatus" NOT NULL,
    "errorMessage" "text",
    "startedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "requestedByUserId" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "regenerationFeedback" "text",
    "triggeredByRequestId" "text",
    "variantId" "text"
);


ALTER TABLE "public"."AiPhotoJob" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."AiPhotoRequest" (
    "id" "text" NOT NULL,
    "vendorId" "text" NOT NULL,
    "productId" "text",
    "description" "text" NOT NULL,
    "proposedCategory" "text",
    "sourceImageUrls" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "status" "public"."AiPhotoRequestStatus" DEFAULT 'SUBMITTED'::"public"."AiPhotoRequestStatus" NOT NULL,
    "resultingJobId" "text",
    "adminNote" "text",
    "reviewedByUserId" "text",
    "reviewedAt" timestamp(3) without time zone,
    "requestedByUserId" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."AiPhotoRequest" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."AiPhotoVariant" (
    "id" "text" NOT NULL,
    "jobId" "text" NOT NULL,
    "url" "text" NOT NULL,
    "sceneType" "text" NOT NULL,
    "sceneNote" "text",
    "decision" "public"."AiPhotoDecision" DEFAULT 'PENDING'::"public"."AiPhotoDecision" NOT NULL,
    "decidedAt" timestamp(3) without time zone,
    "decidedByUserId" "text",
    "productImageIndex" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."AiPhotoVariant" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."AiPreview" (
    "id" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "type" "public"."AiType" NOT NULL,
    "sourceImage" "text" NOT NULL,
    "outputImage" "text",
    "productIds" "text"[] DEFAULT ARRAY[]::"text"[],
    "consentLogged" boolean DEFAULT true NOT NULL,
    "deleteAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."AiPreview" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."AnalyticsEvent" (
    "id" "text" NOT NULL,
    "sessionId" "text" NOT NULL,
    "userId" "text",
    "type" "text" NOT NULL,
    "path" "text",
    "productId" "text",
    "value" integer,
    "referrer" "text",
    "utmSource" "text",
    "utmMedium" "text",
    "utmCampaign" "text",
    "device" "text",
    "country" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."AnalyticsEvent" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Asset" (
    "id" "text" NOT NULL,
    "url" "text" NOT NULL,
    "filename" "text",
    "folder" "text",
    "width" integer,
    "height" integer,
    "size" integer,
    "contentType" "text",
    "alt" "text",
    "caption" "text",
    "tags" "text"[] DEFAULT ARRAY[]::"text"[],
    "uploadedBy" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."Asset" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Attendance" (
    "id" "text" NOT NULL,
    "employeeId" "text" NOT NULL,
    "month" integer NOT NULL,
    "year" integer NOT NULL,
    "daysWorked" integer NOT NULL,
    "leavesPaid" integer DEFAULT 0 NOT NULL,
    "leavesUnpaid" integer DEFAULT 0 NOT NULL,
    "overtimeHours" double precision DEFAULT 0 NOT NULL,
    "notes" "text",
    "createdByUserId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."Attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Badge" (
    "id" "text" NOT NULL,
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text" NOT NULL,
    "group" "text" DEFAULT 'editorial'::"text" NOT NULL,
    "imageUrl" "text",
    "active" boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."Badge" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."BankAccount" (
    "id" "text" NOT NULL,
    "nickname" "text" NOT NULL,
    "bankName" "text" NOT NULL,
    "accountNumber" "text",
    "ifsc" "text",
    "accountType" "text",
    "active" boolean DEFAULT true NOT NULL,
    "currency" "text" DEFAULT 'INR'::"text" NOT NULL,
    "openingBalancePaise" integer DEFAULT 0 NOT NULL,
    "openingBalanceDate" timestamp(3) without time zone,
    "lastSyncedAt" timestamp(3) without time zone,
    "lastSyncedSource" "text",
    "rzpxAccountId" "text",
    "createdByUserId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."BankAccount" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."BankTransaction" (
    "id" "text" NOT NULL,
    "bankAccountId" "text" NOT NULL,
    "txnDate" timestamp(3) without time zone NOT NULL,
    "description" "text" NOT NULL,
    "reference" "text",
    "debitPaise" integer DEFAULT 0 NOT NULL,
    "creditPaise" integer DEFAULT 0 NOT NULL,
    "balancePaise" integer,
    "source" "text" NOT NULL,
    "sourceFileUrl" "text",
    "sourceRowHash" "text",
    "status" "public"."BankTxnStatus" DEFAULT 'UNMATCHED'::"public"."BankTxnStatus" NOT NULL,
    "matchedExpenseId" "text",
    "matchedBillPaymentId" "text",
    "matchedRefundId" "text",
    "matchNotes" "text",
    "matchedAt" timestamp(3) without time zone,
    "matchedByUserId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."BankTransaction" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Banner" (
    "id" "text" NOT NULL,
    "position" "text" NOT NULL,
    "title" "text",
    "subtitle" "text",
    "image" "text",
    "video" "text",
    "ctaText" "text",
    "ctaUrl" "text",
    "startsAt" timestamp(3) without time zone,
    "endsAt" timestamp(3) without time zone,
    "active" boolean DEFAULT true NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "textColor" "text",
    "bgColor" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "linkType" "text",
    "linkProductId" "text",
    "linkCategoryId" "text",
    "linkCollectionTag" "text",
    "linkDropSlug" "text",
    "linkPageSlug" "text"
);


ALTER TABLE "public"."Banner" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Bill" (
    "id" "text" NOT NULL,
    "billNumber" "text",
    "description" "text" NOT NULL,
    "vendorId" "text",
    "vendorNameSnapshot" "text",
    "categoryId" "text" NOT NULL,
    "purchaseOrderId" "text",
    "amountPaise" integer NOT NULL,
    "gstPaise" integer DEFAULT 0 NOT NULL,
    "totalPaise" integer NOT NULL,
    "paidPaise" integer DEFAULT 0 NOT NULL,
    "issuedOn" timestamp without time zone NOT NULL,
    "dueOn" timestamp without time zone NOT NULL,
    "status" "public"."BillStatus" DEFAULT 'OPEN'::"public"."BillStatus" NOT NULL,
    "receiptUrl" "text",
    "notes" "text",
    "createdByUserId" "text" NOT NULL,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "attachments" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "expenseId" "text"
);


ALTER TABLE "public"."Bill" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."BillPayment" (
    "id" "text" NOT NULL,
    "billId" "text" NOT NULL,
    "amountPaise" integer NOT NULL,
    "paidOn" timestamp without time zone NOT NULL,
    "method" "text",
    "reference" "text",
    "notes" "text",
    "expenseId" "text",
    "createdByUserId" "text" NOT NULL,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "receiptUrl" "text",
    "attachments" "text"[] DEFAULT '{}'::"text"[] NOT NULL
);


ALTER TABLE "public"."BillPayment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Cart" (
    "id" "text" NOT NULL,
    "userId" "text",
    "sessionId" "text",
    "giftWrap" boolean DEFAULT false NOT NULL,
    "personalNote" "text",
    "couponCode" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."Cart" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."CartItem" (
    "id" "text" NOT NULL,
    "cartId" "text" NOT NULL,
    "productId" "text" NOT NULL,
    "variantId" "text",
    "quantity" integer DEFAULT 1 NOT NULL,
    "price" integer NOT NULL
);


ALTER TABLE "public"."CartItem" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Category" (
    "id" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "parentId" "text",
    "image" "text",
    "description" "text",
    "seoTitle" "text",
    "seoDesc" "text",
    "order" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "featured" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "level" integer DEFAULT 1 NOT NULL,
    "path" "text",
    "hidden" boolean DEFAULT false NOT NULL,
    "aiGenerated" boolean DEFAULT false NOT NULL,
    "gender" "text"
);


ALTER TABLE "public"."Category" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."CategoryRedirect" (
    "id" "text" NOT NULL,
    "fromSlug" "text" NOT NULL,
    "toSlug" "text" NOT NULL,
    "permanent" boolean DEFAULT true NOT NULL,
    "hitCount" integer DEFAULT 0 NOT NULL,
    "lastHitAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."CategoryRedirect" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Category_backup_20260621" (
    "id" "text",
    "slug" "text",
    "name" "text",
    "parentId" "text",
    "image" "text",
    "description" "text",
    "seoTitle" "text",
    "seoDesc" "text",
    "order" integer,
    "active" boolean,
    "featured" boolean,
    "createdAt" timestamp with time zone,
    "updatedAt" timestamp with time zone,
    "level" integer,
    "path" "text",
    "hidden" boolean,
    "aiGenerated" boolean,
    "gender" "text"
);


ALTER TABLE "public"."Category_backup_20260621" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."CmsPage" (
    "id" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "template" "text" NOT NULL,
    "sections" "jsonb" NOT NULL,
    "status" "public"."PageStatus" DEFAULT 'DRAFT'::"public"."PageStatus" NOT NULL,
    "scheduledAt" timestamp(3) without time zone,
    "publishedAt" timestamp(3) without time zone,
    "seoTitle" "text",
    "seoDesc" "text",
    "ogImage" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "pageType" "text" DEFAULT 'page'::"text" NOT NULL,
    "tags" "text"[] DEFAULT ARRAY[]::"text"[],
    "featured" boolean DEFAULT false NOT NULL,
    "excerpt" "text",
    "coverImage" "text",
    "author" "text"
);


ALTER TABLE "public"."CmsPage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Coupon" (
    "id" "text" NOT NULL,
    "code" "text" NOT NULL,
    "type" "text" NOT NULL,
    "value" integer NOT NULL,
    "minCart" integer DEFAULT 0 NOT NULL,
    "maxDiscount" integer,
    "maxUses" integer,
    "usedCount" integer DEFAULT 0 NOT NULL,
    "validFrom" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "validTo" timestamp(3) without time zone,
    "active" boolean DEFAULT true NOT NULL,
    "userId" "text",
    "perUserOnce" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."Coupon" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."CouponRedemption" (
    "id" "text" NOT NULL,
    "couponId" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "orderId" "text",
    "redeemedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."CouponRedemption" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Craft" (
    "id" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "region" "text",
    "state" "text",
    "description" "text",
    "longStory" "text",
    "image" "text",
    "thumbnail" "text",
    "seoTitle" "text",
    "seoDesc" "text",
    "featured" boolean DEFAULT false NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."Craft" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Customer" (
    "id" "text" NOT NULL,
    "displayName" "text" NOT NULL,
    "legalName" "text",
    "primaryEmail" "text",
    "primaryPhone" "text",
    "gstin" "text",
    "pan" "text",
    "placeOfSupply" "text",
    "billingAddress" "text",
    "shippingAddress" "text",
    "customerType" "text" DEFAULT 'INDIVIDUAL'::"text" NOT NULL,
    "channel" "text" DEFAULT 'WEBSITE'::"text" NOT NULL,
    "userId" "text",
    "creditLimitPaise" integer DEFAULT 0 NOT NULL,
    "creditDays" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'ACTIVE'::"text" NOT NULL,
    "notes" "text",
    "source" "text" DEFAULT 'MANUAL'::"text" NOT NULL,
    "createdByUserId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."Customer" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Dispute" (
    "id" "text" NOT NULL,
    "resourceType" "public"."DisputeResourceType" NOT NULL,
    "orderId" "text",
    "purchaseOrderId" "text",
    "vendorId" "text",
    "sellerId" "text",
    "customerUserId" "text",
    "raisedByUserId" "text" NOT NULL,
    "raisedByRole" "text" NOT NULL,
    "category" "public"."DisputeCategory" NOT NULL,
    "severity" "public"."DisputeSeverity" DEFAULT 'MEDIUM'::"public"."DisputeSeverity" NOT NULL,
    "status" "public"."DisputeStatus" DEFAULT 'OPEN'::"public"."DisputeStatus" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "evidenceUrls" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "resolutionNote" "text",
    "resolutionAmountPaise" integer,
    "resolvedAt" timestamp(3) without time zone,
    "resolvedByUserId" "text",
    "dueBy" timestamp(3) without time zone,
    "firstResponseAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."Dispute" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."DisputeEvent" (
    "id" "text" NOT NULL,
    "disputeId" "text" NOT NULL,
    "actorUserId" "text",
    "actorRole" "text",
    "type" "public"."DisputeEventType" NOT NULL,
    "body" "text",
    "fromStatus" "public"."DisputeStatus",
    "toStatus" "public"."DisputeStatus",
    "attachments" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."DisputeEvent" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Drop" (
    "id" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "subtitle" "text",
    "description" "text",
    "coverImage" "text",
    "startsAt" timestamp(3) without time zone NOT NULL,
    "endsAt" timestamp(3) without time zone,
    "productIds" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "status" "public"."DropStatus" DEFAULT 'DRAFT'::"public"."DropStatus" NOT NULL,
    "founderNote" "text",
    "seoTitle" "text",
    "seoDesc" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."Drop" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."EmailCampaign" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "bodyHtml" "text" NOT NULL,
    "bodyText" "text",
    "segment" "text" NOT NULL,
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "scheduledFor" timestamp(3) without time zone,
    "sentAt" timestamp(3) without time zone,
    "recipientCount" integer DEFAULT 0 NOT NULL,
    "sentCount" integer DEFAULT 0 NOT NULL,
    "openCount" integer DEFAULT 0 NOT NULL,
    "clickCount" integer DEFAULT 0 NOT NULL,
    "bounceCount" integer DEFAULT 0 NOT NULL,
    "unsubscribeCount" integer DEFAULT 0 NOT NULL,
    "createdBy" "text",
    "notes" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."EmailCampaign" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Employee" (
    "id" "text" NOT NULL,
    "employeeCode" "text" NOT NULL,
    "firstName" "text" NOT NULL,
    "lastName" "text",
    "email" "text",
    "phone" "text",
    "userId" "text",
    "pan" "text",
    "aadhaarLast4" "text",
    "dob" timestamp(3) without time zone,
    "designation" "text",
    "department" "text",
    "joiningDate" timestamp(3) without time zone NOT NULL,
    "exitDate" timestamp(3) without time zone,
    "employmentType" "text" DEFAULT 'FULL_TIME'::"text" NOT NULL,
    "status" "public"."EmployeeStatus" DEFAULT 'ACTIVE'::"public"."EmployeeStatus" NOT NULL,
    "bankAccountName" "text",
    "bankAccountNumber" "text",
    "bankIfsc" "text",
    "uanNumber" "text",
    "esicNumber" "text",
    "taxRegime" "text" DEFAULT 'NEW'::"text" NOT NULL,
    "address" "text",
    "emergencyContact" "text",
    "notes" "text",
    "createdByUserId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "resignationDate" timestamp(3) without time zone,
    "noticePeriodDays" integer DEFAULT 30,
    "lastWorkingDay" timestamp(3) without time zone,
    "exitReason" "text",
    "exitType" "text",
    "exitNotes" "text",
    "documents" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "photoUrl" "text"
);


ALTER TABLE "public"."Employee" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."EmployeeAdjustment" (
    "id" "text" NOT NULL,
    "employeeId" "text" NOT NULL,
    "forMonth" integer NOT NULL,
    "forYear" integer NOT NULL,
    "kind" "text" NOT NULL,
    "amountPaise" integer NOT NULL,
    "description" "text" NOT NULL,
    "appliedToPayslipId" "text",
    "createdByUserId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."EmployeeAdjustment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."EmployeeSalaryAssignment" (
    "id" "text" NOT NULL,
    "employeeId" "text" NOT NULL,
    "structureId" "text" NOT NULL,
    "effectiveFrom" timestamp(3) without time zone NOT NULL,
    "effectiveTo" timestamp(3) without time zone,
    "ctcOverridePaise" integer,
    "notes" "text",
    "createdByUserId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."EmployeeSalaryAssignment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Expense" (
    "id" "text" NOT NULL,
    "categoryId" "text" NOT NULL,
    "description" "text" NOT NULL,
    "amountPaise" integer NOT NULL,
    "gstPaise" integer DEFAULT 0 NOT NULL,
    "totalPaise" integer NOT NULL,
    "incurredOn" timestamp(3) without time zone NOT NULL,
    "paidOn" timestamp(3) without time zone,
    "vendorId" "text",
    "vendorNameSnapshot" "text",
    "invoiceNumber" "text",
    "receiptUrl" "text",
    "status" "public"."ExpenseStatus" DEFAULT 'DRAFT'::"public"."ExpenseStatus" NOT NULL,
    "createdByUserId" "text" NOT NULL,
    "reviewedByUserId" "text",
    "reviewedAt" timestamp(3) without time zone,
    "reviewNote" "text",
    "source" "public"."ExpenseSource" DEFAULT 'MANUAL'::"public"."ExpenseSource" NOT NULL,
    "sourceRef" "text",
    "orderId" "text",
    "notes" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "attachments" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "paidPaise" integer DEFAULT 0 NOT NULL,
    "paymentStatus" "text" DEFAULT 'UNPAID'::"text" NOT NULL
);


ALTER TABLE "public"."Expense" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ExpenseCategory" (
    "id" "text" NOT NULL,
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "group" "public"."ExpenseGroup" NOT NULL,
    "parentCategoryId" "text",
    "approvalThresholdPaise" integer,
    "isMarketingChannel" boolean DEFAULT false NOT NULL,
    "gstInputClaimable" boolean DEFAULT true NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."ExpenseCategory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ExpensePayment" (
    "id" "text" NOT NULL,
    "expenseId" "text" NOT NULL,
    "amountPaise" integer NOT NULL,
    "paidOn" timestamp(3) without time zone NOT NULL,
    "method" "text",
    "reference" "text",
    "notes" "text",
    "receiptUrl" "text",
    "attachments" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "createdByUserId" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."ExpensePayment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."FinanceAiSummary" (
    "id" "text" NOT NULL,
    "periodStart" timestamp(3) without time zone NOT NULL,
    "periodEnd" timestamp(3) without time zone NOT NULL,
    "headlineMetrics" "jsonb" NOT NULL,
    "narrative" "text" NOT NULL,
    "generatedBy" "text",
    "generatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."FinanceAiSummary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."FinanceAnomalyAlert" (
    "id" "text" NOT NULL,
    "categoryId" "text" NOT NULL,
    "periodStart" timestamp without time zone NOT NULL,
    "periodEnd" timestamp without time zone NOT NULL,
    "actualPaise" integer NOT NULL,
    "meanPaise" integer NOT NULL,
    "stdDevPaise" integer NOT NULL,
    "zScore" double precision NOT NULL,
    "severity" "text" NOT NULL,
    "acknowledgedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."FinanceAnomalyAlert" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."FinanceAuditLog" (
    "id" "text" NOT NULL,
    "action" "text" NOT NULL,
    "entityType" "text" NOT NULL,
    "entityId" "text" NOT NULL,
    "changesJson" "text",
    "fullSnapshot" "text",
    "userId" "text",
    "userEmail" "text",
    "userRole" "text",
    "ipAddress" "text",
    "userAgent" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."FinanceAuditLog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."FinanceReportCache" (
    "id" "text" NOT NULL,
    "reportKey" "text" NOT NULL,
    "reportType" "text" NOT NULL,
    "method" "text" NOT NULL,
    "periodStart" timestamp(3) without time zone NOT NULL,
    "periodEnd" timestamp(3) without time zone NOT NULL,
    "payload" "jsonb" NOT NULL,
    "generatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone
);


ALTER TABLE "public"."FinanceReportCache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."FnFSettlement" (
    "id" "text" NOT NULL,
    "employeeId" "text" NOT NULL,
    "resignationDate" timestamp(3) without time zone,
    "lastWorkingDay" timestamp(3) without time zone NOT NULL,
    "noticePeriodDays" integer DEFAULT 30 NOT NULL,
    "noticeShortfallDays" integer DEFAULT 0 NOT NULL,
    "exitReason" "text",
    "pendingSalaryPaise" integer DEFAULT 0 NOT NULL,
    "pendingDaysWorked" integer DEFAULT 0 NOT NULL,
    "leaveBalanceDays" double precision DEFAULT 0 NOT NULL,
    "leaveEncashmentPaise" integer DEFAULT 0 NOT NULL,
    "bonusDuePaise" integer DEFAULT 0 NOT NULL,
    "incentiveDuePaise" integer DEFAULT 0 NOT NULL,
    "reimbursementDuePaise" integer DEFAULT 0 NOT NULL,
    "gratuityPaise" integer DEFAULT 0 NOT NULL,
    "gratuityEligible" boolean DEFAULT false NOT NULL,
    "noticeRecoveryPaise" integer DEFAULT 0 NOT NULL,
    "loanRecoveryPaise" integer DEFAULT 0 NOT NULL,
    "advanceRecoveryPaise" integer DEFAULT 0 NOT NULL,
    "otherRecoveryPaise" integer DEFAULT 0 NOT NULL,
    "tdsPaise" integer DEFAULT 0 NOT NULL,
    "pfFinalPaise" integer DEFAULT 0 NOT NULL,
    "esiFinalPaise" integer DEFAULT 0 NOT NULL,
    "totalEarningsPaise" integer DEFAULT 0 NOT NULL,
    "totalDeductionsPaise" integer DEFAULT 0 NOT NULL,
    "netPayablePaise" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "approvedByUserId" "text",
    "approvedAt" timestamp(3) without time zone,
    "paidOn" timestamp(3) without time zone,
    "paymentReference" "text",
    "attachments" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "notes" "text",
    "createdByUserId" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."FnFSettlement" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ForecastSnapshot" (
    "id" "text" NOT NULL,
    "scope" "public"."ForecastScope" NOT NULL,
    "productId" "text",
    "categoryId" "text",
    "windowStartDate" timestamp(3) without time zone NOT NULL,
    "windowEndDate" timestamp(3) without time zone NOT NULL,
    "horizonDays" integer DEFAULT 90 NOT NULL,
    "series" "jsonb" NOT NULL,
    "diagnostics" "jsonb" NOT NULL,
    "reorderHint" "text",
    "daysUntilStockout" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."ForecastSnapshot" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."GstEInvoice" (
    "id" "text" NOT NULL,
    "orderId" "text" NOT NULL,
    "irn" "text",
    "ackNo" "text",
    "ackDate" timestamp without time zone,
    "signedQrCode" "text",
    "signedInvoice" "text",
    "status" "public"."EInvoiceStatus" DEFAULT 'PENDING'::"public"."EInvoiceStatus" NOT NULL,
    "errorCode" "text",
    "errorMessage" "text",
    "payload" "jsonb",
    "isManual" boolean DEFAULT false NOT NULL,
    "cancelledAt" timestamp without time zone,
    "cancelReason" "text",
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "attemptedByUserId" "text"
);


ALTER TABLE "public"."GstEInvoice" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."IncentivePlan" (
    "id" "text" NOT NULL,
    "employeeId" "text" NOT NULL,
    "planType" "text" DEFAULT 'FIXED'::"text" NOT NULL,
    "fixedIncentivePaise" integer DEFAULT 0 NOT NULL,
    "variableBasePaise" integer DEFAULT 0 NOT NULL,
    "variableMaxPaise" integer DEFAULT 0 NOT NULL,
    "quarterlyBonusPaise" integer DEFAULT 0 NOT NULL,
    "annualBonusPaise" integer DEFAULT 0 NOT NULL,
    "payoutFrequency" "text" DEFAULT 'MONTHLY'::"text" NOT NULL,
    "metric" "text",
    "notes" "text",
    "active" boolean DEFAULT true NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."IncentivePlan" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."InvoiceNumberCounter" (
    "id" "text" NOT NULL,
    "prefix" "text" NOT NULL,
    "yearMonth" "text" NOT NULL,
    "lastValue" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."InvoiceNumberCounter" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."JournalDraft" (
    "id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "excerpt" "text",
    "body" "text" NOT NULL,
    "coverImage" "text",
    "coverImagePrompt" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "seedTheme" "text",
    "seedRef" "text",
    "status" "text" DEFAULT 'PENDING_REVIEW'::"text" NOT NULL,
    "approvalToken" "text",
    "reviewerNote" "text",
    "reviewedByUserId" "text",
    "reviewedAt" timestamp with time zone,
    "publishedPageId" "text",
    "createdByCron" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."JournalDraft" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."JournalSeedLog" (
    "id" "text" NOT NULL,
    "theme" "text" NOT NULL,
    "seedRef" "text",
    "usedAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "draftId" "text"
);


ALTER TABLE "public"."JournalSeedLog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."LegalEntity" (
    "id" "text" NOT NULL,
    "key" "text" DEFAULT 'default'::"text" NOT NULL,
    "legalName" "text" NOT NULL,
    "brandName" "text" DEFAULT 'NEEJEE'::"text" NOT NULL,
    "gstin" "text",
    "pan" "text",
    "cinNumber" "text",
    "msmeNumber" "text",
    "addressLine1" "text",
    "addressLine2" "text",
    "city" "text",
    "state" "text",
    "pincode" "text",
    "country" "text" DEFAULT 'India'::"text" NOT NULL,
    "bankAccountName" "text",
    "bankAccountNumber" "text",
    "bankIfsc" "text",
    "bankName" "text",
    "bankBranch" "text",
    "contactEmail" "text",
    "contactPhone" "text",
    "authorisedSignatory" "text",
    "signatoryTitle" "text",
    "logoUrl" "text",
    "signatureUrl" "text",
    "gstEnabled" boolean DEFAULT true NOT NULL,
    "defaultGstRate" double precision DEFAULT 5.0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "publicEmail" "text",
    "publicPhone" "text",
    "publicWhatsapp" "text",
    "publicAddressLine" "text",
    "socialInstagram" "text"
);


ALTER TABLE "public"."LegalEntity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."LoyaltyLedger" (
    "id" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "type" "text" NOT NULL,
    "points" integer NOT NULL,
    "reason" "text",
    "orderId" "text",
    "referralId" "text",
    "expiresAt" timestamp(3) without time zone,
    "awardedById" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."LoyaltyLedger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."LoyaltySettings" (
    "id" "text" DEFAULT 'singleton'::"text" NOT NULL,
    "paisePerPoint" integer DEFAULT 10000 NOT NULL,
    "multiplierFound" double precision DEFAULT 1.0 NOT NULL,
    "multiplierKnown" double precision DEFAULT 1.5 NOT NULL,
    "multiplierPersonal" double precision DEFAULT 2.0 NOT NULL,
    "multiplierFamily" double precision DEFAULT 3.0 NOT NULL,
    "redemptionValue" integer DEFAULT 100 NOT NULL,
    "minRedemption" integer DEFAULT 100 NOT NULL,
    "maxRedemptionPct" integer DEFAULT 50 NOT NULL,
    "thresholdKnown" integer DEFAULT 2500000 NOT NULL,
    "thresholdPersonal" integer DEFAULT 7500000 NOT NULL,
    "thresholdFamily" integer DEFAULT 20000000 NOT NULL,
    "referralRewardPoints" integer DEFAULT 500 NOT NULL,
    "refereeDiscountPct" integer DEFAULT 10 NOT NULL,
    "refereeMinOrder" integer DEFAULT 250000 NOT NULL,
    "pointsExpireMonths" integer DEFAULT 12 NOT NULL,
    "familyNeverExpire" boolean DEFAULT true NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."LoyaltySettings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."MarketingApprovalRequest" (
    "id" "text" NOT NULL,
    "resourceType" "public"."MarketingResourceType" NOT NULL,
    "resourceId" "text" NOT NULL,
    "proposedPayload" "jsonb" NOT NULL,
    "status" "public"."MarketingApprovalStatus" DEFAULT 'PENDING'::"public"."MarketingApprovalStatus" NOT NULL,
    "createdByUserId" "text" NOT NULL,
    "reviewedByUserId" "text",
    "reviewedAt" timestamp(3) without time zone,
    "reviewNote" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."MarketingApprovalRequest" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."MarketingBudget" (
    "id" "text" NOT NULL,
    "expenseCategoryId" "text" NOT NULL,
    "periodYear" integer NOT NULL,
    "periodMonth" integer NOT NULL,
    "budgetPaise" integer NOT NULL,
    "notes" "text",
    "createdByUserId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."MarketingBudget" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."MarketingChannelMap" (
    "id" "text" NOT NULL,
    "couponId" "text" NOT NULL,
    "expenseCategoryId" "text" NOT NULL,
    "notes" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."MarketingChannelMap" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."NotificationDispatch" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "channel" "text" NOT NULL,
    "event" "text" NOT NULL,
    "templateName" "text" NOT NULL,
    "recipient" "text" NOT NULL,
    "userId" "text",
    "orderId" "text",
    "cartId" "text",
    "providerRequestId" "text",
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "errorMessage" "text",
    "attempt" integer DEFAULT 1 NOT NULL,
    "maxAttempts" integer DEFAULT 3 NOT NULL,
    "nextRetryAt" timestamp without time zone,
    "payloadJson" "jsonb",
    "providerResponseJson" "jsonb",
    "sentAt" timestamp without time zone,
    "deliveredAt" timestamp without time zone,
    "readAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."NotificationDispatch" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."NotificationLog" (
    "id" "text" NOT NULL,
    "userId" "text",
    "event" "text" NOT NULL,
    "channel" "public"."NotificationChannel" NOT NULL,
    "recipient" "text" NOT NULL,
    "subject" "text",
    "bodySnippet" "text",
    "status" "public"."NotificationStatus" DEFAULT 'QUEUED'::"public"."NotificationStatus" NOT NULL,
    "providerId" "text",
    "errorMessage" "text",
    "contextType" "text",
    "contextId" "text",
    "attemptedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deliveredAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."NotificationLog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."NotificationTemplate" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "key" "text" NOT NULL,
    "channel" "text" NOT NULL,
    "providerTemplateId" "text",
    "providerName" "text" NOT NULL,
    "displayName" "text" NOT NULL,
    "bodyPreview" "text",
    "variableCount" integer DEFAULT 0 NOT NULL,
    "approvalStatus" "text" DEFAULT 'pending'::"text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "lastUsedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."NotificationTemplate" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Order" (
    "id" "text" NOT NULL,
    "orderNumber" "text" NOT NULL,
    "userId" "text",
    "addressId" "text",
    "guestEmail" "text",
    "guestName" "text",
    "subtotal" integer NOT NULL,
    "shipping" integer DEFAULT 0 NOT NULL,
    "tax" integer DEFAULT 0 NOT NULL,
    "discount" integer DEFAULT 0 NOT NULL,
    "total" integer NOT NULL,
    "paymentMethod" "text",
    "paymentStatus" "public"."PaymentStatus" DEFAULT 'PENDING'::"public"."PaymentStatus" NOT NULL,
    "razorpayOrderId" "text",
    "razorpayPaymentId" "text",
    "status" "public"."OrderStatus" DEFAULT 'PLACED'::"public"."OrderStatus" NOT NULL,
    "shippedAt" timestamp(3) without time zone,
    "deliveredAt" timestamp(3) without time zone,
    "trackingUrl" "text",
    "awbNumber" "text",
    "courier" "text",
    "giftWrap" boolean DEFAULT false NOT NULL,
    "personalNote" "text",
    "gstInvoice" "text",
    "gstinCustomer" "text",
    "source" "text" DEFAULT 'WEB'::"text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "utmSource" "text",
    "utmMedium" "text",
    "utmCampaign" "text",
    "utmContent" "text",
    "utmTerm" "text",
    "referrer" "text",
    "landingPage" "text",
    "pointsRedeemed" integer DEFAULT 0 NOT NULL,
    "pointsValue" integer DEFAULT 0 NOT NULL,
    "pointsEarned" integer DEFAULT 0 NOT NULL,
    "postPurchaseSentAt" timestamp(3) without time zone,
    "cancellationReason" "text",
    "cancelledAt" timestamp without time zone
);


ALTER TABLE "public"."Order" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."OrderItem" (
    "id" "text" NOT NULL,
    "orderId" "text" NOT NULL,
    "productId" "text" NOT NULL,
    "variantId" "text",
    "quantity" integer NOT NULL,
    "price" integer NOT NULL,
    "total" integer NOT NULL
);


ALTER TABLE "public"."OrderItem" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."OtpCode" (
    "id" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "codeHash" "text" NOT NULL,
    "purpose" "text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "maxAttempts" integer DEFAULT 3 NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "consumedAt" timestamp(3) without time zone,
    "ipAddress" "text",
    "userAgent" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."OtpCode" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."OtpToken" (
    "id" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "codeHash" "text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "consumedAt" timestamp(3) without time zone,
    "ipAddress" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."OtpToken" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Payout" (
    "id" "text" NOT NULL,
    "sellerId" "text" NOT NULL,
    "periodStart" timestamp(3) without time zone NOT NULL,
    "periodEnd" timestamp(3) without time zone NOT NULL,
    "grossSales" integer DEFAULT 0 NOT NULL,
    "commissionPaise" integer DEFAULT 0 NOT NULL,
    "netPayoutPaise" integer DEFAULT 0 NOT NULL,
    "orderCount" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "utr" "text",
    "paidAt" timestamp(3) without time zone,
    "notes" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "rzpxPayoutId" "text",
    "rzpxStatus" "text",
    "rzpxFailReason" "text",
    "initiatedByUserId" "text",
    "initiatedAt" timestamp with time zone
);


ALTER TABLE "public"."Payout" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PayrollConfig" (
    "id" "text" DEFAULT 'singleton'::"text" NOT NULL,
    "pfEnabled" boolean DEFAULT false NOT NULL,
    "esiEnabled" boolean DEFAULT false NOT NULL,
    "tdsEnabled" boolean DEFAULT false NOT NULL,
    "ptEnabled" boolean DEFAULT false NOT NULL,
    "pfEmployeeRate" double precision DEFAULT 12.0 NOT NULL,
    "pfEmployerRate" double precision DEFAULT 12.0 NOT NULL,
    "pfWageCeilingPaise" integer DEFAULT 1500000 NOT NULL,
    "esiEmployeeRate" double precision DEFAULT 0.75 NOT NULL,
    "esiEmployerRate" double precision DEFAULT 3.25 NOT NULL,
    "esiGrossCeilingPaise" integer DEFAULT 2100000 NOT NULL,
    "ptSlabsJson" "text" DEFAULT '[]'::"text" NOT NULL,
    "tdsDefaultRate" double precision DEFAULT 0 NOT NULL,
    "payCycleDay" integer DEFAULT 1 NOT NULL,
    "workingDaysPerMonth" integer DEFAULT 26 NOT NULL,
    "notes" "text",
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."PayrollConfig" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PayrollRun" (
    "id" "text" NOT NULL,
    "month" integer NOT NULL,
    "year" integer NOT NULL,
    "label" "text" NOT NULL,
    "status" "public"."PayrollRunStatus" DEFAULT 'DRAFT'::"public"."PayrollRunStatus" NOT NULL,
    "totalGrossPaise" integer DEFAULT 0 NOT NULL,
    "totalDeductionsPaise" integer DEFAULT 0 NOT NULL,
    "totalNetPaise" integer DEFAULT 0 NOT NULL,
    "employeeCount" integer DEFAULT 0 NOT NULL,
    "computedAt" timestamp(3) without time zone,
    "approvedAt" timestamp(3) without time zone,
    "approvedByUserId" "text",
    "paidAt" timestamp(3) without time zone,
    "paidByUserId" "text",
    "notes" "text",
    "createdByUserId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."PayrollRun" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Payslip" (
    "id" "text" NOT NULL,
    "payrollRunId" "text" NOT NULL,
    "employeeId" "text" NOT NULL,
    "daysInMonth" integer NOT NULL,
    "daysWorked" integer NOT NULL,
    "leavesPaid" integer DEFAULT 0 NOT NULL,
    "leavesUnpaid" integer DEFAULT 0 NOT NULL,
    "basicPaise" integer DEFAULT 0 NOT NULL,
    "hraPaise" integer DEFAULT 0 NOT NULL,
    "conveyancePaise" integer DEFAULT 0 NOT NULL,
    "medicalPaise" integer DEFAULT 0 NOT NULL,
    "specialAllowancePaise" integer DEFAULT 0 NOT NULL,
    "ltaPaise" integer DEFAULT 0 NOT NULL,
    "bonusPaise" integer DEFAULT 0 NOT NULL,
    "incentivePaise" integer DEFAULT 0 NOT NULL,
    "reimbursementPaise" integer DEFAULT 0 NOT NULL,
    "otherEarningsPaise" integer DEFAULT 0 NOT NULL,
    "grossPaise" integer DEFAULT 0 NOT NULL,
    "pfEmployeePaise" integer DEFAULT 0 NOT NULL,
    "pfEmployerPaise" integer DEFAULT 0 NOT NULL,
    "esiEmployeePaise" integer DEFAULT 0 NOT NULL,
    "esiEmployerPaise" integer DEFAULT 0 NOT NULL,
    "tdsPaise" integer DEFAULT 0 NOT NULL,
    "professionalTaxPaise" integer DEFAULT 0 NOT NULL,
    "advanceRecoveryPaise" integer DEFAULT 0 NOT NULL,
    "loanRepaymentPaise" integer DEFAULT 0 NOT NULL,
    "finesPaise" integer DEFAULT 0 NOT NULL,
    "otherDeductionsPaise" integer DEFAULT 0 NOT NULL,
    "totalDeductionsPaise" integer DEFAULT 0 NOT NULL,
    "netPaise" integer DEFAULT 0 NOT NULL,
    "paidOn" timestamp(3) without time zone,
    "paymentMethod" "text",
    "paymentReference" "text",
    "payslipUrl" "text",
    "deliveredEmailAt" timestamp(3) without time zone,
    "deliveredWhatsappAt" timestamp(3) without time zone,
    "deliveredSmsAt" timestamp(3) without time zone,
    "notes" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."Payslip" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PeriodLock" (
    "id" "text" NOT NULL,
    "monthBucket" "text" NOT NULL,
    "lockedByUserId" "text" NOT NULL,
    "lockedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "notes" "text"
);


ALTER TABLE "public"."PeriodLock" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PoMessage" (
    "id" "text" NOT NULL,
    "purchaseOrderId" "text" NOT NULL,
    "authorUserId" "text" NOT NULL,
    "authorRole" "text" NOT NULL,
    "authorName" "text" NOT NULL,
    "body" "text" NOT NULL,
    "attachments" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "readByVendorAt" timestamp(3) without time zone,
    "readByAdminAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."PoMessage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PreorderBalance" (
    "id" "text" NOT NULL,
    "orderId" "text" NOT NULL,
    "productId" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "depositPaise" integer NOT NULL,
    "balancePaise" integer NOT NULL,
    "status" "public"."PreorderBalanceStatus" DEFAULT 'PENDING'::"public"."PreorderBalanceStatus" NOT NULL,
    "dueAt" timestamp(3) without time zone,
    "paidAt" timestamp(3) without time zone,
    "balanceOrderId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."PreorderBalance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Product" (
    "id" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "sku" "text" NOT NULL,
    "name" "text" NOT NULL,
    "shortName" "text",
    "poeticLine" "text",
    "description" "text",
    "sellerId" "text",
    "craft" "text",
    "region" "text",
    "state" "text",
    "cluster" "text",
    "artisanName" "text",
    "categoryId" "text" NOT NULL,
    "material" "text",
    "technique" "text",
    "occasion" "text",
    "mrp" integer NOT NULL,
    "sellingPrice" integer NOT NULL,
    "salePrice" integer,
    "gstRate" double precision DEFAULT 5.0 NOT NULL,
    "hsnCode" "text",
    "images" "text"[] DEFAULT ARRAY[]::"text"[],
    "video" "text",
    "story" "text",
    "craftNote" "text",
    "careInstructions" "text",
    "sustainabilityNote" "text",
    "status" "public"."ProductStatus" DEFAULT 'DRAFT'::"public"."ProductStatus" NOT NULL,
    "badges" "text"[] DEFAULT ARRAY[]::"text"[],
    "seoTitle" "text",
    "seoDesc" "text",
    "aiTryOnEligible" boolean DEFAULT false NOT NULL,
    "aiRoomEligible" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "saleStartsAt" timestamp(3) without time zone,
    "saleEndsAt" timestamp(3) without time zone,
    "codEligible" boolean DEFAULT true NOT NULL,
    "returnEligible" boolean DEFAULT true NOT NULL,
    "returnPolicy" "text",
    "arTryOnEligible" boolean DEFAULT false NOT NULL,
    "fulfilmentMode" "public"."FulfilmentMode" DEFAULT 'IN_STOCK'::"public"."FulfilmentMode" NOT NULL,
    "depositPercent" integer,
    "releaseDate" timestamp(3) without time zone,
    "editionSize" integer,
    "editionSold" integer DEFAULT 0 NOT NULL,
    "ownershipModel" "public"."ProductOwnership" DEFAULT 'OWNED'::"public"."ProductOwnership" NOT NULL,
    "takedownAt" timestamp(3) without time zone,
    "takedownReason" "text",
    "takedownByUserId" "text"
);


ALTER TABLE "public"."Product" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Product_backup_20260621" (
    "id" "text",
    "slug" "text",
    "sku" "text",
    "name" "text",
    "shortName" "text",
    "poeticLine" "text",
    "description" "text",
    "sellerId" "text",
    "craft" "text",
    "region" "text",
    "state" "text",
    "cluster" "text",
    "artisanName" "text",
    "categoryId" "text",
    "material" "text",
    "technique" "text",
    "occasion" "text",
    "mrp" integer,
    "sellingPrice" integer,
    "salePrice" integer,
    "gstRate" double precision,
    "hsnCode" "text",
    "images" "text"[],
    "video" "text",
    "story" "text",
    "craftNote" "text",
    "careInstructions" "text",
    "sustainabilityNote" "text",
    "status" "public"."ProductStatus",
    "badges" "text"[],
    "seoTitle" "text",
    "seoDesc" "text",
    "aiTryOnEligible" boolean,
    "aiRoomEligible" boolean,
    "createdAt" timestamp(3) without time zone,
    "updatedAt" timestamp(3) without time zone,
    "saleStartsAt" timestamp(3) without time zone,
    "saleEndsAt" timestamp(3) without time zone,
    "codEligible" boolean,
    "returnEligible" boolean,
    "returnPolicy" "text",
    "arTryOnEligible" boolean,
    "fulfilmentMode" "public"."FulfilmentMode",
    "depositPercent" integer,
    "releaseDate" timestamp(3) without time zone,
    "editionSize" integer,
    "editionSold" integer,
    "ownershipModel" "public"."ProductOwnership",
    "takedownAt" timestamp(3) without time zone,
    "takedownReason" "text",
    "takedownByUserId" "text"
);


ALTER TABLE "public"."Product_backup_20260621" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PurchaseCost" (
    "id" "text" NOT NULL,
    "productId" "text" NOT NULL,
    "variantId" "text",
    "vendorId" "text" NOT NULL,
    "purchaseOrderId" "text",
    "quantity" integer NOT NULL,
    "unitCostPaise" integer NOT NULL,
    "gstRate" double precision DEFAULT 5.0 NOT NULL,
    "receivedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "notes" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."PurchaseCost" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PurchaseOrder" (
    "id" "text" NOT NULL,
    "poNumber" "text" NOT NULL,
    "vendorId" "text" NOT NULL,
    "status" "public"."PurchaseOrderStatus" DEFAULT 'DRAFT'::"public"."PurchaseOrderStatus" NOT NULL,
    "vendorNameSnapshot" "text" NOT NULL,
    "vendorGstinSnapshot" "text",
    "vendorAddressSnapshot" "text",
    "shipToAddress" "text",
    "subtotalPaise" integer DEFAULT 0 NOT NULL,
    "gstPaise" integer DEFAULT 0 NOT NULL,
    "totalPaise" integer DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'INR'::"text" NOT NULL,
    "sentAt" timestamp(3) without time zone,
    "confirmedAt" timestamp(3) without time zone,
    "dispatchedAt" timestamp(3) without time zone,
    "receivedAt" timestamp(3) without time zone,
    "closedAt" timestamp(3) without time zone,
    "cancelledAt" timestamp(3) without time zone,
    "vendorInvoiceNumber" "text",
    "vendorInvoiceUrl" "text",
    "trackingNumber" "text",
    "trackingUrl" "text",
    "expectedDate" timestamp(3) without time zone,
    "notes" "text",
    "createdById" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."PurchaseOrder" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PurchaseOrderLine" (
    "id" "text" NOT NULL,
    "purchaseOrderId" "text" NOT NULL,
    "productId" "text",
    "variantId" "text",
    "description" "text" NOT NULL,
    "sku" "text",
    "orderedQty" integer NOT NULL,
    "confirmedQty" integer,
    "dispatchedQty" integer,
    "receivedQty" integer,
    "unitCostPaise" integer NOT NULL,
    "receivedUnitCostPaise" integer,
    "gstRate" double precision DEFAULT 5.0 NOT NULL,
    "notes" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."PurchaseOrderLine" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."RecoverySettings" (
    "id" "text" DEFAULT 'default'::"text" NOT NULL,
    "cadenceHours" "jsonb" DEFAULT '{"stage1": 1, "stage2": 24, "stage3": 72, "stage4": 168}'::"jsonb" NOT NULL,
    "discountPercents" "jsonb" DEFAULT '{"stage2": 10, "stage3": 15}'::"jsonb" NOT NULL,
    "aiEnabled" boolean DEFAULT true NOT NULL,
    "telecallerHandoffEnabled" boolean DEFAULT true NOT NULL,
    "abandonGraceMinutes" integer DEFAULT 30 NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "channelMatrix" "jsonb" DEFAULT '{"stage1": {"sms": false, "email": true, "whatsapp": false}, "stage2": {"sms": false, "email": true, "whatsapp": true}, "stage3": {"sms": false, "email": true, "whatsapp": true}, "stage4": {"sms": true, "email": true, "whatsapp": false}}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."RecoverySettings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."RecurringExpense" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "categoryId" "text" NOT NULL,
    "vendorId" "text",
    "vendorNameSnapshot" "text",
    "amountPaise" integer NOT NULL,
    "gstPaise" integer DEFAULT 0 NOT NULL,
    "totalPaise" integer NOT NULL,
    "frequency" "public"."RecurringFrequency" NOT NULL,
    "dayOfMonth" integer,
    "dueOffsetDays" integer DEFAULT 15 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "lastRunDate" timestamp without time zone,
    "nextRunDate" timestamp without time zone NOT NULL,
    "createdByUserId" "text" NOT NULL,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."RecurringExpense" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Referral" (
    "id" "text" NOT NULL,
    "referrerId" "text" NOT NULL,
    "refereeId" "text",
    "refereeEmail" "text",
    "code" "text" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "firstOrderId" "text",
    "rewardedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."Referral" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ReimbursementPolicy" (
    "id" "text" NOT NULL,
    "employeeId" "text" NOT NULL,
    "mobileCapPaise" integer DEFAULT 0 NOT NULL,
    "conveyanceCapPaise" integer DEFAULT 0 NOT NULL,
    "internetCapPaise" integer DEFAULT 0 NOT NULL,
    "foodCapPaise" integer DEFAULT 0 NOT NULL,
    "fuelCapPaise" integer DEFAULT 0 NOT NULL,
    "bookCapPaise" integer DEFAULT 0 NOT NULL,
    "otherCapPaise" integer DEFAULT 0 NOT NULL,
    "autoAddToPayroll" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."ReimbursementPolicy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ReturnEntry" (
    "id" "text" NOT NULL,
    "orderId" "text" NOT NULL,
    "orderNumber" "text" NOT NULL,
    "returnedOn" timestamp(3) without time zone NOT NULL,
    "refundedOn" timestamp(3) without time zone,
    "refundedAmountPaise" integer NOT NULL,
    "reverseShippingPaise" integer DEFAULT 0 NOT NULL,
    "damagedValuePaise" integer DEFAULT 0 NOT NULL,
    "restockedValuePaise" integer DEFAULT 0 NOT NULL,
    "lineBreakdown" "jsonb" NOT NULL,
    "reason" "text",
    "notes" "text",
    "createdByUserId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."ReturnEntry" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."RevenueEntry" (
    "id" "text" NOT NULL,
    "orderId" "text",
    "orderItemId" "text",
    "invoiceId" "text",
    "invoiceLineId" "text",
    "type" "text" NOT NULL,
    "channel" "text" NOT NULL,
    "saleType" "text" NOT NULL,
    "amountPaise" integer NOT NULL,
    "gstRatePercent" double precision,
    "cgstPaise" integer DEFAULT 0 NOT NULL,
    "sgstPaise" integer DEFAULT 0 NOT NULL,
    "igstPaise" integer DEFAULT 0 NOT NULL,
    "hsnSac" "text",
    "customerUserId" "text",
    "customerName" "text",
    "sellerId" "text",
    "productId" "text",
    "variantId" "text",
    "status" "text" DEFAULT 'ACCRUED'::"text" NOT NULL,
    "realizedOn" timestamp(3) without time zone,
    "paymentRef" "text",
    "txnDate" timestamp(3) without time zone NOT NULL,
    "monthBucket" "text" NOT NULL,
    "sourceHash" "text" NOT NULL,
    "postedByUserId" "text",
    "notes" "text",
    "reversedById" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."RevenueEntry" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Review" (
    "id" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "productId" "text" NOT NULL,
    "rating" integer NOT NULL,
    "title" "text",
    "body" "text" NOT NULL,
    "images" "text"[] DEFAULT ARRAY[]::"text"[],
    "status" "public"."ReviewStatus" DEFAULT 'PENDING'::"public"."ReviewStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."Review" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."SalaryStructure" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "basicPaise" integer NOT NULL,
    "hraPaise" integer NOT NULL,
    "conveyancePaise" integer DEFAULT 0 NOT NULL,
    "medicalPaise" integer DEFAULT 0 NOT NULL,
    "specialAllowancePaise" integer DEFAULT 0 NOT NULL,
    "ltaMonthlyPaise" integer DEFAULT 0 NOT NULL,
    "performanceBonusPaise" integer DEFAULT 0 NOT NULL,
    "monthlyCtcPaise" integer NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "createdByUserId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."SalaryStructure" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."SalesInvoice" (
    "id" "text" NOT NULL,
    "invoiceNumber" "text" NOT NULL,
    "invoiceType" "text" NOT NULL,
    "saleChannel" "text" NOT NULL,
    "saleType" "text" DEFAULT 'DIRECT'::"text" NOT NULL,
    "customerUserId" "text",
    "customerName" "text" NOT NULL,
    "customerEmail" "text",
    "customerPhone" "text",
    "customerGstin" "text",
    "billingAddress" "text",
    "shippingAddress" "text",
    "sellerId" "text",
    "orderId" "text",
    "issuedOn" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "dueOn" timestamp(3) without time zone,
    "placeOfSupply" "text",
    "subtotalPaise" integer DEFAULT 0 NOT NULL,
    "discountPaise" integer DEFAULT 0 NOT NULL,
    "taxableValuePaise" integer DEFAULT 0 NOT NULL,
    "cgstPaise" integer DEFAULT 0 NOT NULL,
    "sgstPaise" integer DEFAULT 0 NOT NULL,
    "igstPaise" integer DEFAULT 0 NOT NULL,
    "shippingPaise" integer DEFAULT 0 NOT NULL,
    "shippingTaxPaise" integer DEFAULT 0 NOT NULL,
    "roundOffPaise" integer DEFAULT 0 NOT NULL,
    "totalPaise" integer DEFAULT 0 NOT NULL,
    "paidPaise" integer DEFAULT 0 NOT NULL,
    "paymentStatus" "text" DEFAULT 'UNPAID'::"text" NOT NULL,
    "posted" boolean DEFAULT false NOT NULL,
    "postedAt" timestamp(3) without time zone,
    "pdfUrl" "text",
    "attachments" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "notes" "text",
    "createdByUserId" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "customerId" "text"
);


ALTER TABLE "public"."SalesInvoice" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."SalesInvoiceLine" (
    "id" "text" NOT NULL,
    "invoiceId" "text" NOT NULL,
    "productId" "text",
    "variantId" "text",
    "sku" "text",
    "description" "text" NOT NULL,
    "hsnSac" "text",
    "quantity" double precision DEFAULT 1 NOT NULL,
    "unitPricePaise" integer NOT NULL,
    "discountPaise" integer DEFAULT 0 NOT NULL,
    "taxableValuePaise" integer NOT NULL,
    "gstRatePercent" double precision DEFAULT 0 NOT NULL,
    "cgstPaise" integer DEFAULT 0 NOT NULL,
    "sgstPaise" integer DEFAULT 0 NOT NULL,
    "igstPaise" integer DEFAULT 0 NOT NULL,
    "totalPaise" integer NOT NULL,
    "unitCostPaise" integer,
    "cogsPaise" integer,
    "saleType" "text" DEFAULT 'DIRECT'::"text" NOT NULL,
    "sellerId" "text",
    "commissionRatePercent" double precision,
    "commissionBaseAmountPaise" integer
);


ALTER TABLE "public"."SalesInvoiceLine" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."SalesInvoicePayment" (
    "id" "text" NOT NULL,
    "invoiceId" "text" NOT NULL,
    "amountPaise" integer NOT NULL,
    "paidOn" timestamp(3) without time zone NOT NULL,
    "method" "text",
    "reference" "text",
    "notes" "text",
    "receiptUrl" "text",
    "attachments" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "createdByUserId" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."SalesInvoicePayment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Seller" (
    "id" "text" NOT NULL,
    "businessName" "text" NOT NULL,
    "contactName" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "pan" "text",
    "gstin" "text",
    "bankAccount" "text",
    "ifsc" "text",
    "region" "text",
    "craft" "text",
    "cluster" "text",
    "kycStatus" "public"."KycStatus" DEFAULT 'PENDING'::"public"."KycStatus" NOT NULL,
    "qualityScore" double precision DEFAULT 0 NOT NULL,
    "commissionPct" double precision DEFAULT 20 NOT NULL,
    "isNeejeeSelect" boolean DEFAULT false NOT NULL,
    "payoutCycle" "text" DEFAULT 'WEEKLY'::"text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "userId" "text",
    "slug" "text",
    "story" "text",
    "yearsOfPractice" integer,
    "logoImage" "text",
    "coverImage" "text",
    "portfolio" "text"[] DEFAULT ARRAY[]::"text"[],
    "bankName" "text",
    "rejectionNote" "text",
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "rzpxContactId" "text",
    "rzpxFundAccountId" "text"
);


ALTER TABLE "public"."Seller" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."SellerAuditLog" (
    "id" "text" NOT NULL,
    "sellerId" "text" NOT NULL,
    "actorUserId" "text",
    "actorRole" "text",
    "action" "text" NOT NULL,
    "details" "jsonb",
    "ipAddress" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."SellerAuditLog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."SellerCategoryCommission" (
    "id" "text" NOT NULL,
    "sellerId" "text" NOT NULL,
    "categoryId" "text" NOT NULL,
    "commissionPercent" double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."SellerCategoryCommission" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."SellerChangeRequest" (
    "id" "text" NOT NULL,
    "sellerId" "text" NOT NULL,
    "fieldChanges" "jsonb" NOT NULL,
    "reason" "text",
    "status" "public"."SellerChangeRequestStatus" DEFAULT 'PENDING'::"public"."SellerChangeRequestStatus" NOT NULL,
    "requestedByUserId" "text" NOT NULL,
    "requestedOnBehalf" boolean DEFAULT false NOT NULL,
    "reviewedByUserId" "text",
    "reviewedAt" timestamp(3) without time zone,
    "reviewNote" "text",
    "appliedAt" timestamp(3) without time zone,
    "cancelledAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."SellerChangeRequest" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."SellerDocument" (
    "id" "text" NOT NULL,
    "sellerId" "text" NOT NULL,
    "docType" "public"."SellerDocType" NOT NULL,
    "title" "text",
    "fileName" "text" NOT NULL,
    "fileUrl" "text" NOT NULL,
    "fileSize" integer NOT NULL,
    "mimeType" "text" NOT NULL,
    "status" "public"."SellerDocStatus" DEFAULT 'SUBMITTED'::"public"."SellerDocStatus" NOT NULL,
    "uploadedByUserId" "text" NOT NULL,
    "uploadedOnBehalf" boolean DEFAULT false NOT NULL,
    "reviewedByUserId" "text",
    "reviewedAt" timestamp(3) without time zone,
    "reviewNote" "text",
    "changeRequestId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."SellerDocument" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."SellerInventorySubmission" (
    "id" "text" NOT NULL,
    "sellerId" "text" NOT NULL,
    "submissionType" "public"."InventorySubmissionType" NOT NULL,
    "proposedData" "jsonb" NOT NULL,
    "productId" "text",
    "status" "public"."InventorySubmissionStatus" DEFAULT 'SUBMITTED'::"public"."InventorySubmissionStatus" NOT NULL,
    "createdByUserId" "text" NOT NULL,
    "reviewedByUserId" "text",
    "reviewedAt" timestamp(3) without time zone,
    "reviewNote" "text",
    "publishedAt" timestamp(3) without time zone,
    "sourceFileUrl" "text",
    "sourceFileName" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."SellerInventorySubmission" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."SellerMagicToken" (
    "id" "text" NOT NULL,
    "sellerId" "text" NOT NULL,
    "tokenHash" "text" NOT NULL,
    "purpose" "text" DEFAULT 'LOGIN'::"text" NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "consumedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."SellerMagicToken" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."SellerOrderRelease" (
    "id" "text" NOT NULL,
    "orderId" "text" NOT NULL,
    "sellerId" "text" NOT NULL,
    "productIds" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "releasedAt" timestamp(3) without time zone,
    "releasedByUserId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."SellerOrderRelease" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."SellerProductCommission" (
    "id" "text" NOT NULL,
    "sellerId" "text" NOT NULL,
    "productId" "text" NOT NULL,
    "commissionPercent" double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."SellerProductCommission" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."SellerTeamMember" (
    "id" "text" NOT NULL,
    "sellerId" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "displayName" "text",
    "email" "text" NOT NULL,
    "accessLevel" "public"."SellerTeamAccessLevel" DEFAULT 'FULL'::"public"."SellerTeamAccessLevel" NOT NULL,
    "status" "public"."SellerTeamStatus" DEFAULT 'INVITED'::"public"."SellerTeamStatus" NOT NULL,
    "invitedByUserId" "text",
    "invitedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "acceptedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."SellerTeamMember" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ShippingZone" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "pincodePrefixes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "pincodeExact" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "states" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "standardPaise" integer DEFAULT 15000 NOT NULL,
    "expressPaise" integer DEFAULT 25000 NOT NULL,
    "freeAboveSubtotalPaise" integer DEFAULT 250000 NOT NULL,
    "inclusive" boolean DEFAULT false NOT NULL,
    "priority" integer DEFAULT 100 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ShippingZone" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."SmsTemplate" (
    "id" "text" NOT NULL,
    "event" "text" NOT NULL,
    "label" "text" NOT NULL,
    "templateId" "text" NOT NULL,
    "body" "text" NOT NULL,
    "varOrder" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "category" "text" DEFAULT 'transactional'::"text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "lastUsedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."SmsTemplate" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."TdsCertificate" (
    "id" "text" NOT NULL,
    "vendorId" "text" NOT NULL,
    "vendorNameSnapshot" "text" NOT NULL,
    "vendorPanSnapshot" "text",
    "vendorAddressSnapshot" "text",
    "financialYear" "text" NOT NULL,
    "quarter" integer NOT NULL,
    "periodStart" timestamp without time zone NOT NULL,
    "periodEnd" timestamp without time zone NOT NULL,
    "grossPaymentsPaise" integer DEFAULT 0 NOT NULL,
    "tdsDeductedPaise" integer DEFAULT 0 NOT NULL,
    "tdsRate" double precision DEFAULT 1.0 NOT NULL,
    "section" "text" DEFAULT '194Q'::"text" NOT NULL,
    "certificateNumber" "text",
    "pdfUrl" "text",
    "issuedAt" timestamp without time zone,
    "issuedByUserId" "text",
    "tracesReceiptNo" "text",
    "tracesFilingDate" timestamp without time zone,
    "coveredPayoutIds" "text"[] DEFAULT ARRAY[]::"text"[],
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."TdsCertificate" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."User" (
    "id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "name" "text",
    "passwordHash" "text",
    "role" "public"."Role" DEFAULT 'CUSTOMER'::"public"."Role" NOT NULL,
    "emailVerified" timestamp(3) without time zone,
    "image" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "marketingConsent" boolean DEFAULT false NOT NULL,
    "smsOptIn" boolean DEFAULT false NOT NULL,
    "whatsappOptIn" boolean DEFAULT false NOT NULL,
    "emailOptIn" boolean DEFAULT true NOT NULL,
    "welcomeCouponId" "text",
    "loyaltyTier" "text" DEFAULT 'FOUND'::"text" NOT NULL,
    "loyaltyPoints" integer DEFAULT 0 NOT NULL,
    "lifetimePoints" integer DEFAULT 0 NOT NULL,
    "lifetimeSpend" integer DEFAULT 0 NOT NULL,
    "referralCode" "text",
    "referredById" "text",
    "lastWinBackAt" timestamp(3) without time zone,
    "phoneVerified" boolean DEFAULT false NOT NULL,
    "phoneVerifiedAt" timestamp without time zone,
    "primaryAuthMethod" "text"
);


ALTER TABLE "public"."User" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Variant" (
    "id" "text" NOT NULL,
    "productId" "text" NOT NULL,
    "sku" "text" NOT NULL,
    "size" "text",
    "color" "text",
    "material" "text",
    "inventory" integer DEFAULT 0 NOT NULL,
    "lowStockThreshold" integer DEFAULT 3 NOT NULL,
    "mrp" integer,
    "sellingPrice" integer,
    "weight" double precision,
    "images" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "colorHex" "text"
);


ALTER TABLE "public"."Variant" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Vendor" (
    "id" "text" NOT NULL,
    "userId" "text",
    "legalName" "text" NOT NULL,
    "displayName" "text",
    "contactPerson" "text",
    "contactEmail" "text" NOT NULL,
    "contactPhone" "text",
    "gstin" "text",
    "pan" "text",
    "msmeNumber" "text",
    "addressLine1" "text",
    "addressLine2" "text",
    "city" "text",
    "state" "text",
    "pincode" "text",
    "country" "text" DEFAULT 'India'::"text" NOT NULL,
    "bankAccountName" "text",
    "bankAccountNumber" "text",
    "bankIfsc" "text",
    "bankName" "text",
    "paymentTermsDays" integer DEFAULT 30 NOT NULL,
    "defaultLeadTimeDays" integer DEFAULT 14 NOT NULL,
    "status" "public"."VendorStatus" DEFAULT 'PENDING'::"public"."VendorStatus" NOT NULL,
    "notes" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "rzpxContactId" "text",
    "rzpxFundAccountId" "text",
    "serviceCategoryGroup" "text",
    "defaultExpenseCategoryId" "text"
);


ALTER TABLE "public"."Vendor" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."VendorAuditLog" (
    "id" "text" NOT NULL,
    "vendorId" "text" NOT NULL,
    "actorUserId" "text",
    "actorRole" "text",
    "action" "text" NOT NULL,
    "details" "jsonb",
    "ipAddress" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."VendorAuditLog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."VendorCatalogItem" (
    "id" "text" NOT NULL,
    "vendorId" "text" NOT NULL,
    "vendorSku" "text" NOT NULL,
    "description" "text" NOT NULL,
    "hsnCode" "text",
    "productId" "text",
    "unitCostPaise" integer NOT NULL,
    "currency" "text" DEFAULT 'INR'::"text" NOT NULL,
    "gstRate" double precision DEFAULT 5.0 NOT NULL,
    "moq" integer DEFAULT 1 NOT NULL,
    "leadTimeDays" integer,
    "tieredPricing" "jsonb",
    "validFrom" timestamp without time zone DEFAULT "now"() NOT NULL,
    "validUntil" timestamp without time zone,
    "active" boolean DEFAULT true NOT NULL,
    "imageUrl" "text",
    "notes" "text",
    "createdByUserId" "text" NOT NULL,
    "lastUpdatedByUserId" "text",
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."VendorCatalogItem" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."VendorChangeRequest" (
    "id" "text" NOT NULL,
    "vendorId" "text" NOT NULL,
    "fieldChanges" "jsonb" NOT NULL,
    "reason" "text",
    "status" "public"."VendorChangeRequestStatus" DEFAULT 'PENDING'::"public"."VendorChangeRequestStatus" NOT NULL,
    "requestedByUserId" "text" NOT NULL,
    "requestedOnBehalf" boolean DEFAULT false NOT NULL,
    "reviewedByUserId" "text",
    "reviewedAt" timestamp(3) without time zone,
    "reviewNote" "text",
    "appliedAt" timestamp(3) without time zone,
    "cancelledAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."VendorChangeRequest" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."VendorDocument" (
    "id" "text" NOT NULL,
    "vendorId" "text" NOT NULL,
    "docType" "public"."VendorDocType" NOT NULL,
    "title" "text",
    "fileName" "text" NOT NULL,
    "fileUrl" "text" NOT NULL,
    "fileSize" integer NOT NULL,
    "mimeType" "text" NOT NULL,
    "status" "public"."VendorDocStatus" DEFAULT 'SUBMITTED'::"public"."VendorDocStatus" NOT NULL,
    "uploadedByUserId" "text" NOT NULL,
    "uploadedOnBehalf" boolean DEFAULT false NOT NULL,
    "reviewedByUserId" "text",
    "reviewedAt" timestamp(3) without time zone,
    "reviewNote" "text",
    "changeRequestId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."VendorDocument" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."VendorMagicToken" (
    "id" "text" NOT NULL,
    "vendorId" "text" NOT NULL,
    "tokenHash" "text" NOT NULL,
    "purpose" "text" DEFAULT 'LOGIN'::"text" NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "consumedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."VendorMagicToken" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."VendorNotificationPref" (
    "id" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "emailOptIn" boolean DEFAULT true NOT NULL,
    "whatsappOptIn" boolean DEFAULT true NOT NULL,
    "smsOptIn" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."VendorNotificationPref" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."VendorPayout" (
    "id" "text" NOT NULL,
    "vendorId" "text" NOT NULL,
    "poIds" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "grossPaise" integer NOT NULL,
    "tdsPaise" integer DEFAULT 0 NOT NULL,
    "netPaise" integer NOT NULL,
    "status" "public"."VendorPayoutStatus" DEFAULT 'SCHEDULED'::"public"."VendorPayoutStatus" NOT NULL,
    "paymentMethod" "text",
    "transactionRef" "text",
    "scheduledFor" timestamp(3) without time zone,
    "paidAt" timestamp(3) without time zone,
    "failureReason" "text",
    "createdByUserId" "text",
    "notes" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "rzpxPayoutId" "text",
    "rzpxStatus" "text",
    "rzpxFailReason" "text",
    "initiatedByUserId" "text",
    "initiatedAt" timestamp with time zone
);


ALTER TABLE "public"."VendorPayout" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."VendorTeamMember" (
    "id" "text" NOT NULL,
    "vendorId" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "displayName" "text",
    "email" "text" NOT NULL,
    "accessLevel" "public"."VendorTeamAccessLevel" DEFAULT 'FULL'::"public"."VendorTeamAccessLevel" NOT NULL,
    "status" "public"."VendorTeamStatus" DEFAULT 'INVITED'::"public"."VendorTeamStatus" NOT NULL,
    "invitedByUserId" "text",
    "invitedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "acceptedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."VendorTeamMember" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Waitlist" (
    "id" "text" NOT NULL,
    "productId" "text" NOT NULL,
    "email" "text" NOT NULL,
    "whatsapp" "text",
    "name" "text",
    "source" "text",
    "notified" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."Waitlist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Wishlist" (
    "id" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "productId" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."Wishlist" OWNER TO "postgres";


ALTER TABLE ONLY "public"."AbAssignment"
    ADD CONSTRAINT "AbAssignment_abTestId_subjectKey_key" UNIQUE ("abTestId", "subjectKey");



ALTER TABLE ONLY "public"."AbAssignment"
    ADD CONSTRAINT "AbAssignment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."AbTest"
    ADD CONSTRAINT "AbTest_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."AbTest"
    ADD CONSTRAINT "AbTest_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."AbVariant"
    ADD CONSTRAINT "AbVariant_abTestId_key_key" UNIQUE ("abTestId", "key");



ALTER TABLE ONLY "public"."AbVariant"
    ADD CONSTRAINT "AbVariant_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."AbandonedCart"
    ADD CONSTRAINT "AbandonedCart_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Address"
    ADD CONSTRAINT "Address_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."AiPhotoJob"
    ADD CONSTRAINT "AiPhotoJob_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."AiPhotoRequest"
    ADD CONSTRAINT "AiPhotoRequest_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."AiPhotoVariant"
    ADD CONSTRAINT "AiPhotoVariant_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."AiPreview"
    ADD CONSTRAINT "AiPreview_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."AnalyticsEvent"
    ADD CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Asset"
    ADD CONSTRAINT "Asset_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Attendance"
    ADD CONSTRAINT "Attendance_employeeId_month_year_key" UNIQUE ("employeeId", "month", "year");



ALTER TABLE ONLY "public"."Attendance"
    ADD CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Badge"
    ADD CONSTRAINT "Badge_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."BankAccount"
    ADD CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."BankTransaction"
    ADD CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Banner"
    ADD CONSTRAINT "Banner_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."BillPayment"
    ADD CONSTRAINT "BillPayment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Bill"
    ADD CONSTRAINT "Bill_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."CartItem"
    ADD CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Cart"
    ADD CONSTRAINT "Cart_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."CategoryRedirect"
    ADD CONSTRAINT "CategoryRedirect_fromSlug_key" UNIQUE ("fromSlug");



ALTER TABLE ONLY "public"."CategoryRedirect"
    ADD CONSTRAINT "CategoryRedirect_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Category"
    ADD CONSTRAINT "Category_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."CmsPage"
    ADD CONSTRAINT "CmsPage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."CouponRedemption"
    ADD CONSTRAINT "CouponRedemption_couponId_userId_key" UNIQUE ("couponId", "userId");



ALTER TABLE ONLY "public"."CouponRedemption"
    ADD CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Coupon"
    ADD CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Craft"
    ADD CONSTRAINT "Craft_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Craft"
    ADD CONSTRAINT "Craft_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."Customer"
    ADD CONSTRAINT "Customer_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Customer"
    ADD CONSTRAINT "Customer_primaryEmail_key" UNIQUE ("primaryEmail");



ALTER TABLE ONLY "public"."Customer"
    ADD CONSTRAINT "Customer_primaryPhone_key" UNIQUE ("primaryPhone");



ALTER TABLE ONLY "public"."Customer"
    ADD CONSTRAINT "Customer_userId_key" UNIQUE ("userId");



ALTER TABLE ONLY "public"."DisputeEvent"
    ADD CONSTRAINT "DisputeEvent_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Dispute"
    ADD CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Drop"
    ADD CONSTRAINT "Drop_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."EmailCampaign"
    ADD CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."EmployeeAdjustment"
    ADD CONSTRAINT "EmployeeAdjustment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."EmployeeSalaryAssignment"
    ADD CONSTRAINT "EmployeeSalaryAssignment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Employee"
    ADD CONSTRAINT "Employee_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."Employee"
    ADD CONSTRAINT "Employee_employeeCode_key" UNIQUE ("employeeCode");



ALTER TABLE ONLY "public"."Employee"
    ADD CONSTRAINT "Employee_pan_key" UNIQUE ("pan");



ALTER TABLE ONLY "public"."Employee"
    ADD CONSTRAINT "Employee_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Employee"
    ADD CONSTRAINT "Employee_userId_key" UNIQUE ("userId");



ALTER TABLE ONLY "public"."ExpenseCategory"
    ADD CONSTRAINT "ExpenseCategory_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."ExpenseCategory"
    ADD CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ExpensePayment"
    ADD CONSTRAINT "ExpensePayment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Expense"
    ADD CONSTRAINT "Expense_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."FinanceAiSummary"
    ADD CONSTRAINT "FinanceAiSummary_periodStart_periodEnd_key" UNIQUE ("periodStart", "periodEnd");



ALTER TABLE ONLY "public"."FinanceAiSummary"
    ADD CONSTRAINT "FinanceAiSummary_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."FinanceAnomalyAlert"
    ADD CONSTRAINT "FinanceAnomalyAlert_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."FinanceAuditLog"
    ADD CONSTRAINT "FinanceAuditLog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."FinanceReportCache"
    ADD CONSTRAINT "FinanceReportCache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."FinanceReportCache"
    ADD CONSTRAINT "FinanceReportCache_reportKey_key" UNIQUE ("reportKey");



ALTER TABLE ONLY "public"."FnFSettlement"
    ADD CONSTRAINT "FnFSettlement_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ForecastSnapshot"
    ADD CONSTRAINT "ForecastSnapshot_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."GstEInvoice"
    ADD CONSTRAINT "GstEInvoice_irn_key" UNIQUE ("irn");



ALTER TABLE ONLY "public"."GstEInvoice"
    ADD CONSTRAINT "GstEInvoice_orderId_key" UNIQUE ("orderId");



ALTER TABLE ONLY "public"."GstEInvoice"
    ADD CONSTRAINT "GstEInvoice_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."IncentivePlan"
    ADD CONSTRAINT "IncentivePlan_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."InvoiceNumberCounter"
    ADD CONSTRAINT "InvoiceNumberCounter_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."JournalDraft"
    ADD CONSTRAINT "JournalDraft_approvalToken_key" UNIQUE ("approvalToken");



ALTER TABLE ONLY "public"."JournalDraft"
    ADD CONSTRAINT "JournalDraft_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."JournalSeedLog"
    ADD CONSTRAINT "JournalSeedLog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."LegalEntity"
    ADD CONSTRAINT "LegalEntity_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."LegalEntity"
    ADD CONSTRAINT "LegalEntity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."LoyaltyLedger"
    ADD CONSTRAINT "LoyaltyLedger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."LoyaltySettings"
    ADD CONSTRAINT "LoyaltySettings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."MarketingApprovalRequest"
    ADD CONSTRAINT "MarketingApprovalRequest_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."MarketingBudget"
    ADD CONSTRAINT "MarketingBudget_cat_period_key" UNIQUE ("expenseCategoryId", "periodYear", "periodMonth");



ALTER TABLE ONLY "public"."MarketingBudget"
    ADD CONSTRAINT "MarketingBudget_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."MarketingChannelMap"
    ADD CONSTRAINT "MarketingChannelMap_couponId_key" UNIQUE ("couponId");



ALTER TABLE ONLY "public"."MarketingChannelMap"
    ADD CONSTRAINT "MarketingChannelMap_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."NotificationDispatch"
    ADD CONSTRAINT "NotificationDispatch_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."NotificationLog"
    ADD CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."NotificationTemplate"
    ADD CONSTRAINT "NotificationTemplate_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."NotificationTemplate"
    ADD CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."OrderItem"
    ADD CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Order"
    ADD CONSTRAINT "Order_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."OtpCode"
    ADD CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."OtpToken"
    ADD CONSTRAINT "OtpToken_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Payout"
    ADD CONSTRAINT "Payout_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PayrollConfig"
    ADD CONSTRAINT "PayrollConfig_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PayrollRun"
    ADD CONSTRAINT "PayrollRun_month_year_key" UNIQUE ("month", "year");



ALTER TABLE ONLY "public"."PayrollRun"
    ADD CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Payslip"
    ADD CONSTRAINT "Payslip_payrollRunId_employeeId_key" UNIQUE ("payrollRunId", "employeeId");



ALTER TABLE ONLY "public"."Payslip"
    ADD CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PeriodLock"
    ADD CONSTRAINT "PeriodLock_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PoMessage"
    ADD CONSTRAINT "PoMessage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PreorderBalance"
    ADD CONSTRAINT "PreorderBalance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PurchaseCost"
    ADD CONSTRAINT "PurchaseCost_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PurchaseOrderLine"
    ADD CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PurchaseOrder"
    ADD CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PurchaseOrder"
    ADD CONSTRAINT "PurchaseOrder_poNumber_key" UNIQUE ("poNumber");



ALTER TABLE ONLY "public"."RecoverySettings"
    ADD CONSTRAINT "RecoverySettings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."RecurringExpense"
    ADD CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Referral"
    ADD CONSTRAINT "Referral_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ReimbursementPolicy"
    ADD CONSTRAINT "ReimbursementPolicy_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ReturnEntry"
    ADD CONSTRAINT "ReturnEntry_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."RevenueEntry"
    ADD CONSTRAINT "RevenueEntry_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Review"
    ADD CONSTRAINT "Review_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SalaryStructure"
    ADD CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SalesInvoiceLine"
    ADD CONSTRAINT "SalesInvoiceLine_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SalesInvoicePayment"
    ADD CONSTRAINT "SalesInvoicePayment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SalesInvoice"
    ADD CONSTRAINT "SalesInvoice_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SellerAuditLog"
    ADD CONSTRAINT "SellerAuditLog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SellerCategoryCommission"
    ADD CONSTRAINT "SellerCategoryCommission_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SellerCategoryCommission"
    ADD CONSTRAINT "SellerCategoryCommission_unique" UNIQUE ("sellerId", "categoryId");



ALTER TABLE ONLY "public"."SellerChangeRequest"
    ADD CONSTRAINT "SellerChangeRequest_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SellerDocument"
    ADD CONSTRAINT "SellerDocument_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SellerInventorySubmission"
    ADD CONSTRAINT "SellerInventorySubmission_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SellerMagicToken"
    ADD CONSTRAINT "SellerMagicToken_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SellerOrderRelease"
    ADD CONSTRAINT "SellerOrderRelease_orderId_sellerId_key" UNIQUE ("orderId", "sellerId");



ALTER TABLE ONLY "public"."SellerOrderRelease"
    ADD CONSTRAINT "SellerOrderRelease_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SellerProductCommission"
    ADD CONSTRAINT "SellerProductCommission_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SellerProductCommission"
    ADD CONSTRAINT "SellerProductCommission_unique" UNIQUE ("sellerId", "productId");



ALTER TABLE ONLY "public"."SellerTeamMember"
    ADD CONSTRAINT "SellerTeamMember_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SellerTeamMember"
    ADD CONSTRAINT "SellerTeamMember_userId_key" UNIQUE ("userId");



ALTER TABLE ONLY "public"."Seller"
    ADD CONSTRAINT "Seller_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Seller"
    ADD CONSTRAINT "Seller_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."Seller"
    ADD CONSTRAINT "Seller_userId_key" UNIQUE ("userId");



ALTER TABLE ONLY "public"."ShippingZone"
    ADD CONSTRAINT "ShippingZone_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SmsTemplate"
    ADD CONSTRAINT "SmsTemplate_event_key" UNIQUE ("event");



ALTER TABLE ONLY "public"."SmsTemplate"
    ADD CONSTRAINT "SmsTemplate_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."TdsCertificate"
    ADD CONSTRAINT "TdsCertificate_certificateNumber_key" UNIQUE ("certificateNumber");



ALTER TABLE ONLY "public"."TdsCertificate"
    ADD CONSTRAINT "TdsCertificate_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."TdsCertificate"
    ADD CONSTRAINT "TdsCertificate_quarter_unique" UNIQUE ("vendorId", "financialYear", "quarter");



ALTER TABLE ONLY "public"."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Variant"
    ADD CONSTRAINT "Variant_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."VendorAuditLog"
    ADD CONSTRAINT "VendorAuditLog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."VendorCatalogItem"
    ADD CONSTRAINT "VendorCatalogItem_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."VendorCatalogItem"
    ADD CONSTRAINT "VendorCatalogItem_sku_unique" UNIQUE ("vendorId", "vendorSku");



ALTER TABLE ONLY "public"."VendorChangeRequest"
    ADD CONSTRAINT "VendorChangeRequest_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."VendorDocument"
    ADD CONSTRAINT "VendorDocument_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."VendorMagicToken"
    ADD CONSTRAINT "VendorMagicToken_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."VendorNotificationPref"
    ADD CONSTRAINT "VendorNotificationPref_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."VendorNotificationPref"
    ADD CONSTRAINT "VendorNotificationPref_userId_key" UNIQUE ("userId");



ALTER TABLE ONLY "public"."VendorPayout"
    ADD CONSTRAINT "VendorPayout_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."VendorTeamMember"
    ADD CONSTRAINT "VendorTeamMember_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."VendorTeamMember"
    ADD CONSTRAINT "VendorTeamMember_userId_key" UNIQUE ("userId");



ALTER TABLE ONLY "public"."Vendor"
    ADD CONSTRAINT "Vendor_contactEmail_key" UNIQUE ("contactEmail");



ALTER TABLE ONLY "public"."Vendor"
    ADD CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Vendor"
    ADD CONSTRAINT "Vendor_userId_key" UNIQUE ("userId");



ALTER TABLE ONLY "public"."Waitlist"
    ADD CONSTRAINT "Waitlist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Wishlist"
    ADD CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id");



CREATE INDEX "AbAssignment_subject_idx" ON "public"."AbAssignment" USING "btree" ("subjectKey", "subjectType");



CREATE INDEX "AbandonedCart_createdAt_idx" ON "public"."AbandonedCart" USING "btree" ("createdAt");



CREATE INDEX "AbandonedCart_email_idx" ON "public"."AbandonedCart" USING "btree" ("email");



CREATE INDEX "AbandonedCart_nextActionAt_idx" ON "public"."AbandonedCart" USING "btree" ("nextActionAt") WHERE (("recoveredOrderId" IS NULL) AND ("optedOut" = false));



CREATE INDEX "AbandonedCart_recoveredOrderId_idx" ON "public"."AbandonedCart" USING "btree" ("recoveredOrderId");



CREATE INDEX "AbandonedCart_recoveryStage_idx" ON "public"."AbandonedCart" USING "btree" ("recoveryStage", "nextActionAt");



CREATE INDEX "AbandonedCart_telecallerStatus_idx" ON "public"."AbandonedCart" USING "btree" ("telecallerStatus") WHERE ("telecallerStatus" IS NOT NULL);



CREATE INDEX "AbandonedCart_userId_idx" ON "public"."AbandonedCart" USING "btree" ("userId");



CREATE INDEX "AiPhotoJob_productId_status_idx" ON "public"."AiPhotoJob" USING "btree" ("productId", "status");



CREATE INDEX "AiPhotoJob_requestedByUserId_createdAt_idx" ON "public"."AiPhotoJob" USING "btree" ("requestedByUserId", "createdAt");



CREATE INDEX "AiPhotoJob_variantId_idx" ON "public"."AiPhotoJob" USING "btree" ("variantId");



CREATE INDEX "AiPhotoRequest_status_createdAt_idx" ON "public"."AiPhotoRequest" USING "btree" ("status", "createdAt");



CREATE INDEX "AiPhotoRequest_vendorId_status_idx" ON "public"."AiPhotoRequest" USING "btree" ("vendorId", "status");



CREATE INDEX "AiPhotoVariant_jobId_decision_idx" ON "public"."AiPhotoVariant" USING "btree" ("jobId", "decision");



CREATE INDEX "AnalyticsEvent_productId_idx" ON "public"."AnalyticsEvent" USING "btree" ("productId");



CREATE INDEX "AnalyticsEvent_sessionId_idx" ON "public"."AnalyticsEvent" USING "btree" ("sessionId");



CREATE INDEX "AnalyticsEvent_type_createdAt_idx" ON "public"."AnalyticsEvent" USING "btree" ("type", "createdAt");



CREATE INDEX "AnalyticsEvent_utmCampaign_idx" ON "public"."AnalyticsEvent" USING "btree" ("utmCampaign");



CREATE INDEX "Asset_createdAt_idx" ON "public"."Asset" USING "btree" ("createdAt");



CREATE INDEX "Asset_folder_idx" ON "public"."Asset" USING "btree" ("folder");



CREATE INDEX "Attendance_month_year_idx" ON "public"."Attendance" USING "btree" ("month", "year");



CREATE INDEX "Badge_active_sortOrder_idx" ON "public"."Badge" USING "btree" ("active", "sortOrder");



CREATE UNIQUE INDEX "Badge_key_key" ON "public"."Badge" USING "btree" ("key");



CREATE INDEX "BankAccount_active_bankName_idx" ON "public"."BankAccount" USING "btree" ("active", "bankName");



CREATE INDEX "BankTransaction_bankAccountId_txnDate_idx" ON "public"."BankTransaction" USING "btree" ("bankAccountId", "txnDate");



CREATE INDEX "BankTransaction_reference_idx" ON "public"."BankTransaction" USING "btree" ("reference");



CREATE INDEX "BankTransaction_sourceRowHash_idx" ON "public"."BankTransaction" USING "btree" ("sourceRowHash");



CREATE INDEX "BankTransaction_status_idx" ON "public"."BankTransaction" USING "btree" ("status");



CREATE INDEX "Banner_linkCategoryId_idx" ON "public"."Banner" USING "btree" ("linkCategoryId");



CREATE INDEX "Banner_linkProductId_idx" ON "public"."Banner" USING "btree" ("linkProductId");



CREATE INDEX "Banner_position_active_idx" ON "public"."Banner" USING "btree" ("position", "active");



CREATE INDEX "BillPayment_billId_idx" ON "public"."BillPayment" USING "btree" ("billId");



CREATE INDEX "BillPayment_paidOn_idx" ON "public"."BillPayment" USING "btree" ("paidOn");



CREATE UNIQUE INDEX "Bill_expenseId_key" ON "public"."Bill" USING "btree" ("expenseId") WHERE ("expenseId" IS NOT NULL);



CREATE INDEX "Bill_purchaseOrderId_idx" ON "public"."Bill" USING "btree" ("purchaseOrderId");



CREATE INDEX "Bill_status_dueOn_idx" ON "public"."Bill" USING "btree" ("status", "dueOn");



CREATE INDEX "Bill_vendorId_idx" ON "public"."Bill" USING "btree" ("vendorId");



CREATE INDEX "CategoryRedirect_fromSlug_idx" ON "public"."CategoryRedirect" USING "btree" ("fromSlug");



CREATE INDEX "Category_active_order_idx" ON "public"."Category" USING "btree" ("active", "order");



CREATE INDEX "Category_featured_idx" ON "public"."Category" USING "btree" ("featured");



CREATE INDEX "Category_hidden_idx" ON "public"."Category" USING "btree" ("hidden");



CREATE INDEX "Category_level_parentId_idx" ON "public"."Category" USING "btree" ("level", "parentId");



CREATE INDEX "Category_path_idx" ON "public"."Category" USING "btree" ("path");



CREATE UNIQUE INDEX "Category_slug_key" ON "public"."Category" USING "btree" ("slug");



CREATE INDEX "CmsPage_featured_idx" ON "public"."CmsPage" USING "btree" ("featured");



CREATE INDEX "CmsPage_pageType_status_idx" ON "public"."CmsPage" USING "btree" ("pageType", "status");



CREATE UNIQUE INDEX "CmsPage_slug_key" ON "public"."CmsPage" USING "btree" ("slug");



CREATE INDEX "CouponRedemption_userId_idx" ON "public"."CouponRedemption" USING "btree" ("userId");



CREATE UNIQUE INDEX "Coupon_code_key" ON "public"."Coupon" USING "btree" ("code");



CREATE INDEX "Coupon_userId_idx" ON "public"."Coupon" USING "btree" ("userId");



CREATE INDEX "Craft_active_order_idx" ON "public"."Craft" USING "btree" ("active", "order");



CREATE INDEX "Craft_featured_idx" ON "public"."Craft" USING "btree" ("featured");



CREATE INDEX "Customer_customerType_idx" ON "public"."Customer" USING "btree" ("customerType");



CREATE INDEX "Customer_displayName_idx" ON "public"."Customer" USING "btree" ("displayName");



CREATE INDEX "Customer_gstin_idx" ON "public"."Customer" USING "btree" ("gstin");



CREATE INDEX "Customer_status_idx" ON "public"."Customer" USING "btree" ("status");



CREATE INDEX "DisputeEvent_disputeId_createdAt_idx" ON "public"."DisputeEvent" USING "btree" ("disputeId", "createdAt");



CREATE INDEX "Dispute_createdAt_idx" ON "public"."Dispute" USING "btree" ("createdAt");



CREATE INDEX "Dispute_customerUserId_status_idx" ON "public"."Dispute" USING "btree" ("customerUserId", "status");



CREATE INDEX "Dispute_resourceType_status_idx" ON "public"."Dispute" USING "btree" ("resourceType", "status");



CREATE INDEX "Dispute_sellerId_status_idx" ON "public"."Dispute" USING "btree" ("sellerId", "status");



CREATE INDEX "Dispute_vendorId_status_idx" ON "public"."Dispute" USING "btree" ("vendorId", "status");



CREATE UNIQUE INDEX "Drop_slug_key" ON "public"."Drop" USING "btree" ("slug");



CREATE INDEX "Drop_status_startsAt_idx" ON "public"."Drop" USING "btree" ("status", "startsAt");



CREATE INDEX "EmailCampaign_sentAt_idx" ON "public"."EmailCampaign" USING "btree" ("sentAt");



CREATE INDEX "EmailCampaign_status_idx" ON "public"."EmailCampaign" USING "btree" ("status");



CREATE INDEX "EmployeeAdjustment_appliedToPayslipId_idx" ON "public"."EmployeeAdjustment" USING "btree" ("appliedToPayslipId");



CREATE INDEX "EmployeeAdjustment_employeeId_forYear_forMonth_idx" ON "public"."EmployeeAdjustment" USING "btree" ("employeeId", "forYear", "forMonth");



CREATE INDEX "EmployeeSalaryAssignment_effectiveTo_idx" ON "public"."EmployeeSalaryAssignment" USING "btree" ("effectiveTo");



CREATE INDEX "EmployeeSalaryAssignment_employeeId_effectiveFrom_idx" ON "public"."EmployeeSalaryAssignment" USING "btree" ("employeeId", "effectiveFrom");



CREATE INDEX "Employee_department_status_idx" ON "public"."Employee" USING "btree" ("department", "status");



CREATE INDEX "Employee_status_idx" ON "public"."Employee" USING "btree" ("status");



CREATE INDEX "ExpenseCategory_group_isActive_idx" ON "public"."ExpenseCategory" USING "btree" ("group", "isActive");



CREATE INDEX "ExpensePayment_expenseId_idx" ON "public"."ExpensePayment" USING "btree" ("expenseId");



CREATE INDEX "ExpensePayment_paidOn_idx" ON "public"."ExpensePayment" USING "btree" ("paidOn");



CREATE INDEX "Expense_categoryId_incurredOn_idx" ON "public"."Expense" USING "btree" ("categoryId", "incurredOn");



CREATE INDEX "Expense_incurredOn_idx" ON "public"."Expense" USING "btree" ("incurredOn");



CREATE INDEX "Expense_orderId_idx" ON "public"."Expense" USING "btree" ("orderId");



CREATE INDEX "Expense_paidOn_idx" ON "public"."Expense" USING "btree" ("paidOn");



CREATE INDEX "Expense_source_sourceRef_idx" ON "public"."Expense" USING "btree" ("source", "sourceRef");



CREATE INDEX "Expense_status_createdAt_idx" ON "public"."Expense" USING "btree" ("status", "createdAt");



CREATE INDEX "FinanceAiSummary_generatedAt_idx" ON "public"."FinanceAiSummary" USING "btree" ("generatedAt");



CREATE INDEX "FinanceAnomalyAlert_ack_createdAt_idx" ON "public"."FinanceAnomalyAlert" USING "btree" ("acknowledgedAt", "createdAt");



CREATE INDEX "FinanceAuditLog_createdAt_idx" ON "public"."FinanceAuditLog" USING "btree" ("createdAt");



CREATE INDEX "FinanceAuditLog_entityType_entityId_idx" ON "public"."FinanceAuditLog" USING "btree" ("entityType", "entityId");



CREATE INDEX "FinanceAuditLog_userId_createdAt_idx" ON "public"."FinanceAuditLog" USING "btree" ("userId", "createdAt");



CREATE INDEX "FinanceReportCache_reportType_periodStart_idx" ON "public"."FinanceReportCache" USING "btree" ("reportType", "periodStart");



CREATE INDEX "FnFSettlement_employeeId_idx" ON "public"."FnFSettlement" USING "btree" ("employeeId");



CREATE INDEX "FnFSettlement_status_idx" ON "public"."FnFSettlement" USING "btree" ("status");



CREATE INDEX "ForecastSnapshot_scope_expiresAt_idx" ON "public"."ForecastSnapshot" USING "btree" ("scope", "expiresAt");



CREATE UNIQUE INDEX "ForecastSnapshot_scope_productId_categoryId_key" ON "public"."ForecastSnapshot" USING "btree" ("scope", COALESCE("productId", ''::"text"), COALESCE("categoryId", ''::"text"));



CREATE INDEX "GstEInvoice_createdAt_idx" ON "public"."GstEInvoice" USING "btree" ("createdAt");



CREATE INDEX "GstEInvoice_status_idx" ON "public"."GstEInvoice" USING "btree" ("status");



CREATE UNIQUE INDEX "IncentivePlan_employeeId_key" ON "public"."IncentivePlan" USING "btree" ("employeeId");



CREATE UNIQUE INDEX "InvoiceNumberCounter_prefix_yearMonth_key" ON "public"."InvoiceNumberCounter" USING "btree" ("prefix", "yearMonth");



CREATE INDEX "JournalDraft_createdAt_idx" ON "public"."JournalDraft" USING "btree" ("createdAt" DESC);



CREATE INDEX "JournalDraft_status_idx" ON "public"."JournalDraft" USING "btree" ("status");



CREATE INDEX "JournalSeedLog_usedAt_idx" ON "public"."JournalSeedLog" USING "btree" ("usedAt" DESC);



CREATE INDEX "LoyaltyLedger_expiresAt_idx" ON "public"."LoyaltyLedger" USING "btree" ("expiresAt");



CREATE INDEX "LoyaltyLedger_orderId_idx" ON "public"."LoyaltyLedger" USING "btree" ("orderId");



CREATE INDEX "LoyaltyLedger_userId_createdAt_idx" ON "public"."LoyaltyLedger" USING "btree" ("userId", "createdAt");



CREATE INDEX "MarketingApprovalRequest_resource_idx" ON "public"."MarketingApprovalRequest" USING "btree" ("resourceType", "resourceId");



CREATE INDEX "MarketingApprovalRequest_status_createdAt_idx" ON "public"."MarketingApprovalRequest" USING "btree" ("status", "createdAt");



CREATE INDEX "MarketingBudget_period_idx" ON "public"."MarketingBudget" USING "btree" ("periodYear", "periodMonth");



CREATE INDEX "NotificationDispatch_cartId_idx" ON "public"."NotificationDispatch" USING "btree" ("cartId");



CREATE INDEX "NotificationDispatch_channel_event_idx" ON "public"."NotificationDispatch" USING "btree" ("channel", "event");



CREATE INDEX "NotificationDispatch_orderId_idx" ON "public"."NotificationDispatch" USING "btree" ("orderId");



CREATE INDEX "NotificationDispatch_providerReqId_idx" ON "public"."NotificationDispatch" USING "btree" ("providerRequestId") WHERE ("providerRequestId" IS NOT NULL);



CREATE INDEX "NotificationDispatch_status_idx" ON "public"."NotificationDispatch" USING "btree" ("status", "nextRetryAt");



CREATE INDEX "NotificationDispatch_userId_idx" ON "public"."NotificationDispatch" USING "btree" ("userId");



CREATE INDEX "NotificationLog_contextType_contextId_idx" ON "public"."NotificationLog" USING "btree" ("contextType", "contextId");



CREATE INDEX "NotificationLog_event_createdAt_idx" ON "public"."NotificationLog" USING "btree" ("event", "createdAt");



CREATE INDEX "NotificationLog_status_createdAt_idx" ON "public"."NotificationLog" USING "btree" ("status", "createdAt");



CREATE INDEX "NotificationLog_userId_createdAt_idx" ON "public"."NotificationLog" USING "btree" ("userId", "createdAt");



CREATE INDEX "Order_createdAt_idx" ON "public"."Order" USING "btree" ("createdAt");



CREATE UNIQUE INDEX "Order_orderNumber_key" ON "public"."Order" USING "btree" ("orderNumber");



CREATE INDEX "Order_postPurchaseSentAt_idx" ON "public"."Order" USING "btree" ("postPurchaseSentAt");



CREATE INDEX "Order_status_idx" ON "public"."Order" USING "btree" ("status");



CREATE INDEX "Order_userId_idx" ON "public"."Order" USING "btree" ("userId");



CREATE INDEX "Order_utmCampaign_idx" ON "public"."Order" USING "btree" ("utmCampaign");



CREATE INDEX "OtpCode_expiresAt_idx" ON "public"."OtpCode" USING "btree" ("expiresAt");



CREATE INDEX "OtpCode_phone_purpose_consumedAt_idx" ON "public"."OtpCode" USING "btree" ("phone", "purpose", "consumedAt");



CREATE INDEX "OtpToken_expiresAt_idx" ON "public"."OtpToken" USING "btree" ("expiresAt");



CREATE INDEX "OtpToken_phone_createdAt_idx" ON "public"."OtpToken" USING "btree" ("phone", "createdAt");



CREATE INDEX "Payout_rzpxPayoutId_idx" ON "public"."Payout" USING "btree" ("rzpxPayoutId");



CREATE INDEX "Payout_sellerId_status_idx" ON "public"."Payout" USING "btree" ("sellerId", "status");



CREATE INDEX "PayrollRun_status_year_month_idx" ON "public"."PayrollRun" USING "btree" ("status", "year", "month");



CREATE INDEX "Payslip_employeeId_payrollRunId_idx" ON "public"."Payslip" USING "btree" ("employeeId", "payrollRunId");



CREATE UNIQUE INDEX "PeriodLock_monthBucket_key" ON "public"."PeriodLock" USING "btree" ("monthBucket");



CREATE INDEX "PoMessage_purchaseOrderId_createdAt_idx" ON "public"."PoMessage" USING "btree" ("purchaseOrderId", "createdAt");



CREATE INDEX "PreorderBalance_productId_status_idx" ON "public"."PreorderBalance" USING "btree" ("productId", "status");



CREATE INDEX "PreorderBalance_userId_status_idx" ON "public"."PreorderBalance" USING "btree" ("userId", "status");



CREATE INDEX "Product_categoryId_idx" ON "public"."Product" USING "btree" ("categoryId");



CREATE INDEX "Product_ownershipModel_idx" ON "public"."Product" USING "btree" ("ownershipModel");



CREATE INDEX "Product_saleEndsAt_idx" ON "public"."Product" USING "btree" ("saleEndsAt");



CREATE INDEX "Product_sellerId_idx" ON "public"."Product" USING "btree" ("sellerId");



CREATE UNIQUE INDEX "Product_sku_key" ON "public"."Product" USING "btree" ("sku");



CREATE UNIQUE INDEX "Product_slug_key" ON "public"."Product" USING "btree" ("slug");



CREATE INDEX "Product_status_idx" ON "public"."Product" USING "btree" ("status");



CREATE INDEX "Product_takedownAt_idx" ON "public"."Product" USING "btree" ("takedownAt");



CREATE INDEX "PurchaseCost_productId_receivedAt_idx" ON "public"."PurchaseCost" USING "btree" ("productId", "receivedAt");



CREATE INDEX "PurchaseCost_purchaseOrderId_idx" ON "public"."PurchaseCost" USING "btree" ("purchaseOrderId");



CREATE INDEX "PurchaseCost_vendorId_receivedAt_idx" ON "public"."PurchaseCost" USING "btree" ("vendorId", "receivedAt");



CREATE INDEX "PurchaseOrderLine_productId_idx" ON "public"."PurchaseOrderLine" USING "btree" ("productId");



CREATE INDEX "PurchaseOrderLine_purchaseOrderId_idx" ON "public"."PurchaseOrderLine" USING "btree" ("purchaseOrderId");



CREATE INDEX "PurchaseOrder_status_createdAt_idx" ON "public"."PurchaseOrder" USING "btree" ("status", "createdAt");



CREATE INDEX "PurchaseOrder_vendorId_status_idx" ON "public"."PurchaseOrder" USING "btree" ("vendorId", "status");



CREATE INDEX "RecurringExpense_active_nextRunDate_idx" ON "public"."RecurringExpense" USING "btree" ("active", "nextRunDate");



CREATE INDEX "Referral_code_idx" ON "public"."Referral" USING "btree" ("code");



CREATE INDEX "Referral_refereeId_idx" ON "public"."Referral" USING "btree" ("refereeId");



CREATE INDEX "Referral_referrerId_idx" ON "public"."Referral" USING "btree" ("referrerId");



CREATE UNIQUE INDEX "ReimbursementPolicy_employeeId_key" ON "public"."ReimbursementPolicy" USING "btree" ("employeeId");



CREATE INDEX "ReturnEntry_orderId_idx" ON "public"."ReturnEntry" USING "btree" ("orderId");



CREATE INDEX "ReturnEntry_returnedOn_idx" ON "public"."ReturnEntry" USING "btree" ("returnedOn");



CREATE INDEX "RevenueEntry_channel_monthBucket_idx" ON "public"."RevenueEntry" USING "btree" ("channel", "monthBucket");



CREATE INDEX "RevenueEntry_customerUserId_idx" ON "public"."RevenueEntry" USING "btree" ("customerUserId");



CREATE INDEX "RevenueEntry_invoiceId_idx" ON "public"."RevenueEntry" USING "btree" ("invoiceId");



CREATE INDEX "RevenueEntry_orderId_idx" ON "public"."RevenueEntry" USING "btree" ("orderId");



CREATE INDEX "RevenueEntry_saleType_monthBucket_idx" ON "public"."RevenueEntry" USING "btree" ("saleType", "monthBucket");



CREATE INDEX "RevenueEntry_sellerId_monthBucket_idx" ON "public"."RevenueEntry" USING "btree" ("sellerId", "monthBucket");



CREATE UNIQUE INDEX "RevenueEntry_sourceHash_key" ON "public"."RevenueEntry" USING "btree" ("sourceHash");



CREATE INDEX "RevenueEntry_status_txnDate_idx" ON "public"."RevenueEntry" USING "btree" ("status", "txnDate");



CREATE INDEX "RevenueEntry_type_monthBucket_idx" ON "public"."RevenueEntry" USING "btree" ("type", "monthBucket");



CREATE INDEX "SalaryStructure_active_idx" ON "public"."SalaryStructure" USING "btree" ("active");



CREATE INDEX "SalesInvoiceLine_invoiceId_idx" ON "public"."SalesInvoiceLine" USING "btree" ("invoiceId");



CREATE INDEX "SalesInvoiceLine_productId_idx" ON "public"."SalesInvoiceLine" USING "btree" ("productId");



CREATE INDEX "SalesInvoiceLine_sellerId_idx" ON "public"."SalesInvoiceLine" USING "btree" ("sellerId");



CREATE INDEX "SalesInvoicePayment_invoiceId_idx" ON "public"."SalesInvoicePayment" USING "btree" ("invoiceId");



CREATE INDEX "SalesInvoicePayment_paidOn_idx" ON "public"."SalesInvoicePayment" USING "btree" ("paidOn");



CREATE INDEX "SalesInvoice_customerId_idx" ON "public"."SalesInvoice" USING "btree" ("customerId");



CREATE INDEX "SalesInvoice_customer_idx" ON "public"."SalesInvoice" USING "btree" ("customerUserId");



CREATE UNIQUE INDEX "SalesInvoice_invoiceNumber_key" ON "public"."SalesInvoice" USING "btree" ("invoiceNumber");



CREATE INDEX "SalesInvoice_invoiceType_idx" ON "public"."SalesInvoice" USING "btree" ("invoiceType", "issuedOn");



CREATE UNIQUE INDEX "SalesInvoice_orderId_key" ON "public"."SalesInvoice" USING "btree" ("orderId");



CREATE INDEX "SalesInvoice_paymentStatus_idx" ON "public"."SalesInvoice" USING "btree" ("paymentStatus", "dueOn");



CREATE INDEX "SalesInvoice_sellerId_idx" ON "public"."SalesInvoice" USING "btree" ("sellerId");



CREATE INDEX "SellerAuditLog_sellerId_createdAt_idx" ON "public"."SellerAuditLog" USING "btree" ("sellerId", "createdAt");



CREATE INDEX "SellerChangeRequest_sellerId_status_idx" ON "public"."SellerChangeRequest" USING "btree" ("sellerId", "status");



CREATE INDEX "SellerDocument_sellerId_docType_idx" ON "public"."SellerDocument" USING "btree" ("sellerId", "docType");



CREATE INDEX "SellerDocument_status_idx" ON "public"."SellerDocument" USING "btree" ("status");



CREATE INDEX "SellerInventorySubmission_sellerId_status_idx" ON "public"."SellerInventorySubmission" USING "btree" ("sellerId", "status");



CREATE INDEX "SellerInventorySubmission_status_createdAt_idx" ON "public"."SellerInventorySubmission" USING "btree" ("status", "createdAt");



CREATE INDEX "SellerMagicToken_sellerId_createdAt_idx" ON "public"."SellerMagicToken" USING "btree" ("sellerId", "createdAt");



CREATE INDEX "SellerOrderRelease_sellerId_releasedAt_idx" ON "public"."SellerOrderRelease" USING "btree" ("sellerId", "releasedAt");



CREATE INDEX "SellerTeamMember_email_idx" ON "public"."SellerTeamMember" USING "btree" ("email");



CREATE INDEX "SellerTeamMember_sellerId_idx" ON "public"."SellerTeamMember" USING "btree" ("sellerId");



CREATE UNIQUE INDEX "Seller_email_key" ON "public"."Seller" USING "btree" ("email");



CREATE INDEX "ShippingZone_active_priority_idx" ON "public"."ShippingZone" USING "btree" ("active", "priority" DESC);



CREATE INDEX "ShippingZone_isDefault_idx" ON "public"."ShippingZone" USING "btree" ("isDefault");



CREATE INDEX "SmsTemplate_event_active_idx" ON "public"."SmsTemplate" USING "btree" ("event", "active");



CREATE INDEX "TdsCertificate_fy_q_idx" ON "public"."TdsCertificate" USING "btree" ("financialYear", "quarter");



CREATE UNIQUE INDEX "User_email_key" ON "public"."User" USING "btree" ("email");



CREATE INDEX "User_lastWinBackAt_idx" ON "public"."User" USING "btree" ("lastWinBackAt");



CREATE INDEX "User_loyaltyTier_idx" ON "public"."User" USING "btree" ("loyaltyTier");



CREATE INDEX "User_phoneVerified_idx" ON "public"."User" USING "btree" ("phoneVerified");



CREATE INDEX "User_phone_idx" ON "public"."User" USING "btree" ("phone") WHERE ("phone" IS NOT NULL);



CREATE UNIQUE INDEX "User_phone_key" ON "public"."User" USING "btree" ("phone");



CREATE UNIQUE INDEX "User_referralCode_key" ON "public"."User" USING "btree" ("referralCode") WHERE ("referralCode" IS NOT NULL);



CREATE UNIQUE INDEX "Variant_sku_key" ON "public"."Variant" USING "btree" ("sku");



CREATE INDEX "VendorAuditLog_action_createdAt_idx" ON "public"."VendorAuditLog" USING "btree" ("action", "createdAt");



CREATE INDEX "VendorAuditLog_vendorId_createdAt_idx" ON "public"."VendorAuditLog" USING "btree" ("vendorId", "createdAt");



CREATE INDEX "VendorCatalogItem_product_idx" ON "public"."VendorCatalogItem" USING "btree" ("productId");



CREATE INDEX "VendorCatalogItem_vendor_active_idx" ON "public"."VendorCatalogItem" USING "btree" ("vendorId", "active");



CREATE INDEX "VendorChangeRequest_status_createdAt_idx" ON "public"."VendorChangeRequest" USING "btree" ("status", "createdAt");



CREATE INDEX "VendorChangeRequest_vendorId_status_idx" ON "public"."VendorChangeRequest" USING "btree" ("vendorId", "status");



CREATE INDEX "VendorDocument_changeRequestId_idx" ON "public"."VendorDocument" USING "btree" ("changeRequestId");



CREATE INDEX "VendorDocument_status_idx" ON "public"."VendorDocument" USING "btree" ("status");



CREATE INDEX "VendorDocument_vendorId_docType_idx" ON "public"."VendorDocument" USING "btree" ("vendorId", "docType");



CREATE INDEX "VendorMagicToken_expiresAt_idx" ON "public"."VendorMagicToken" USING "btree" ("expiresAt");



CREATE INDEX "VendorMagicToken_vendorId_createdAt_idx" ON "public"."VendorMagicToken" USING "btree" ("vendorId", "createdAt");



CREATE INDEX "VendorPayout_rzpxPayoutId_idx" ON "public"."VendorPayout" USING "btree" ("rzpxPayoutId");



CREATE INDEX "VendorPayout_status_scheduledFor_idx" ON "public"."VendorPayout" USING "btree" ("status", "scheduledFor");



CREATE INDEX "VendorPayout_vendorId_status_idx" ON "public"."VendorPayout" USING "btree" ("vendorId", "status");



CREATE INDEX "VendorTeamMember_email_idx" ON "public"."VendorTeamMember" USING "btree" ("email");



CREATE INDEX "VendorTeamMember_vendorId_idx" ON "public"."VendorTeamMember" USING "btree" ("vendorId");



CREATE INDEX "Vendor_contactEmail_idx" ON "public"."Vendor" USING "btree" ("contactEmail");



CREATE INDEX "Vendor_status_idx" ON "public"."Vendor" USING "btree" ("status");



CREATE INDEX "Waitlist_productId_createdAt_idx" ON "public"."Waitlist" USING "btree" ("productId", "createdAt");



CREATE UNIQUE INDEX "Waitlist_productId_email_key" ON "public"."Waitlist" USING "btree" ("productId", "email");



CREATE UNIQUE INDEX "Wishlist_userId_productId_key" ON "public"."Wishlist" USING "btree" ("userId", "productId");



CREATE OR REPLACE TRIGGER "customer_updated_at_trigger" BEFORE UPDATE ON "public"."Customer" FOR EACH ROW EXECUTE FUNCTION "public"."update_customer_updated_at"();



ALTER TABLE ONLY "public"."AbAssignment"
    ADD CONSTRAINT "AbAssignment_abTestId_fkey" FOREIGN KEY ("abTestId") REFERENCES "public"."AbTest"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."AbAssignment"
    ADD CONSTRAINT "AbAssignment_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."AbVariant"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."AbVariant"
    ADD CONSTRAINT "AbVariant_abTestId_fkey" FOREIGN KEY ("abTestId") REFERENCES "public"."AbTest"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Address"
    ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."AiPhotoJob"
    ADD CONSTRAINT "AiPhotoJob_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."AiPhotoJob"
    ADD CONSTRAINT "AiPhotoJob_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."Variant"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."AiPhotoRequest"
    ADD CONSTRAINT "AiPhotoRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."AiPhotoRequest"
    ADD CONSTRAINT "AiPhotoRequest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Vendor"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."AiPhotoVariant"
    ADD CONSTRAINT "AiPhotoVariant_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."AiPhotoJob"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."AiPreview"
    ADD CONSTRAINT "AiPreview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Attendance"
    ADD CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BankTransaction"
    ADD CONSTRAINT "BankTransaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "public"."BankAccount"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BillPayment"
    ADD CONSTRAINT "BillPayment_bill_fkey" FOREIGN KEY ("billId") REFERENCES "public"."Bill"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Bill"
    ADD CONSTRAINT "Bill_category_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."ExpenseCategory"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."CartItem"
    ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "public"."Cart"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."CartItem"
    ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."CartItem"
    ADD CONSTRAINT "CartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."Variant"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Category"
    ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."Category"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."CouponRedemption"
    ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "public"."Coupon"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Customer"
    ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."DisputeEvent"
    ADD CONSTRAINT "DisputeEvent_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "public"."Dispute"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Dispute"
    ADD CONSTRAINT "Dispute_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Dispute"
    ADD CONSTRAINT "Dispute_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "public"."PurchaseOrder"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."EmployeeAdjustment"
    ADD CONSTRAINT "EmployeeAdjustment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."EmployeeSalaryAssignment"
    ADD CONSTRAINT "EmployeeSalaryAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."EmployeeSalaryAssignment"
    ADD CONSTRAINT "EmployeeSalaryAssignment_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "public"."SalaryStructure"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ExpenseCategory"
    ADD CONSTRAINT "ExpenseCategory_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "public"."ExpenseCategory"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ExpensePayment"
    ADD CONSTRAINT "ExpensePayment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "public"."Expense"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Expense"
    ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."ExpenseCategory"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."FnFSettlement"
    ADD CONSTRAINT "FnFSettlement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."IncentivePlan"
    ADD CONSTRAINT "IncentivePlan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."LoyaltyLedger"
    ADD CONSTRAINT "LoyaltyLedger_awardedById_fkey" FOREIGN KEY ("awardedById") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."LoyaltyLedger"
    ADD CONSTRAINT "LoyaltyLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."NotificationLog"
    ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."OrderItem"
    ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."OrderItem"
    ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."OrderItem"
    ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."Variant"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Order"
    ADD CONSTRAINT "Order_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "public"."Address"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Order"
    ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Payout"
    ADD CONSTRAINT "Payout_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "public"."Seller"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Payslip"
    ADD CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."Payslip"
    ADD CONSTRAINT "Payslip_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "public"."PayrollRun"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PoMessage"
    ADD CONSTRAINT "PoMessage_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "public"."PurchaseOrder"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Product"
    ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."Product"
    ADD CONSTRAINT "Product_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "public"."Seller"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."PurchaseCost"
    ADD CONSTRAINT "PurchaseCost_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "public"."PurchaseOrder"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."PurchaseCost"
    ADD CONSTRAINT "PurchaseCost_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Vendor"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."PurchaseOrderLine"
    ADD CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "public"."PurchaseOrder"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PurchaseOrder"
    ADD CONSTRAINT "PurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Vendor"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."Referral"
    ADD CONSTRAINT "Referral_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Referral"
    ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ReimbursementPolicy"
    ADD CONSTRAINT "ReimbursementPolicy_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Review"
    ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."Review"
    ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."SalesInvoiceLine"
    ADD CONSTRAINT "SalesInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."SalesInvoice"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."SalesInvoicePayment"
    ADD CONSTRAINT "SalesInvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."SalesInvoice"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."SellerAuditLog"
    ADD CONSTRAINT "SellerAuditLog_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "public"."Seller"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."SellerChangeRequest"
    ADD CONSTRAINT "SellerChangeRequest_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "public"."Seller"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."SellerDocument"
    ADD CONSTRAINT "SellerDocument_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "public"."SellerChangeRequest"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."SellerDocument"
    ADD CONSTRAINT "SellerDocument_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "public"."Seller"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."SellerInventorySubmission"
    ADD CONSTRAINT "SellerInventorySubmission_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."SellerInventorySubmission"
    ADD CONSTRAINT "SellerInventorySubmission_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "public"."Seller"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."SellerMagicToken"
    ADD CONSTRAINT "SellerMagicToken_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "public"."Seller"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."SellerTeamMember"
    ADD CONSTRAINT "SellerTeamMember_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "public"."Seller"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."SellerTeamMember"
    ADD CONSTRAINT "SellerTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Seller"
    ADD CONSTRAINT "Seller_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."TdsCertificate"
    ADD CONSTRAINT "TdsCertificate_vendor_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Vendor"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."Variant"
    ADD CONSTRAINT "Variant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."VendorAuditLog"
    ADD CONSTRAINT "VendorAuditLog_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Vendor"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."VendorCatalogItem"
    ADD CONSTRAINT "VendorCatalogItem_product_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."VendorCatalogItem"
    ADD CONSTRAINT "VendorCatalogItem_vendor_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Vendor"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."VendorChangeRequest"
    ADD CONSTRAINT "VendorChangeRequest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Vendor"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."VendorDocument"
    ADD CONSTRAINT "VendorDocument_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "public"."VendorChangeRequest"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."VendorDocument"
    ADD CONSTRAINT "VendorDocument_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Vendor"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."VendorMagicToken"
    ADD CONSTRAINT "VendorMagicToken_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Vendor"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."VendorNotificationPref"
    ADD CONSTRAINT "VendorNotificationPref_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."VendorPayout"
    ADD CONSTRAINT "VendorPayout_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Vendor"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."VendorTeamMember"
    ADD CONSTRAINT "VendorTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."VendorTeamMember"
    ADD CONSTRAINT "VendorTeamMember_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Vendor"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Vendor"
    ADD CONSTRAINT "Vendor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Wishlist"
    ADD CONSTRAINT "Wishlist_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."Wishlist"
    ADD CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE "public"."AbAssignment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."AbTest" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."AbVariant" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."AbandonedCart" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Address" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."AiPhotoJob" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."AiPhotoRequest" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."AiPhotoVariant" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."AiPreview" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."AnalyticsEvent" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Asset" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Attendance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Badge" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."BankAccount" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."BankTransaction" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Banner" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Bill" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."BillPayment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Cart" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."CartItem" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Category" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."CategoryRedirect" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Category_backup_20260621" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."CmsPage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Coupon" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."CouponRedemption" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Craft" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Customer" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Dispute" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."DisputeEvent" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Drop" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."EmailCampaign" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Employee" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."EmployeeAdjustment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."EmployeeSalaryAssignment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Expense" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ExpenseCategory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ExpensePayment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."FinanceAiSummary" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."FinanceAnomalyAlert" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."FinanceAuditLog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."FinanceReportCache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."FnFSettlement" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ForecastSnapshot" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."GstEInvoice" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."IncentivePlan" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."InvoiceNumberCounter" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."JournalDraft" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."JournalSeedLog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."LegalEntity" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."LoyaltyLedger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."LoyaltySettings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."MarketingApprovalRequest" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."MarketingBudget" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."MarketingChannelMap" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."NotificationDispatch" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."NotificationLog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."NotificationTemplate" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Order" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."OrderItem" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."OtpCode" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."OtpToken" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Payout" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."PayrollConfig" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."PayrollRun" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Payslip" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."PeriodLock" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."PoMessage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."PreorderBalance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Product" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Product_backup_20260621" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."PurchaseCost" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."PurchaseOrder" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."PurchaseOrderLine" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."RecoverySettings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."RecurringExpense" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Referral" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ReimbursementPolicy" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ReturnEntry" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."RevenueEntry" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Review" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."SalaryStructure" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."SalesInvoice" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."SalesInvoiceLine" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."SalesInvoicePayment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Seller" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."SellerAuditLog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."SellerCategoryCommission" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."SellerChangeRequest" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."SellerDocument" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."SellerInventorySubmission" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."SellerMagicToken" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."SellerOrderRelease" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."SellerProductCommission" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."SellerTeamMember" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ShippingZone" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."SmsTemplate" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."TdsCertificate" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Variant" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Vendor" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."VendorAuditLog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."VendorCatalogItem" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."VendorChangeRequest" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."VendorDocument" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."VendorMagicToken" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."VendorNotificationPref" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."VendorPayout" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."VendorTeamMember" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Waitlist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Wishlist" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_customer_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_customer_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_customer_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."AbAssignment" TO "anon";
GRANT ALL ON TABLE "public"."AbAssignment" TO "authenticated";
GRANT ALL ON TABLE "public"."AbAssignment" TO "service_role";



GRANT ALL ON TABLE "public"."AbTest" TO "anon";
GRANT ALL ON TABLE "public"."AbTest" TO "authenticated";
GRANT ALL ON TABLE "public"."AbTest" TO "service_role";



GRANT ALL ON TABLE "public"."AbVariant" TO "anon";
GRANT ALL ON TABLE "public"."AbVariant" TO "authenticated";
GRANT ALL ON TABLE "public"."AbVariant" TO "service_role";



GRANT ALL ON TABLE "public"."AbandonedCart" TO "anon";
GRANT ALL ON TABLE "public"."AbandonedCart" TO "authenticated";
GRANT ALL ON TABLE "public"."AbandonedCart" TO "service_role";



GRANT ALL ON TABLE "public"."Address" TO "anon";
GRANT ALL ON TABLE "public"."Address" TO "authenticated";
GRANT ALL ON TABLE "public"."Address" TO "service_role";



GRANT ALL ON TABLE "public"."AiPhotoJob" TO "anon";
GRANT ALL ON TABLE "public"."AiPhotoJob" TO "authenticated";
GRANT ALL ON TABLE "public"."AiPhotoJob" TO "service_role";



GRANT ALL ON TABLE "public"."AiPhotoRequest" TO "anon";
GRANT ALL ON TABLE "public"."AiPhotoRequest" TO "authenticated";
GRANT ALL ON TABLE "public"."AiPhotoRequest" TO "service_role";



GRANT ALL ON TABLE "public"."AiPhotoVariant" TO "anon";
GRANT ALL ON TABLE "public"."AiPhotoVariant" TO "authenticated";
GRANT ALL ON TABLE "public"."AiPhotoVariant" TO "service_role";



GRANT ALL ON TABLE "public"."AiPreview" TO "anon";
GRANT ALL ON TABLE "public"."AiPreview" TO "authenticated";
GRANT ALL ON TABLE "public"."AiPreview" TO "service_role";



GRANT ALL ON TABLE "public"."AnalyticsEvent" TO "anon";
GRANT ALL ON TABLE "public"."AnalyticsEvent" TO "authenticated";
GRANT ALL ON TABLE "public"."AnalyticsEvent" TO "service_role";



GRANT ALL ON TABLE "public"."Asset" TO "anon";
GRANT ALL ON TABLE "public"."Asset" TO "authenticated";
GRANT ALL ON TABLE "public"."Asset" TO "service_role";



GRANT ALL ON TABLE "public"."Attendance" TO "anon";
GRANT ALL ON TABLE "public"."Attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."Attendance" TO "service_role";



GRANT ALL ON TABLE "public"."Badge" TO "anon";
GRANT ALL ON TABLE "public"."Badge" TO "authenticated";
GRANT ALL ON TABLE "public"."Badge" TO "service_role";



GRANT ALL ON TABLE "public"."BankAccount" TO "anon";
GRANT ALL ON TABLE "public"."BankAccount" TO "authenticated";
GRANT ALL ON TABLE "public"."BankAccount" TO "service_role";



GRANT ALL ON TABLE "public"."BankTransaction" TO "anon";
GRANT ALL ON TABLE "public"."BankTransaction" TO "authenticated";
GRANT ALL ON TABLE "public"."BankTransaction" TO "service_role";



GRANT ALL ON TABLE "public"."Banner" TO "anon";
GRANT ALL ON TABLE "public"."Banner" TO "authenticated";
GRANT ALL ON TABLE "public"."Banner" TO "service_role";



GRANT ALL ON TABLE "public"."Bill" TO "anon";
GRANT ALL ON TABLE "public"."Bill" TO "authenticated";
GRANT ALL ON TABLE "public"."Bill" TO "service_role";



GRANT ALL ON TABLE "public"."BillPayment" TO "anon";
GRANT ALL ON TABLE "public"."BillPayment" TO "authenticated";
GRANT ALL ON TABLE "public"."BillPayment" TO "service_role";



GRANT ALL ON TABLE "public"."Cart" TO "anon";
GRANT ALL ON TABLE "public"."Cart" TO "authenticated";
GRANT ALL ON TABLE "public"."Cart" TO "service_role";



GRANT ALL ON TABLE "public"."CartItem" TO "anon";
GRANT ALL ON TABLE "public"."CartItem" TO "authenticated";
GRANT ALL ON TABLE "public"."CartItem" TO "service_role";



GRANT ALL ON TABLE "public"."Category" TO "anon";
GRANT ALL ON TABLE "public"."Category" TO "authenticated";
GRANT ALL ON TABLE "public"."Category" TO "service_role";



GRANT ALL ON TABLE "public"."CategoryRedirect" TO "anon";
GRANT ALL ON TABLE "public"."CategoryRedirect" TO "authenticated";
GRANT ALL ON TABLE "public"."CategoryRedirect" TO "service_role";



GRANT ALL ON TABLE "public"."Category_backup_20260621" TO "anon";
GRANT ALL ON TABLE "public"."Category_backup_20260621" TO "authenticated";
GRANT ALL ON TABLE "public"."Category_backup_20260621" TO "service_role";



GRANT ALL ON TABLE "public"."CmsPage" TO "anon";
GRANT ALL ON TABLE "public"."CmsPage" TO "authenticated";
GRANT ALL ON TABLE "public"."CmsPage" TO "service_role";



GRANT ALL ON TABLE "public"."Coupon" TO "anon";
GRANT ALL ON TABLE "public"."Coupon" TO "authenticated";
GRANT ALL ON TABLE "public"."Coupon" TO "service_role";



GRANT ALL ON TABLE "public"."CouponRedemption" TO "anon";
GRANT ALL ON TABLE "public"."CouponRedemption" TO "authenticated";
GRANT ALL ON TABLE "public"."CouponRedemption" TO "service_role";



GRANT ALL ON TABLE "public"."Craft" TO "anon";
GRANT ALL ON TABLE "public"."Craft" TO "authenticated";
GRANT ALL ON TABLE "public"."Craft" TO "service_role";



GRANT ALL ON TABLE "public"."Customer" TO "anon";
GRANT ALL ON TABLE "public"."Customer" TO "authenticated";
GRANT ALL ON TABLE "public"."Customer" TO "service_role";



GRANT ALL ON TABLE "public"."Dispute" TO "anon";
GRANT ALL ON TABLE "public"."Dispute" TO "authenticated";
GRANT ALL ON TABLE "public"."Dispute" TO "service_role";



GRANT ALL ON TABLE "public"."DisputeEvent" TO "anon";
GRANT ALL ON TABLE "public"."DisputeEvent" TO "authenticated";
GRANT ALL ON TABLE "public"."DisputeEvent" TO "service_role";



GRANT ALL ON TABLE "public"."Drop" TO "anon";
GRANT ALL ON TABLE "public"."Drop" TO "authenticated";
GRANT ALL ON TABLE "public"."Drop" TO "service_role";



GRANT ALL ON TABLE "public"."EmailCampaign" TO "anon";
GRANT ALL ON TABLE "public"."EmailCampaign" TO "authenticated";
GRANT ALL ON TABLE "public"."EmailCampaign" TO "service_role";



GRANT ALL ON TABLE "public"."Employee" TO "anon";
GRANT ALL ON TABLE "public"."Employee" TO "authenticated";
GRANT ALL ON TABLE "public"."Employee" TO "service_role";



GRANT ALL ON TABLE "public"."EmployeeAdjustment" TO "anon";
GRANT ALL ON TABLE "public"."EmployeeAdjustment" TO "authenticated";
GRANT ALL ON TABLE "public"."EmployeeAdjustment" TO "service_role";



GRANT ALL ON TABLE "public"."EmployeeSalaryAssignment" TO "anon";
GRANT ALL ON TABLE "public"."EmployeeSalaryAssignment" TO "authenticated";
GRANT ALL ON TABLE "public"."EmployeeSalaryAssignment" TO "service_role";



GRANT ALL ON TABLE "public"."Expense" TO "anon";
GRANT ALL ON TABLE "public"."Expense" TO "authenticated";
GRANT ALL ON TABLE "public"."Expense" TO "service_role";



GRANT ALL ON TABLE "public"."ExpenseCategory" TO "anon";
GRANT ALL ON TABLE "public"."ExpenseCategory" TO "authenticated";
GRANT ALL ON TABLE "public"."ExpenseCategory" TO "service_role";



GRANT ALL ON TABLE "public"."ExpensePayment" TO "anon";
GRANT ALL ON TABLE "public"."ExpensePayment" TO "authenticated";
GRANT ALL ON TABLE "public"."ExpensePayment" TO "service_role";



GRANT ALL ON TABLE "public"."FinanceAiSummary" TO "anon";
GRANT ALL ON TABLE "public"."FinanceAiSummary" TO "authenticated";
GRANT ALL ON TABLE "public"."FinanceAiSummary" TO "service_role";



GRANT ALL ON TABLE "public"."FinanceAnomalyAlert" TO "anon";
GRANT ALL ON TABLE "public"."FinanceAnomalyAlert" TO "authenticated";
GRANT ALL ON TABLE "public"."FinanceAnomalyAlert" TO "service_role";



GRANT ALL ON TABLE "public"."FinanceAuditLog" TO "anon";
GRANT ALL ON TABLE "public"."FinanceAuditLog" TO "authenticated";
GRANT ALL ON TABLE "public"."FinanceAuditLog" TO "service_role";



GRANT ALL ON TABLE "public"."FinanceReportCache" TO "anon";
GRANT ALL ON TABLE "public"."FinanceReportCache" TO "authenticated";
GRANT ALL ON TABLE "public"."FinanceReportCache" TO "service_role";



GRANT ALL ON TABLE "public"."FnFSettlement" TO "anon";
GRANT ALL ON TABLE "public"."FnFSettlement" TO "authenticated";
GRANT ALL ON TABLE "public"."FnFSettlement" TO "service_role";



GRANT ALL ON TABLE "public"."ForecastSnapshot" TO "anon";
GRANT ALL ON TABLE "public"."ForecastSnapshot" TO "authenticated";
GRANT ALL ON TABLE "public"."ForecastSnapshot" TO "service_role";



GRANT ALL ON TABLE "public"."GstEInvoice" TO "anon";
GRANT ALL ON TABLE "public"."GstEInvoice" TO "authenticated";
GRANT ALL ON TABLE "public"."GstEInvoice" TO "service_role";



GRANT ALL ON TABLE "public"."IncentivePlan" TO "anon";
GRANT ALL ON TABLE "public"."IncentivePlan" TO "authenticated";
GRANT ALL ON TABLE "public"."IncentivePlan" TO "service_role";



GRANT ALL ON TABLE "public"."InvoiceNumberCounter" TO "anon";
GRANT ALL ON TABLE "public"."InvoiceNumberCounter" TO "authenticated";
GRANT ALL ON TABLE "public"."InvoiceNumberCounter" TO "service_role";



GRANT ALL ON TABLE "public"."JournalDraft" TO "anon";
GRANT ALL ON TABLE "public"."JournalDraft" TO "authenticated";
GRANT ALL ON TABLE "public"."JournalDraft" TO "service_role";



GRANT ALL ON TABLE "public"."JournalSeedLog" TO "anon";
GRANT ALL ON TABLE "public"."JournalSeedLog" TO "authenticated";
GRANT ALL ON TABLE "public"."JournalSeedLog" TO "service_role";



GRANT ALL ON TABLE "public"."LegalEntity" TO "anon";
GRANT ALL ON TABLE "public"."LegalEntity" TO "authenticated";
GRANT ALL ON TABLE "public"."LegalEntity" TO "service_role";



GRANT ALL ON TABLE "public"."LoyaltyLedger" TO "anon";
GRANT ALL ON TABLE "public"."LoyaltyLedger" TO "authenticated";
GRANT ALL ON TABLE "public"."LoyaltyLedger" TO "service_role";



GRANT ALL ON TABLE "public"."LoyaltySettings" TO "anon";
GRANT ALL ON TABLE "public"."LoyaltySettings" TO "authenticated";
GRANT ALL ON TABLE "public"."LoyaltySettings" TO "service_role";



GRANT ALL ON TABLE "public"."MarketingApprovalRequest" TO "anon";
GRANT ALL ON TABLE "public"."MarketingApprovalRequest" TO "authenticated";
GRANT ALL ON TABLE "public"."MarketingApprovalRequest" TO "service_role";



GRANT ALL ON TABLE "public"."MarketingBudget" TO "anon";
GRANT ALL ON TABLE "public"."MarketingBudget" TO "authenticated";
GRANT ALL ON TABLE "public"."MarketingBudget" TO "service_role";



GRANT ALL ON TABLE "public"."MarketingChannelMap" TO "anon";
GRANT ALL ON TABLE "public"."MarketingChannelMap" TO "authenticated";
GRANT ALL ON TABLE "public"."MarketingChannelMap" TO "service_role";



GRANT ALL ON TABLE "public"."NotificationDispatch" TO "anon";
GRANT ALL ON TABLE "public"."NotificationDispatch" TO "authenticated";
GRANT ALL ON TABLE "public"."NotificationDispatch" TO "service_role";



GRANT ALL ON TABLE "public"."NotificationLog" TO "anon";
GRANT ALL ON TABLE "public"."NotificationLog" TO "authenticated";
GRANT ALL ON TABLE "public"."NotificationLog" TO "service_role";



GRANT ALL ON TABLE "public"."NotificationTemplate" TO "anon";
GRANT ALL ON TABLE "public"."NotificationTemplate" TO "authenticated";
GRANT ALL ON TABLE "public"."NotificationTemplate" TO "service_role";



GRANT ALL ON TABLE "public"."Order" TO "anon";
GRANT ALL ON TABLE "public"."Order" TO "authenticated";
GRANT ALL ON TABLE "public"."Order" TO "service_role";



GRANT ALL ON TABLE "public"."OrderItem" TO "anon";
GRANT ALL ON TABLE "public"."OrderItem" TO "authenticated";
GRANT ALL ON TABLE "public"."OrderItem" TO "service_role";



GRANT ALL ON TABLE "public"."OtpCode" TO "anon";
GRANT ALL ON TABLE "public"."OtpCode" TO "authenticated";
GRANT ALL ON TABLE "public"."OtpCode" TO "service_role";



GRANT ALL ON TABLE "public"."OtpToken" TO "anon";
GRANT ALL ON TABLE "public"."OtpToken" TO "authenticated";
GRANT ALL ON TABLE "public"."OtpToken" TO "service_role";



GRANT ALL ON TABLE "public"."Payout" TO "anon";
GRANT ALL ON TABLE "public"."Payout" TO "authenticated";
GRANT ALL ON TABLE "public"."Payout" TO "service_role";



GRANT ALL ON TABLE "public"."PayrollConfig" TO "anon";
GRANT ALL ON TABLE "public"."PayrollConfig" TO "authenticated";
GRANT ALL ON TABLE "public"."PayrollConfig" TO "service_role";



GRANT ALL ON TABLE "public"."PayrollRun" TO "anon";
GRANT ALL ON TABLE "public"."PayrollRun" TO "authenticated";
GRANT ALL ON TABLE "public"."PayrollRun" TO "service_role";



GRANT ALL ON TABLE "public"."Payslip" TO "anon";
GRANT ALL ON TABLE "public"."Payslip" TO "authenticated";
GRANT ALL ON TABLE "public"."Payslip" TO "service_role";



GRANT ALL ON TABLE "public"."PeriodLock" TO "anon";
GRANT ALL ON TABLE "public"."PeriodLock" TO "authenticated";
GRANT ALL ON TABLE "public"."PeriodLock" TO "service_role";



GRANT ALL ON TABLE "public"."PoMessage" TO "anon";
GRANT ALL ON TABLE "public"."PoMessage" TO "authenticated";
GRANT ALL ON TABLE "public"."PoMessage" TO "service_role";



GRANT ALL ON TABLE "public"."PreorderBalance" TO "anon";
GRANT ALL ON TABLE "public"."PreorderBalance" TO "authenticated";
GRANT ALL ON TABLE "public"."PreorderBalance" TO "service_role";



GRANT ALL ON TABLE "public"."Product" TO "anon";
GRANT ALL ON TABLE "public"."Product" TO "authenticated";
GRANT ALL ON TABLE "public"."Product" TO "service_role";



GRANT ALL ON TABLE "public"."Product_backup_20260621" TO "anon";
GRANT ALL ON TABLE "public"."Product_backup_20260621" TO "authenticated";
GRANT ALL ON TABLE "public"."Product_backup_20260621" TO "service_role";



GRANT ALL ON TABLE "public"."PurchaseCost" TO "anon";
GRANT ALL ON TABLE "public"."PurchaseCost" TO "authenticated";
GRANT ALL ON TABLE "public"."PurchaseCost" TO "service_role";



GRANT ALL ON TABLE "public"."PurchaseOrder" TO "anon";
GRANT ALL ON TABLE "public"."PurchaseOrder" TO "authenticated";
GRANT ALL ON TABLE "public"."PurchaseOrder" TO "service_role";



GRANT ALL ON TABLE "public"."PurchaseOrderLine" TO "anon";
GRANT ALL ON TABLE "public"."PurchaseOrderLine" TO "authenticated";
GRANT ALL ON TABLE "public"."PurchaseOrderLine" TO "service_role";



GRANT ALL ON TABLE "public"."RecoverySettings" TO "anon";
GRANT ALL ON TABLE "public"."RecoverySettings" TO "authenticated";
GRANT ALL ON TABLE "public"."RecoverySettings" TO "service_role";



GRANT ALL ON TABLE "public"."RecurringExpense" TO "anon";
GRANT ALL ON TABLE "public"."RecurringExpense" TO "authenticated";
GRANT ALL ON TABLE "public"."RecurringExpense" TO "service_role";



GRANT ALL ON TABLE "public"."Referral" TO "anon";
GRANT ALL ON TABLE "public"."Referral" TO "authenticated";
GRANT ALL ON TABLE "public"."Referral" TO "service_role";



GRANT ALL ON TABLE "public"."ReimbursementPolicy" TO "anon";
GRANT ALL ON TABLE "public"."ReimbursementPolicy" TO "authenticated";
GRANT ALL ON TABLE "public"."ReimbursementPolicy" TO "service_role";



GRANT ALL ON TABLE "public"."ReturnEntry" TO "anon";
GRANT ALL ON TABLE "public"."ReturnEntry" TO "authenticated";
GRANT ALL ON TABLE "public"."ReturnEntry" TO "service_role";



GRANT ALL ON TABLE "public"."RevenueEntry" TO "anon";
GRANT ALL ON TABLE "public"."RevenueEntry" TO "authenticated";
GRANT ALL ON TABLE "public"."RevenueEntry" TO "service_role";



GRANT ALL ON TABLE "public"."Review" TO "anon";
GRANT ALL ON TABLE "public"."Review" TO "authenticated";
GRANT ALL ON TABLE "public"."Review" TO "service_role";



GRANT ALL ON TABLE "public"."SalaryStructure" TO "anon";
GRANT ALL ON TABLE "public"."SalaryStructure" TO "authenticated";
GRANT ALL ON TABLE "public"."SalaryStructure" TO "service_role";



GRANT ALL ON TABLE "public"."SalesInvoice" TO "anon";
GRANT ALL ON TABLE "public"."SalesInvoice" TO "authenticated";
GRANT ALL ON TABLE "public"."SalesInvoice" TO "service_role";



GRANT ALL ON TABLE "public"."SalesInvoiceLine" TO "anon";
GRANT ALL ON TABLE "public"."SalesInvoiceLine" TO "authenticated";
GRANT ALL ON TABLE "public"."SalesInvoiceLine" TO "service_role";



GRANT ALL ON TABLE "public"."SalesInvoicePayment" TO "anon";
GRANT ALL ON TABLE "public"."SalesInvoicePayment" TO "authenticated";
GRANT ALL ON TABLE "public"."SalesInvoicePayment" TO "service_role";



GRANT ALL ON TABLE "public"."Seller" TO "anon";
GRANT ALL ON TABLE "public"."Seller" TO "authenticated";
GRANT ALL ON TABLE "public"."Seller" TO "service_role";



GRANT ALL ON TABLE "public"."SellerAuditLog" TO "anon";
GRANT ALL ON TABLE "public"."SellerAuditLog" TO "authenticated";
GRANT ALL ON TABLE "public"."SellerAuditLog" TO "service_role";



GRANT ALL ON TABLE "public"."SellerCategoryCommission" TO "anon";
GRANT ALL ON TABLE "public"."SellerCategoryCommission" TO "authenticated";
GRANT ALL ON TABLE "public"."SellerCategoryCommission" TO "service_role";



GRANT ALL ON TABLE "public"."SellerChangeRequest" TO "anon";
GRANT ALL ON TABLE "public"."SellerChangeRequest" TO "authenticated";
GRANT ALL ON TABLE "public"."SellerChangeRequest" TO "service_role";



GRANT ALL ON TABLE "public"."SellerDocument" TO "anon";
GRANT ALL ON TABLE "public"."SellerDocument" TO "authenticated";
GRANT ALL ON TABLE "public"."SellerDocument" TO "service_role";



GRANT ALL ON TABLE "public"."SellerInventorySubmission" TO "anon";
GRANT ALL ON TABLE "public"."SellerInventorySubmission" TO "authenticated";
GRANT ALL ON TABLE "public"."SellerInventorySubmission" TO "service_role";



GRANT ALL ON TABLE "public"."SellerMagicToken" TO "anon";
GRANT ALL ON TABLE "public"."SellerMagicToken" TO "authenticated";
GRANT ALL ON TABLE "public"."SellerMagicToken" TO "service_role";



GRANT ALL ON TABLE "public"."SellerOrderRelease" TO "anon";
GRANT ALL ON TABLE "public"."SellerOrderRelease" TO "authenticated";
GRANT ALL ON TABLE "public"."SellerOrderRelease" TO "service_role";



GRANT ALL ON TABLE "public"."SellerProductCommission" TO "anon";
GRANT ALL ON TABLE "public"."SellerProductCommission" TO "authenticated";
GRANT ALL ON TABLE "public"."SellerProductCommission" TO "service_role";



GRANT ALL ON TABLE "public"."SellerTeamMember" TO "anon";
GRANT ALL ON TABLE "public"."SellerTeamMember" TO "authenticated";
GRANT ALL ON TABLE "public"."SellerTeamMember" TO "service_role";



GRANT ALL ON TABLE "public"."ShippingZone" TO "anon";
GRANT ALL ON TABLE "public"."ShippingZone" TO "authenticated";
GRANT ALL ON TABLE "public"."ShippingZone" TO "service_role";



GRANT ALL ON TABLE "public"."SmsTemplate" TO "anon";
GRANT ALL ON TABLE "public"."SmsTemplate" TO "authenticated";
GRANT ALL ON TABLE "public"."SmsTemplate" TO "service_role";



GRANT ALL ON TABLE "public"."TdsCertificate" TO "anon";
GRANT ALL ON TABLE "public"."TdsCertificate" TO "authenticated";
GRANT ALL ON TABLE "public"."TdsCertificate" TO "service_role";



GRANT ALL ON TABLE "public"."User" TO "anon";
GRANT ALL ON TABLE "public"."User" TO "authenticated";
GRANT ALL ON TABLE "public"."User" TO "service_role";



GRANT ALL ON TABLE "public"."Variant" TO "anon";
GRANT ALL ON TABLE "public"."Variant" TO "authenticated";
GRANT ALL ON TABLE "public"."Variant" TO "service_role";



GRANT ALL ON TABLE "public"."Vendor" TO "anon";
GRANT ALL ON TABLE "public"."Vendor" TO "authenticated";
GRANT ALL ON TABLE "public"."Vendor" TO "service_role";



GRANT ALL ON TABLE "public"."VendorAuditLog" TO "anon";
GRANT ALL ON TABLE "public"."VendorAuditLog" TO "authenticated";
GRANT ALL ON TABLE "public"."VendorAuditLog" TO "service_role";



GRANT ALL ON TABLE "public"."VendorCatalogItem" TO "anon";
GRANT ALL ON TABLE "public"."VendorCatalogItem" TO "authenticated";
GRANT ALL ON TABLE "public"."VendorCatalogItem" TO "service_role";



GRANT ALL ON TABLE "public"."VendorChangeRequest" TO "anon";
GRANT ALL ON TABLE "public"."VendorChangeRequest" TO "authenticated";
GRANT ALL ON TABLE "public"."VendorChangeRequest" TO "service_role";



GRANT ALL ON TABLE "public"."VendorDocument" TO "anon";
GRANT ALL ON TABLE "public"."VendorDocument" TO "authenticated";
GRANT ALL ON TABLE "public"."VendorDocument" TO "service_role";



GRANT ALL ON TABLE "public"."VendorMagicToken" TO "anon";
GRANT ALL ON TABLE "public"."VendorMagicToken" TO "authenticated";
GRANT ALL ON TABLE "public"."VendorMagicToken" TO "service_role";



GRANT ALL ON TABLE "public"."VendorNotificationPref" TO "anon";
GRANT ALL ON TABLE "public"."VendorNotificationPref" TO "authenticated";
GRANT ALL ON TABLE "public"."VendorNotificationPref" TO "service_role";



GRANT ALL ON TABLE "public"."VendorPayout" TO "anon";
GRANT ALL ON TABLE "public"."VendorPayout" TO "authenticated";
GRANT ALL ON TABLE "public"."VendorPayout" TO "service_role";



GRANT ALL ON TABLE "public"."VendorTeamMember" TO "anon";
GRANT ALL ON TABLE "public"."VendorTeamMember" TO "authenticated";
GRANT ALL ON TABLE "public"."VendorTeamMember" TO "service_role";



GRANT ALL ON TABLE "public"."Waitlist" TO "anon";
GRANT ALL ON TABLE "public"."Waitlist" TO "authenticated";
GRANT ALL ON TABLE "public"."Waitlist" TO "service_role";



GRANT ALL ON TABLE "public"."Wishlist" TO "anon";
GRANT ALL ON TABLE "public"."Wishlist" TO "authenticated";
GRANT ALL ON TABLE "public"."Wishlist" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































drop extension if exists "pg_net";


