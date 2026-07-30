import { prisma } from '@/lib/prisma';

export async function createAdminAiTask(input: {
  surface: string;
  action: string;
  status?: string;
  title?: string | null;
  input?: unknown;
  createdByUserId: string;
}) {
  return prisma.adminAiTask.create({
    data: {
      surface: input.surface,
      action: input.action,
      status: input.status || 'QUEUED',
      title: input.title || null,
      input: (input.input as any) ?? undefined,
      createdByUserId: input.createdByUserId,
    },
  });
}

export async function completeAdminAiTask(id: string, output?: unknown) {
  return prisma.adminAiTask.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      output: (output as any) ?? undefined,
    },
  });
}

export async function failAdminAiTask(id: string, error: string) {
  return prisma.adminAiTask.update({
    where: { id },
    data: {
      status: 'FAILED',
      error,
    },
  });
}