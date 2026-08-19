import { z } from "zod";
import Note from "../models/Notes.mjs";
import Workspace from "../models/Workspace.mjs";
import WorkspaceMember from "../models/WorkspaceMember.mjs";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

const createNoteSchema = z.object({
    title: z.string().trim().min(1, "Title is required").max(200, "Title must be 200 characters or fewer"),
    content: z.string().max(100000, "Content is too long").default("")
}).strict();

const updateNoteSchema = z.object({
    title: z.string().trim().min(1, "Title is required").max(200, "Title must be 200 characters or fewer").optional(),
    content: z.string().max(100000, "Content is too long").optional(),
    workspaceId: objectIdSchema.optional()
}).strict().refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
});

function sendFailure(res, status, messages) {
    const normalizedMessages = Array.isArray(messages) ? messages : [messages];
    return res.status(status).json({
        status: "failed",
        data: {},
        messages: normalizedMessages
    });
}

function validationMessages(result) {
    return result.error.issues.map((issue) => issue.message);
}

function serializeNote(note) {
    const value = note.toObject();
    const workspace = value.workspace;
    const populatedWorkspace = workspace && workspace.name;

    return {
        id: value._id.toString(),
        title: value.title,
        content: value.content,
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

    const canEdit = membership.role === "owner"
        || membership.role === "admin"
        || membership.access === "edit";

    return { workspace, canEdit };
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

async function getAllNotes(req, res) {
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

        const notes = await Note.find({
            workspace: { $in: workspaceIds },
            isDeleted: false
        })
            .sort({ updatedAt: -1 })
            .populate("workspace", "name");

        return res.status(200).json({
            status: "success",
            data: notes.map(serializeNote),
            messages: ["Notes fetched successfully"]
        });
    } catch (error) {
        console.error("ERROR: fetching notes", error);
        return sendFailure(res, 500, "Unable to fetch notes");
    }
}

async function getNote(req, res) {
    try {
        const parsedId = objectIdSchema.safeParse(req.params.id);
        if (!parsedId.success) {
            return sendFailure(res, 400, validationMessages(parsedId));
        }

        const note = await Note.findOne({ _id: parsedId.data, isDeleted: false });
        if (!note) {
            return sendFailure(res, 404, "Note not found");
        }

        const access = await getWorkspaceAccess(req.user._id, note.workspace);
        if (access.error) {
            return sendFailure(res, access.error.status, access.error.message);
        }

        await note.populate("workspace", "name");

        return res.status(200).json({
            status: "success",
            data: serializeNote(note),
            messages: ["Note fetched successfully"]
        });
    } catch (error) {
        console.error("ERROR: fetching note", error);
        return sendFailure(res, 500, "Unable to fetch the note");
    }
}

async function createNote(req, res) {
    try {
        const parsedWorkspaceId = objectIdSchema.safeParse(req.params.workspaceId);
        if (!parsedWorkspaceId.success) {
            return sendFailure(res, 400, validationMessages(parsedWorkspaceId));
        }

        const parsedBody = createNoteSchema.safeParse(req.body);
        if (!parsedBody.success) {
            return sendFailure(res, 400, validationMessages(parsedBody));
        }

        const access = await getWorkspaceAccess(req.user._id, parsedWorkspaceId.data);
        if (access.error) {
            return sendFailure(res, access.error.status, access.error.message);
        }
        if (!access.canEdit) {
            return sendFailure(res, 403, "You do not have permission to create notes in this workspace");
        }

        const note = await Note.create({
            ...parsedBody.data,
            user: req.user._id,
            workspace: access.workspace._id
        });

        await note.populate("workspace", "name");

        return res.status(201).json({
            status: "success",
            data: serializeNote(note),
            messages: ["Note created successfully"]
        });
    } catch (error) {
        console.error("ERROR: creating note", error);
        return sendFailure(res, 500, "Unable to create the note");
    }
}

async function updateNote(req, res) {
    try {
        const parsedId = objectIdSchema.safeParse(req.params.id);
        if (!parsedId.success) {
            return sendFailure(res, 400, validationMessages(parsedId));
        }

        const parsedBody = updateNoteSchema.safeParse(req.body);
        if (!parsedBody.success) {
            return sendFailure(res, 400, validationMessages(parsedBody));
        }

        const note = await Note.findOne({ _id: parsedId.data, isDeleted: false });
        if (!note) {
            return sendFailure(res, 404, "Note not found");
        }

        const currentAccess = await getWorkspaceAccess(req.user._id, note.workspace);
        if (currentAccess.error) {
            return sendFailure(res, currentAccess.error.status, currentAccess.error.message);
        }
        if (!currentAccess.canEdit) {
            return sendFailure(res, 403, "You do not have permission to update this note");
        }

        const { title, content, workspaceId } = parsedBody.data;

        if (workspaceId && workspaceId !== note.workspace.toString()) {
            const targetAccess = await getWorkspaceAccess(req.user._id, workspaceId);
            if (targetAccess.error) {
                return sendFailure(res, targetAccess.error.status, targetAccess.error.message);
            }
            if (!targetAccess.canEdit) {
                return sendFailure(res, 403, "You do not have permission to move this note to that workspace");
            }
            note.workspace = targetAccess.workspace._id;
        }

        if (title !== undefined) note.title = title;
        if (content !== undefined) note.content = content;

        await note.save();
        await note.populate("workspace", "name");

        return res.status(200).json({
            status: "success",
            data: serializeNote(note),
            messages: ["Note updated successfully"]
        });
    } catch (error) {
        console.error("ERROR: updating note", error);
        return sendFailure(res, 500, "Unable to update the note");
    }
}

async function deleteNote(req, res) {
    try {
        const parsedId = objectIdSchema.safeParse(req.params.id);
        if (!parsedId.success) {
            return sendFailure(res, 400, validationMessages(parsedId));
        }

        const note = await Note.findOne({ _id: parsedId.data, isDeleted: false });
        if (!note) {
            return sendFailure(res, 404, "Note not found");
        }

        const access = await getWorkspaceAccess(req.user._id, note.workspace);
        if (access.error) {
            return sendFailure(res, access.error.status, access.error.message);
        }
        if (!access.canEdit) {
            return sendFailure(res, 403, "You do not have permission to delete this note");
        }

        note.isDeleted = true;
        note.deletedAt = new Date();
        await note.save();

        return res.sendStatus(204);
    } catch (error) {
        console.error("ERROR: deleting note", error);
        return sendFailure(res, 500, "Unable to delete the note");
    }
}

export {
    getAllNotes,
    getNote,
    createNote,
    updateNote,
    deleteNote
};
