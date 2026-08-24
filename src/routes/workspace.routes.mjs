import { Router } from "express";
import { authUser } from "../middleware/auth.middleware.mjs";
import { getAllWorkspaces, getWorkspace, createWorkspace, updateWorkspace, deleteWorkspace } from "../controllers/workspace.controller.mjs"
import {
    getWorkspaceMembers,
    addWorkspaceMember,
    updateWorkspaceMember,
    removeWorkspaceMember
} from "../controllers/workspaceMember.controller.mjs";

const workspaceRoutes = Router();

workspaceRoutes.use(authUser);

workspaceRoutes.get('/workspaces', getAllWorkspaces);
workspaceRoutes.post('/workspaces', createWorkspace);
workspaceRoutes.get('/workspaces/:workspaceId/members', getWorkspaceMembers);
workspaceRoutes.post('/workspaces/:workspaceId/members', addWorkspaceMember);
workspaceRoutes.patch('/workspaces/:workspaceId/members/:membershipId', updateWorkspaceMember);
workspaceRoutes.delete('/workspaces/:workspaceId/members/:membershipId', removeWorkspaceMember);
workspaceRoutes.get('/workspaces/:id', getWorkspace);
workspaceRoutes.patch('/workspaces/:id', updateWorkspace);
workspaceRoutes.delete('/workspaces/:id', deleteWorkspace);

// Backward-compatible aliases for clients using the original singular routes.
workspaceRoutes.post('/workspace', createWorkspace);
workspaceRoutes.put('/workspace/:id', updateWorkspace);
workspaceRoutes.delete('/workspace/:id', deleteWorkspace);

export { workspaceRoutes }
