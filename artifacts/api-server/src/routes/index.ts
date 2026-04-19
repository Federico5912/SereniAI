import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profileRouter from "./profile";
import assessmentRouter from "./assessment";
import resourcesRouter from "./resources";
import contactRouter from "./contact";
import adminRouter from "./admin";
import openaiRouter from "./openai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(profileRouter);
router.use(assessmentRouter);
router.use(resourcesRouter);
router.use(contactRouter);
router.use(adminRouter);
router.use(openaiRouter);

export default router;
