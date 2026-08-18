import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export const SELLER_SIGNING_PURPOSE = "seller_agreement_sign";

export function nowIso() {
  return new Date().toISOString();
}

export function createSigningToken() {
  return crypto.randomBytes(24).toString("hex");
}

export function maskPhone(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 4) return digits;
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export function getRequestOrigin(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function buildSellerSigningUrl(origin: string, sellerId: string, token: string) {
  const base = String(origin || "").replace(/\/$/, "");
  return `${base}/agreement/public/sellers/${sellerId}/sign?token=${encodeURIComponent(token)}`;
}

export function toObject(value: any): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function readAgreementWorkflow(summary: any) {
  const root = toObject(summary);
  return toObject(root.agreementWorkflow);
}

export async function loadSellerForSigning(id: string) {
  return prisma.seller.findUnique({
    where: { id },
    select: {
      id: true,
      businessName: true,
      contactName: true,
      email: true,
      phone: true,
      autoKycSummary: true,
    },
  });
}

export async function updateAgreementWorkflow(
  sellerId: string,
  updater: (workflow: Record<string, any>, seller: any) => Record<string, any>
) {
  const seller = await loadSellerForSigning(sellerId);
  if (!seller) return null;

  const root = toObject(seller.autoKycSummary);
  const currentWorkflow = readAgreementWorkflow(root);
  const nextWorkflow = updater({ ...currentWorkflow }, seller) || currentWorkflow;

  const nextSummary = {
    ...root,
    agreementWorkflow: nextWorkflow,
  };

  // Explicit select prevents Prisma from trying to RETURN stale Seller columns
  // that are present in the generated client but absent from the live database.
  await prisma.seller.update({
    where: { id: sellerId },
    data: {
      autoKycSummary: nextSummary as any,
    },
    select: { id: true },
  });

  return {
    seller,
    workflow: nextWorkflow,
    summary: nextSummary,
  };
}

export function assertSigningToken(workflow: any, token: string) {
  const expected = String(workflow?.sellerSigningToken || "");
  if (!expected || !token || token !== expected) {
    throw new Error("Invalid or expired signing token");
  }
}
