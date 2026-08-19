import { Router } from "express";
import { getUser } from "../controllers/user.controller.mjs";

const userRoutes = Router();

userRoutes.get("/user", getUser);

export { userRoutes }
