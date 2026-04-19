import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, resourcesTable } from "@workspace/db";
import { GetResourcesQueryParams, GetResourceParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/resources", async (req, res): Promise<void> => {
  const params = GetResourcesQueryParams.safeParse(req.query);
  
  let query = db.select().from(resourcesTable).where(eq(resourcesTable.isActive, true));
  
  if (params.success && params.data.category) {
    const resources = await db
      .select()
      .from(resourcesTable)
      .where(and(eq(resourcesTable.isActive, true), eq(resourcesTable.category, params.data.category)));
    res.json(resources);
    return;
  }
  
  const resources = await query;
  res.json(resources);
});

router.get("/resources/:slug", async (req, res): Promise<void> => {
  const params = GetResourceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [resource] = await db
    .select()
    .from(resourcesTable)
    .where(and(eq(resourcesTable.slug, params.data.slug), eq(resourcesTable.isActive, true)));

  if (!resource) {
    res.status(404).json({ error: "Resource not found" });
    return;
  }
  res.json(resource);
});

export default router;
