import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

type AuditInput = {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  result?: "SUCCESS" | "FAILURE";
  metadata?: Prisma.InputJsonValue;
};

export async function writeAuditEvent(input: AuditInput) {
  await prisma.auditEvent.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      result: input.result ?? "SUCCESS",
      metadata: input.metadata ?? {},
    },
  });
}
