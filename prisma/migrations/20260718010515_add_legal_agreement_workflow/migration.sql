-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('DRAFT', 'INTERNAL_REVIEW', 'SELLER_REVIEW', 'READY_TO_LOCK', 'LOCKED', 'SENT_FOR_SIGNATURE', 'SELLER_SIGNED', 'COMPANY_SIGNED', 'CLOSED', 'VOID');

-- CreateEnum
CREATE TYPE "AgreementObservationStatus" AS ENUM ('OPEN', 'RESOLVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AgreementActorType" AS ENUM ('ADMIN', 'LEGAL', 'SELLER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AgreementSignatureKind" AS ENUM ('COMPANY', 'SELLER');

-- CreateTable
CREATE TABLE "LegalSignatory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "signatureUrl" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalSignatory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerAgreement" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "status" "AgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersionNo" INTEGER NOT NULL DEFAULT 1,
    "companySignatoryId" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedByUserId" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenedByUserId" TEXT,
    "sellerSignedAt" TIMESTAMP(3),
    "companySignedAt" TIMESTAMP(3),
    "sellerExecutionMode" TEXT,
    "sellerExecutionRef" TEXT,
    "sellerOtpHash" TEXT,
    "sellerOtpExpiresAt" TIMESTAMP(3),
    "currentDocumentJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerAgreementVersion" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "documentJson" JSONB NOT NULL,
    "changeSummary" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerAgreementVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerAgreementObservation" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "clauseId" TEXT NOT NULL,
    "paragraphKey" TEXT NOT NULL,
    "paragraphText" TEXT,
    "sellerComment" TEXT NOT NULL,
    "sellerUserId" TEXT,
    "adminResponse" TEXT,
    "status" "AgreementObservationStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerAgreementObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerAgreementAssignment" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleSnapshot" "Role" NOT NULL,
    "canReview" BOOLEAN NOT NULL DEFAULT true,
    "canComment" BOOLEAN NOT NULL DEFAULT true,
    "canSign" BOOLEAN NOT NULL DEFAULT false,
    "canClose" BOOLEAN NOT NULL DEFAULT false,
    "assignedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerAgreementAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerAgreementEvent" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorType" "AgreementActorType" NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerAgreementEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerAgreementSignature" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "kind" "AgreementSignatureKind" NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerTitle" TEXT,
    "signerUserId" TEXT,
    "signatureUrl" TEXT,
    "authMode" TEXT,
    "authRef" TEXT,
    "signedAt" TIMESTAMP(3),
    "auditData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerAgreementSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SellerAgreement_sellerId_key" ON "SellerAgreement"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerAgreementVersion_agreementId_versionNo_key" ON "SellerAgreementVersion"("agreementId", "versionNo");

-- CreateIndex
CREATE INDEX "SellerAgreementObservation_agreementId_clauseId_paragraphKe_idx" ON "SellerAgreementObservation"("agreementId", "clauseId", "paragraphKey");

-- CreateIndex
CREATE UNIQUE INDEX "SellerAgreementAssignment_agreementId_userId_key" ON "SellerAgreementAssignment"("agreementId", "userId");

-- CreateIndex
CREATE INDEX "SellerAgreementEvent_agreementId_createdAt_idx" ON "SellerAgreementEvent"("agreementId", "createdAt");

-- AddForeignKey
ALTER TABLE "SellerAgreement" ADD CONSTRAINT "SellerAgreement_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerAgreement" ADD CONSTRAINT "SellerAgreement_companySignatoryId_fkey" FOREIGN KEY ("companySignatoryId") REFERENCES "LegalSignatory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerAgreementVersion" ADD CONSTRAINT "SellerAgreementVersion_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "SellerAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerAgreementObservation" ADD CONSTRAINT "SellerAgreementObservation_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "SellerAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerAgreementAssignment" ADD CONSTRAINT "SellerAgreementAssignment_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "SellerAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerAgreementEvent" ADD CONSTRAINT "SellerAgreementEvent_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "SellerAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerAgreementSignature" ADD CONSTRAINT "SellerAgreementSignature_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "SellerAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
