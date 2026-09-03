import "server-only";
import { db } from "@/db";
import { boardColumn, issueCounter, project, projectMember } from "@/db/schema";
import { isUniqueViolation } from "@/db/unique-violation";
import { SEED_COLUMNS } from "../seed-columns";
import { findProjectKeyHolder } from "./queries";

export type CreateProjectInput = {
  name: string;
  key: string;
  description: string | null;
  startDate: string | null;
  targetDate: string | null;
  memberIds: string[];
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