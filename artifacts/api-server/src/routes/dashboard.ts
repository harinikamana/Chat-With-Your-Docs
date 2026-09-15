import { and, count, desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";
import {
  conversationsTable,
  db,
  documentsTable,
} from "@workspace/db";
import { getAuthenticatedUserId, requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req)!;
  const [totalDocuments] = await db
    .select({ value: count() })
    .from(documentsTable)
    .where(eq(documentsTable.userId, userId));
  const [readyDocuments] = await db
    .select({ value: count() })
    .from(documentsTable)
    .where(and(eq(documentsTable.userId, userId), eq(documentsTable.status, "READY")));
  const [processingDocuments] = await db
    .select({ value: count() })
    .from(documentsTable)
    .where(
      and(
        eq(documentsTable.userId, userId),
        inArray(documentsTable.status, ["UPLOADING", "UPLOADED", "PROCESSING", "EMBEDDING"]),
      ),
    );
  const [totalConversations] = await db
    .select({ value: count() })
    .from(conversationsTable)
    .where(eq(conversationsTable.userId, userId));
  const recentDocuments = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.userId, userId))
    .orderBy(desc(documentsTable.createdAt))
    .limit(5);
  const recentConversations = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.userId, userId))
    .orderBy(desc(conversationsTable.updatedAt))
    .limit(5);
  res.json(
    GetDashboardSummaryResponse.parse({
      totalDocuments: Number(totalDocuments.value),
      readyDocuments: Number(readyDocuments.value),
      processingDocuments: Number(processingDocuments.value),
      totalConversations: Number(totalConversations.value),
      recentDocuments,
      recentConversations,
    }),
  );
});

export default router;