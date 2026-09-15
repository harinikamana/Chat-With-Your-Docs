import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import dashboardRouter from "./dashboard";
import documentsRouter from "./documents";
import conversationsRouter from "./conversations";
import chatRouter from "./chat";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(dashboardRouter);
router.use(documentsRouter);
router.use(conversationsRouter);
router.use(chatRouter);

export default router;
