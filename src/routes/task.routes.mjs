import { Router } from "express";
import { authUser } from "../middleware/auth.middleware.mjs";
import {
    createTask,
    deleteTask,
    getAllTasks,
    getTask,
    updateTask
} from "../controllers/task.controller.mjs";

const taskRoutes = Router();

taskRoutes.use(authUser);
taskRoutes.get("/tasks", getAllTasks);
taskRoutes.post("/tasks", createTask);
taskRoutes.get("/tasks/:id", getTask);
taskRoutes.patch("/tasks/:id", updateTask);
taskRoutes.delete("/tasks/:id", deleteTask);

export { taskRoutes };
