import { Router } from "express";
import { getUser } from "../controllers/user.controller.mjs";
import { authUser } from "../middleware/auth.middleware.mjs";

const userRoutes = Router();

userRoutes.use(authUser);
userRoutes.get("/user", getUser);

export { userRoutes }
