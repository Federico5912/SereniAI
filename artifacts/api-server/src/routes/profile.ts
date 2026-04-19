import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import { UpdateProfileBody, GetProfileResponse, UpdateProfileResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import type { Request } from "express";

const router: IRouter = Router();

router.get("/profile", requireAuth, async (req: Request & { userId?: string }, res): Promise<void> => {
  const userId = req.userId!;
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(GetProfileResponse.parse(profile));
});

router.put("/profile", requireAuth, async (req: Request & { userId?: string }, res): Promise<void> => {
  const userId = req.userId!;
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId));
  if (existing) {
    const [updated] = await db
      .update(profilesTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(profilesTable.userId, userId))
      .returning();
    res.json(UpdateProfileResponse.parse(updated));
  } else {
    const [created] = await db
      .insert(profilesTable)
      .values({ userId, languageCode: parsed.data.languageCode ?? "en", ...parsed.data })
      .returning();
    res.json(UpdateProfileResponse.parse(created));
  }
});

export default router;
