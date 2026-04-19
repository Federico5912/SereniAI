import { Router, type IRouter } from "express";
import { eq, count, desc } from "drizzle-orm";
import { db, profilesTable, assessmentsTable, contactFormsTable, helpRequestsTable, resourcesTable, userRolesTable } from "@workspace/db";
import {
  AdminListUsersQueryParams,
  AdminUpdateUserParams,
  AdminUpdateUserBody,
  AdminListContactFormsQueryParams,
  AdminListHelpRequestsQueryParams,
  AdminUpdateHelpRequestParams,
  AdminUpdateHelpRequestBody,
  AdminCreateResourceBody,
  AdminUpdateResourceParams,
  AdminUpdateResourceBody,
  AdminDeleteResourceParams,
} from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/requireAuth";
import type { Request } from "express";

const router: IRouter = Router();

router.get("/admin/stats", requireAdmin, async (_req: Request & { userId?: string }, res): Promise<void> => {
  const [[{ value: totalUsers }], [{ value: totalAssessments }], [{ value: totalConversations }], [{ value: totalHelpRequests }], [{ value: newHelpRequests }]] = await Promise.all([
    db.select({ value: count() }).from(profilesTable),
    db.select({ value: count() }).from(assessmentsTable),
    db.select({ value: count() }).from(db.select().from(assessmentsTable).as("conversations_count")),
    db.select({ value: count() }).from(helpRequestsTable),
    db.select({ value: count() }).from(helpRequestsTable).where(eq(helpRequestsTable.status, "new")),
  ]);

  const activationRate = totalUsers > 0 ? (totalAssessments / totalUsers) : 0;
  const assessmentCompletionRate = totalUsers > 0 ? (totalAssessments / totalUsers) : 0;
  const helpRequestRate = totalUsers > 0 ? (totalHelpRequests / totalUsers) : 0;

  res.json({
    totalUsers,
    totalAssessments,
    totalChatConversations: totalConversations,
    totalHelpRequests,
    newHelpRequests,
    activationRate: Math.round(activationRate * 100) / 100,
    assessmentCompletionRate: Math.round(assessmentCompletionRate * 100) / 100,
    helpRequestRate: Math.round(helpRequestRate * 100) / 100,
  });
});

router.get("/admin/users", requireAdmin, async (req: Request & { userId?: string }, res): Promise<void> => {
  const params = AdminListUsersQueryParams.safeParse(req.query);
  const page = params.success && params.data.page ? params.data.page : 1;
  const limit = params.success && params.data.limit ? params.data.limit : 20;
  const offset = (page - 1) * limit;

  const [profiles, [{ value: total }]] = await Promise.all([
    db.select().from(profilesTable).orderBy(desc(profilesTable.createdAt)).limit(limit).offset(offset),
    db.select({ value: count() }).from(profilesTable),
  ]);

  const userIds = profiles.map((p) => p.userId);
  const roles = userIds.length > 0
    ? await db.select().from(userRolesTable).where(eq(userRolesTable.userId, userIds[0]))
    : [];
  const roleMap = new Map(roles.map((r) => [r.userId, r]));

  const users = profiles.map((p) => {
    const role = roleMap.get(p.userId);
    return {
      userId: p.userId,
      email: p.userId,
      name: p.name,
      role: role?.role ?? "user",
      isBlocked: role?.isBlocked === "true",
      createdAt: p.createdAt,
      lastAssessmentCategory: null,
    };
  });

  res.json({ users, total, page, limit });
});

router.put("/admin/users/:userId", requireAdmin, async (req: Request & { userId?: string }, res): Promise<void> => {
  const params = AdminUpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AdminUpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const targetUserId = params.data.userId;

  const existing = await db.select().from(userRolesTable).where(eq(userRolesTable.userId, targetUserId));
  if (existing.length > 0) {
    await db
      .update(userRolesTable)
      .set({
        ...(parsed.data.role !== undefined ? { role: parsed.data.role } : {}),
        ...(parsed.data.isBlocked !== undefined ? { isBlocked: String(parsed.data.isBlocked) } : {}),
      })
      .where(eq(userRolesTable.userId, targetUserId));
  } else {
    await db.insert(userRolesTable).values({
      userId: targetUserId,
      role: parsed.data.role ?? "user",
      isBlocked: String(parsed.data.isBlocked ?? false),
    });
  }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, targetUserId));
  const [roleRecord] = await db.select().from(userRolesTable).where(eq(userRolesTable.userId, targetUserId));

  res.json({
    userId: targetUserId,
    email: targetUserId,
    name: profile?.name ?? null,
    role: roleRecord?.role ?? "user",
    isBlocked: roleRecord?.isBlocked === "true",
    createdAt: profile?.createdAt ?? new Date(),
    lastAssessmentCategory: null,
  });
});

router.get("/admin/contact-forms", requireAdmin, async (req: Request & { userId?: string }, res): Promise<void> => {
  const params = AdminListContactFormsQueryParams.safeParse(req.query);
  let forms;
  if (params.success && params.data.status) {
    forms = await db.select().from(contactFormsTable).where(eq(contactFormsTable.status, params.data.status)).orderBy(desc(contactFormsTable.createdAt));
  } else {
    forms = await db.select().from(contactFormsTable).orderBy(desc(contactFormsTable.createdAt));
  }
  res.json(forms);
});

router.get("/admin/help-requests", requireAdmin, async (req: Request & { userId?: string }, res): Promise<void> => {
  const params = AdminListHelpRequestsQueryParams.safeParse(req.query);
  let requests;
  if (params.success && params.data.status) {
    requests = await db.select().from(helpRequestsTable).where(eq(helpRequestsTable.status, params.data.status)).orderBy(desc(helpRequestsTable.createdAt));
  } else {
    requests = await db.select().from(helpRequestsTable).orderBy(desc(helpRequestsTable.createdAt));
  }
  res.json(requests);
});

router.put("/admin/help-requests/:id", requireAdmin, async (req: Request & { userId?: string }, res): Promise<void> => {
  const params = AdminUpdateHelpRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AdminUpdateHelpRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(helpRequestsTable)
    .set({ status: parsed.data.status })
    .where(eq(helpRequestsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Help request not found" });
    return;
  }
  res.json(updated);
});

router.get("/admin/resources", requireAdmin, async (_req: Request & { userId?: string }, res): Promise<void> => {
  const resources = await db.select().from(resourcesTable).orderBy(desc(resourcesTable.createdAt));
  res.json(resources);
});

router.post("/admin/resources", requireAdmin, async (req: Request & { userId?: string }, res): Promise<void> => {
  const parsed = AdminCreateResourceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [resource] = await db
    .insert(resourcesTable)
    .values({
      ...parsed.data,
      isActive: parsed.data.isActive ?? true,
    })
    .returning();
  res.status(201).json(resource);
});

router.put("/admin/resources/:id", requireAdmin, async (req: Request & { userId?: string }, res): Promise<void> => {
  const params = AdminUpdateResourceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AdminUpdateResourceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(resourcesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(resourcesTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Resource not found" });
    return;
  }
  res.json(updated);
});

router.delete("/admin/resources/:id", requireAdmin, async (req: Request & { userId?: string }, res): Promise<void> => {
  const params = AdminDeleteResourceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(resourcesTable)
    .where(eq(resourcesTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Resource not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
