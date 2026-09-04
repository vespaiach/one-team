import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { boardColumn, issueCounter, project, projectMember, user } from "@/db/schema";
import { isUniqueViolation } from "@/db/unique-violation";
import { writeActivity } from "@/features/activity/server/write-activity";
import { SEED_COLUMNS } from "../seed-columns";
import { findProjectKeyHolder } from "./queries";

export type CreateProjectInput = {
  name: string;
  key: string;
  description: string | null;
  startDate: string | null;
  targetDate: string | null;
  memberIds: string[];
  actorId?: string;
};

export type CreateProjectResult =
  | { status: "created"; projectKey: string }
  | { status: "key_taken"; holder: { key: string; name: string } };

export async function createProject(input: CreateProjectInput): Promise<CreateProjectResult> {
  try {
    const projectKey = await db.transaction(async (tx) => {
      const now = new Date();

      const [createdProject] = await tx
        .insert(project)
        .values({
          key: input.key,
          name: input.name,
          description: input.description,
          startDate: input.startDate,
          targetDate: input.targetDate,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!createdProject) {
        throw new Error("createProject produced no project row");
      }

      await tx.insert(boardColumn).values(
        SEED_COLUMNS.map((column) => ({
          projectId: createdProject.id,
          name: column.name,
          kind: column.kind,
          sortOrder: column.sortOrder,
          createdAt: now,
          updatedAt: now,
        })),
      );

      await tx.insert(issueCounter).values({ projectId: createdProject.id, lastNumber: 0 });

      if (input.memberIds.length > 0) {
        await tx.insert(projectMember).values(
          input.memberIds.map((userId) => ({
            projectId: createdProject.id,
            userId,
            createdAt: now,
            updatedAt: now,
          })),
        );
      }

      if (input.actorId) {
        await writeActivity(tx, {
          type: "created",
          target: { projectId: createdProject.id },
          actorId: input.actorId,
        });

        if (input.memberIds.length > 0) {
          const members = await tx
            .select({ id: user.id, firstName: user.firstName, lastName: user.lastName })
            .from(user)
            .where(inArray(user.id, input.memberIds));
          const memberById = new Map(members.map((member) => [member.id, member]));

          for (const memberId of input.memberIds) {
            const member = memberById.get(memberId);
            if (!member) {
              throw new Error(`createProject: member ${memberId} not found`);
            }
            await writeActivity(tx, {
              type: "member_added",
              target: { projectId: createdProject.id },
              actorId: input.actorId,
              toValue: `${member.firstName} ${member.lastName}`,
            });
          }
        }
      }

      return createdProject.key;
    });

    return { status: "created", projectKey };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const holder = await findProjectKeyHolder(input.key);
      if (holder) {
        return { status: "key_taken", holder };
      }
    }
    throw error;
  }
}