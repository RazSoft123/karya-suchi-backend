import { z } from "zod";
import Workspace from "../models/Workspace.mjs";
import WorkspaceMember from "../models/WorkspaceMember.mjs";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid workspace id");
const workspaceFields = {
    name: z.string().trim().min(3, "Workspace name must contain at least 3 characters").max(100, "Workspace name must contain 100 characters or fewer"),
    description: z.string().trim().max(2000, "Description must contain 2000 characters or fewer")
};
const createWorkspaceSchema = z.object({
    name: workspaceFields.name,
    description: workspaceFields.description.default("")
}).strict();
const updateWorkspaceSchema = z.object({
    name: workspaceFields.name.optional(),
    description: workspaceFields.description.optional()
}).strict().refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
});

function sendFailure(res, status, messages) {
    return res.status(status).json({
        status: "failed",
        data: {},
        messages: Array.isArray(messages) ? messages : [messages]
    });
}

function validationMessages(result) {
    return result.error.issues.map((issue) => issue.message);
}

function serializeWorkspace(workspace, user, membership = null) {
    const value = workspace.toObject();
    const isOwner = workspace.owner.equals(user._id);
    const canManage = isOwner || membership?.role === "owner" || membership?.role === "admin";
    const canEdit = canManage || membership?.access === "edit";

    return {
        id: value._id.toString(),
        name: value.name,
        description: value.description,
        ownerId: value.owner.toString(),
        isOwner,
        canManage,
        canEdit,
        isDefault: Boolean(user.defaultWorkspace?.equals(value._id)),
        createdAt: value.createdAt,
        updatedAt: value.updatedAt
    };
}

async function getWorkspaceAccess(user, workspaceId) {
    const workspace = await Workspace.findOne({
        _id: workspaceId,
        isDeleted: false
    });

    if (!workspace) {
        return { error: { status: 404, message: "Workspace not found" } };
    }

    if (workspace.owner.equals(user._id)) {
        return { workspace, membership: null };
    }

    const membership = await WorkspaceMember.findOne({
        workspace: workspace._id,
        member: user._id
    });

    if (!membership) {
        return { error: { status: 403, message: "You do not have access to this workspace" } };
    }

    return { workspace, membership };
}

async function getAllWorkspaces(req, res) {
    try {
        const memberships = await WorkspaceMember.find({ member: req.user._id });
        const membershipByWorkspace = new Map(
            memberships.map((membership) => [membership.workspace.toString(), membership])
        );

        const workspaces = await Workspace.find({
            isDeleted: false,
            $or: [
                { owner: req.user._id },
                { _id: { $in: memberships.map((membership) => membership.workspace) } }
            ]
        }).sort({ updatedAt: -1 });

        return res.status(200).json({
            status: "success",
            data: workspaces.map((workspace) => serializeWorkspace(
                workspace,
                req.user,
                membershipByWorkspace.get(workspace._id.toString())
            )),
            messages: ["Workspaces fetched successfully"]
        });
    } catch (error) {
        console.error("ERROR: fetching workspaces", error);
        return sendFailure(res, 500, "Unable to fetch workspaces");
    }
}

async function getWorkspace(req, res) {
    try {
        const parsedId = objectIdSchema.safeParse(req.params.id);
        if (!parsedId.success) {
            return sendFailure(res, 400, validationMessages(parsedId));
        }

        const access = await getWorkspaceAccess(req.user, parsedId.data);
        if (access.error) {
            return sendFailure(res, access.error.status, access.error.message);
        }

        return res.status(200).json({
            status: "success",
            data: serializeWorkspace(access.workspace, req.user, access.membership),
            messages: ["Workspace fetched successfully"]
        });
    } catch (error) {
        console.error("ERROR: fetching workspace", error);
        return sendFailure(res, 500, "Unable to fetch the workspace");
    }
}

async function createWorkspace(req, res) {
    try {
        const parsedBody = createWorkspaceSchema.safeParse(req.body);
        if (!parsedBody.success) {
            return sendFailure(res, 400, validationMessages(parsedBody));
        }

        const workspace = await Workspace.create({
            ...parsedBody.data,
            owner: req.user._id
        });

        return res.status(201).json({
            status: "success",
            data: serializeWorkspace(workspace, req.user),
            messages: ["Workspace created successfully"]
        });
    } catch (error) {
        console.error("ERROR: creating workspace", error);
        return sendFailure(res, 500, "Unable to create the workspace");
    }
}

async function updateWorkspace(req, res) {
    try {
        const parsedId = objectIdSchema.safeParse(req.params.id);
        if (!parsedId.success) {
            return sendFailure(res, 400, validationMessages(parsedId));
        }

        const parsedBody = updateWorkspaceSchema.safeParse(req.body);
        if (!parsedBody.success) {
            return sendFailure(res, 400, validationMessages(parsedBody));
        }

        const access = await getWorkspaceAccess(req.user, parsedId.data);
        if (access.error) {
            return sendFailure(res, access.error.status, access.error.message);
        }

        const canManage = access.workspace.owner.equals(req.user._id)
            || access.membership?.role === "owner"
            || access.membership?.role === "admin";
        if (!canManage) {
            return sendFailure(res, 403, "You do not have permission to update this workspace");
        }

        if (parsedBody.data.name !== undefined) access.workspace.name = parsedBody.data.name;
        if (parsedBody.data.description !== undefined) access.workspace.description = parsedBody.data.description;
        await access.workspace.save();

        return res.status(200).json({
            status: "success",
            data: serializeWorkspace(access.workspace, req.user, access.membership),
            messages: ["Workspace updated successfully"]
        });
    } catch (error) {
        console.error("ERROR: updating workspace", error);
        return sendFailure(res, 500, "Unable to update the workspace");
    }
}

async function deleteWorkspace(req, res) {
    try {
        const parsedId = objectIdSchema.safeParse(req.params.id);
        if (!parsedId.success) {
            return sendFailure(res, 400, validationMessages(parsedId));
        }

        const workspace = await Workspace.findOne({
            _id: parsedId.data,
            isDeleted: false
        });

        if (!workspace) {
            return sendFailure(res, 404, "Workspace not found");
        }

        if (!workspace.owner.equals(req.user._id)) {
            return sendFailure(res, 403, "Only the workspace owner can delete this workspace");
        }

        if (req.user.defaultWorkspace?.equals(workspace._id)) {
            return sendFailure(res, 400, "The default workspace cannot be deleted");
        }

        workspace.isDeleted = true;
        workspace.deletedAt = new Date();
        await workspace.save();

        return res.sendStatus(204);
    } catch (error) {
        console.error("ERROR: deleting workspace", error);
        return sendFailure(res, 500, "Unable to delete the workspace");
    }
}

export {
    getAllWorkspaces,
    getWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace
};
