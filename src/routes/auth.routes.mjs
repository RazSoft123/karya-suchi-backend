import express from "express";
import { loginController, logoutController, registerController, refreshController } from "./../controllers/auth.controller.mjs"

const authRoutes = express.Router();

authRoutes.post("/login", loginController);
authRoutes.get("/logout", logoutController);
authRoutes.post("/logout", logoutController);
authRoutes.post("/register", registerController);
authRoutes.post("/refresh", refreshController);

export { authRoutes }
