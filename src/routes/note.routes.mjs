import { Router } from "express";
import { authUser } from "../middleware/auth.middleware.mjs";
import {
    createNote,
    deleteNote,
    getAllNotes,
    getNote,
    updateNote
} from "../controllers/note.controller.mjs";

const noteRoutes = Router();

noteRoutes.use(authUser);

noteRoutes.get("/notes", getAllNotes);
noteRoutes.post("/workspaces/:workspaceId/notes", createNote);
noteRoutes.get("/notes/:id", getNote);
noteRoutes.patch("/notes/:id", updateNote);
noteRoutes.delete("/notes/:id", deleteNote);

export { noteRoutes };
