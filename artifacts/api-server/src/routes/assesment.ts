import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, assessmentsTable } from "@workspace/db";
import { SubmitAssessmentBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import type { Request } from "express";

const router: IRouter = Router();

function calculateResult(answers: number[]): { score: number; resultCategory: string } {
  const score = answers.reduce((sum, a) => sum + a, 0);
  let resultCategory = "low";
  if (score <= 12) resultCategory = "high";
  else if (score <= 20) resultCategory = "medium";
  return { score, resultCategory };
}

router.post("/assessment", requireAuth, async (req: Request & { userId?: string }, res): Promise<void> => {
  const userId = req.userId!;
  const parsed = SubmitAssessmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { score, resultCategory } = calculateResult(parsed.data.answers);
  const [assessment] = await db
    .insert(assessmentsTable)
    .values({
      userId,
      score,
      resultCategory,
      answers: JSON.stringify(parsed.data.answers),
    })
    .returning();

  res.status(201).json(assessment);
});

router.get("/assessment/latest", requireAuth, async (req: Request & { userId?: string }, res): Promise<void> => {
  const userId = req.userId!;
  const [assessment] = await db
    .select()
    .from(assessmentsTable)
    .where(eq(assessmentsTable.userId, userId))
    .orderBy(desc(assessmentsTable.createdAt))
    .limit(1);

  if (!assessment) {
    res.status(404).json({ error: "No assessment found" });
    return;
  }
  res.json(assessment);
});

router.get("/assessment/history", requireAuth, async (req: Request & { userId?: string }, res): Promise<void> => {
  const userId = req.userId!;
  const assessments = await db
    .select()
    .from(assessmentsTable)
    .where(eq(assessmentsTable.userId, userId))
    .orderBy(desc(assessmentsTable.createdAt));
  res.json(assessments);
});

export default router;
