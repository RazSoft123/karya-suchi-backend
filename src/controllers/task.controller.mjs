import { z } from "zod";
import Task from "../models/Tasks.mjs";
import Workspace from "../models/Workspace.mjs";
import WorkspaceMember from "../models/WorkspaceMember.mjs";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const dueDateSchema = z.string().trim().refine(
    (value) => !Number.isNaN(Date.parse(value)),
    "Due date must be a valid date"
);

const createTaskSchema = z.object({
    title: z.string().trim().min(1, "Title is required").max(200, "Title must be 200 characters or fewer"),
    description: z.string().max(10000, "Description is too long").default(""),
    priority: z.enum(["low", "medium", "high"]).default("medium"),
    dueDate: dueDateSchema.optional(),
    workspaceId: objectIdSchema.optional()
}).strict();

const updateTaskSchema = z.object({
    title: z.string().trim().min(1, "Title is required").max(200, "Title must be 200 characters or fewer").optional(),
    description: z.string().max(10000, "Description is too long").optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    status: z.enum(["todo", "in_progress", "completed", "archived"]).optional(),
    dueDate: z.union([dueDateSchema, z.null()]).optional(),
    workspaceId: objectIdSchema.optional()
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

function serializeTask(task) {
    const value = task.toObject();
    const workspace = value.workspace;
    const populatedWorkspace = workspace && workspace.name;

    return {
        id: value._id.toString(),
        title: value.title,
        description: value.description,
        status: value.status,
        completed: value.status === "completed",
        priority: value.priority,
        dueDate: value.dueDate,
        userId: value.user.toString(),
        workspace: populatedWorkspace
            ? { id: workspace._id.toString(), name: workspace.name }
            : { id: workspace.toString(), name: "" },
        createdAt: value.createdAt,
        updatedAt: value.updatedAt
    };
}

async function getWorkspaceAccess(userId, workspaceId) {
    const workspace = await Workspace.findOne({
        _id: workspaceId,
        isDeleted: false
    }).select("name owner");

    if (!workspace) {
        return { error: { status: 404, message: "Workspace not found" } };
    }

    if (workspace.owner.equals(userId)) {
        return { workspace, canEdit: true };
    }

    const membership = await WorkspaceMember.findOne({
        workspace: workspace._id,
        member: userId
    });

    if (!membership) {
        return { error: { status: 403, message: "You do not have access to this workspace" } };
    }

    return {
        workspace,
        canEdit: membership.role === "owner"
            || membership.role === "admin"
            || membership.access === "edit"
    };
}

async function getAccessibleWorkspaceIds(userId) {
    const memberWorkspaceIds = await WorkspaceMember.find({ member: userId }).distinct("workspace");

    return Workspace.find({
        isDeleted: false,
        $or: [
            { owner: userId },
            { _id: { $in: memberWorkspaceIds } }
        ]
    }).distinct("_id");
}

async function getAllTasks(req, res) {
    try {
        const { workspace: workspaceId } = req.query;
        let workspaceIds;

        if (workspaceId !== undefined) {
            const parsedId = objectIdSchema.safeParse(workspaceId);
            if (!parsedId.success) {
                return sendFailure(res, 400, validationMessages(parsedId));
            }

            const access = await getWorkspaceAccess(req.user._id, parsedId.data);
            if (access.error) {
                return sendFailure(res, access.error.status, access.error.message);
            }
            workspaceIds = [access.workspace._id];
        } else {
            workspaceIds = await getAccessibleWorkspaceIds(req.user._id);
        }

        const tasks = await Task.find({
            workspace: { $in: workspaceIds },
            isDeleted: false
        })
            .sort({ createdAt: -1 })
            .populate("workspace", "name");

        return res.status(200).json({
            status: "success",
            data: tasks.map(serializeTask),
            messages: ["Tasks fetched successfully"]
        });
    } catch (error) {
        console.error("ERROR: fetching tasks", error);
        return sendFailure(res, 500, "Unable to fetch tasks");
    }
}

async function createTask(req, res) {
    try {
        const parsedBody = createTaskSchema.safeParse(req.body);
        if (!parsedBody.success) {
            return sendFailure(res, 400, validationMessages(parsedBody));
        }

        const workspaceId = parsedBody.data.workspaceId
            ?? req.user.defaultWorkspace?.toString();

        if (!workspaceId) {
            return sendFailure(
                res,
                400,
                "No workspace was selected and the user does not have a default workspace"
            );
        }

        const access = await getWorkspaceAccess(req.user._id, workspaceId);
        if (access.error) {
            return sendFailure(res, access.error.status, access.error.message);
        }
        if (!access.canEdit) {
            return sendFailure(res, 403, "You do not have permission to create tasks in this workspace");
        }

        const task = await Task.create({
            title: parsedBody.data.title,
            description: parsedBody.data.description,
            priority: parsedBody.data.priority,
            dueDate: parsedBody.data.dueDate
                ? new Date(parsedBody.data.dueDate)
                : null,
            user: req.user._id,
            workspace: access.workspace._id
        });

        await task.populate("workspace", "name");

        return res.status(201).json({
            status: "success",
            data: serializeTask(task),
            messages: ["Task created successfully"]
        });
    } catch (error) {
        console.error("ERROR: creating task", error);
        return sendFailure(res, 500, "Unable to create the task");
    }
}

async function getTask(req, res) {
    try {
        const parsedId = objectIdSchema.safeParse(req.params.id);
        if (!parsedId.success) {
            return sendFailure(res, 400, validationMessages(parsedId));
        }

        const task = await Task.findOne({ _id: parsedId.data, isDeleted: false });
        if (!task) {
            return sendFailure(res, 404, "Task not found");
        }

        const access = await getWorkspaceAccess(req.user._id, task.workspace);
        if (access.error) {
            return sendFailure(res, access.error.status, access.error.message);
        }

        await task.populate("workspace", "name");

        return res.status(200).json({
            status: "success",
            data: serializeTask(task),
            messages: ["Task fetched successfully"]
        });
    } catch (error) {
        console.error("ERROR: fetching task", error);
        return sendFailure(res, 500, "Unable to fetch the task");
    }
}

async function updateTask(req, res) {
    try {
        const parsedId = objectIdSchema.safeParse(req.params.id);
        if (!parsedId.success) {
            return sendFailure(res, 400, validationMessages(parsedId));
        }

        const parsedBody = updateTaskSchema.safeParse(req.body);
        if (!parsedBody.success) {
            return sendFailure(res, 400, validationMessages(parsedBody));
        }

        const task = await Task.findOne({ _id: parsedId.data, isDeleted: false });
        if (!task) {
            return sendFailure(res, 404, "Task not found");
        }

        const currentAccess = await getWorkspaceAccess(req.user._id, task.workspace);
        if (currentAccess.error) {
            return sendFailure(res, currentAccess.error.status, currentAccess.error.message);
        }
        if (!currentAccess.canEdit) {
            return sendFailure(res, 403, "You do not have permission to update this task");
        }

        const { title, description, priority, status, dueDate, workspaceId } = parsedBody.data;

        if (workspaceId && workspaceId !== task.workspace.toString()) {
            const targetAccess = await getWorkspaceAccess(req.user._id, workspaceId);
            if (targetAccess.error) {
                return sendFailure(res, targetAccess.error.status, targetAccess.error.message);
            }
            if (!targetAccess.canEdit) {
                return sendFailure(res, 403, "You do not have permission to move this task to that workspace");
            }
            task.workspace = targetAccess.workspace._id;
        }

        if (title !== undefined) task.title = title;
        if (description !== undefined) task.description = description;
        if (priority !== undefined) task.priority = priority;
        if (status !== undefined) task.status = status;
        if (dueDate !== undefined) {
            task.dueDate = dueDate === null ? null : new Date(dueDate);
        }

        await task.save();
        await task.populate("workspace", "name");

        return res.status(200).json({
            status: "success",
            data: serializeTask(task),
            messages: ["Task updated successfully"]
        });
    } catch (error) {
        console.error("ERROR: updating task", error);
        return sendFailure(res, 500, "Unable to update the task");
    }
}

async function deleteTask(req, res) {
    try {
        const parsedId = objectIdSchema.safeParse(req.params.id);
        if (!parsedId.success) {
            return sendFailure(res, 400, validationMessages(parsedId));
        }

        const task = await Task.findOne({ _id: parsedId.data, isDeleted: false });
        if (!task) {
            return sendFailure(res, 404, "Task not found");
        }

        const access = await getWorkspaceAccess(req.user._id, task.workspace);
        if (access.error) {
            return sendFailure(res, access.error.status, access.error.message);
        }
        if (!access.canEdit) {
            return sendFailure(res, 403, "You do not have permission to delete this task");
        }

        task.isDeleted = true;
        task.deletedAt = new Date();
        await task.save();

        return res.sendStatus(204);
    } catch (error) {
        console.error("ERROR: deleting task", error);
        return sendFailure(res, 500, "Unable to delete the task");
    }
}

export { getAllTasks, getTask, createTask, updateTask, deleteTask };
