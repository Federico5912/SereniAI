import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db, contactFormsTable, helpRequestsTable } from "@workspace/db";
import { SubmitContactFormBody, SubmitHelpRequestBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/contact", async (req, res): Promise<void> => {
  const parsed = SubmitContactFormBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const auth = getAuth(req);
  const userId = auth?.userId ?? null;

  const [form] = await db
    .insert(contactFormsTable)
    .values({ ...parsed.data, userId })
    .returning();
  res.status(201).json(form);
});

router.post("/help-request", async (req, res): Promise<void> => {
  const parsed = SubmitHelpRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const auth = getAuth(req);
  const userId = auth?.userId ?? null;

  const [helpRequest] = await db
    .insert(helpRequestsTable)
    .values({ ...parsed.data, userId })
    .returning();
  res.status(201).json(helpRequest);
});

export default router;
