import { Router } from "express";
import { userRoutes } from "./user.routes.mjs";
import { authRoutes } from "./auth.routes.mjs";
import { workspaceRoutes } from "./workspace.routes.mjs";
import { noteRoutes } from "./note.routes.mjs";

const apiRoutes = Router();

apiRoutes.use(authRoutes);
apiRoutes.use(userRoutes);
apiRoutes.use(workspaceRoutes);
apiRoutes.use(noteRoutes);

export { apiRoutes }
