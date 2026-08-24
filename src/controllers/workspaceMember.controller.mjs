import { z } from "zod";
import User from "../models/User.mjs";
import Workspace from "../models/Workspace.mjs";
import WorkspaceMember from "../models/WorkspaceMember.mjs";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const addMemberSchema = z.object({
    email: z.string().trim().toLowerCase().email("A valid email address is required"),
    access: z.enum(["view", "edit"]).default("view")
}).strict();
const updateAccessSchema = z.object({
    access: z.enum(["view", "edit"])
}).strict();

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

async function getOwnedWorkspace(user, workspaceId) {
    const workspace = await Workspace.findOne({
        _id: workspaceId,
        isDeleted: false
    });

    if (!workspace) {
        return { error: { status: 404, message: "Workspace not found" } };
    }

    if (!workspace.owner.equals(user._id)) {
        return {
            error: {
                status: 403,
                message: "Only the workspace owner can manage members"
            }
        };
    }

    return { workspace };
}

function serializeMember(membership) {
    return {
        id: membership._id.toString(),
        userId: membership.member._id.toString(),
        name: membership.member.name,
        email: membership.member.email,
        role: membership.role,
        access: membership.access === "edit" ? "edit" : "view",
        isOwner: false,
        createdAt: membership.createdAt,
        updatedAt: membership.updatedAt
    };
}

async function getWorkspaceMembers(req, res) {
    try {
        const parsedWorkspaceId = objectIdSchema.safeParse(req.params.workspaceId);
        if (!parsedWorkspaceId.success) {
            return sendFailure(res, 400, validationMessages(parsedWorkspaceId));
        }

        const access = await getOwnedWorkspace(req.user, parsedWorkspaceId.data);
        if (access.error) {
            return sendFailure(res, access.error.status, access.error.message);
        }

        const [owner, memberships] = await Promise.all([
            User.findById(access.workspace.owner).select("name email"),
            WorkspaceMember.find({ workspace: access.workspace._id })
                .sort({ createdAt: 1 })
                .populate("member", "name email")
        ]);

        const members = memberships
            .filter((membership) => membership.member)
            .map(serializeMember);

        return res.status(200).json({
            status: "success",
            data: [
                {
                    id: `owner-${access.workspace._id}`,
                    userId: owner._id.toString(),
                    name: owner.name,
                    email: owner.email,
                    role: "owner",
                    access: "edit",
                    isOwner: true
                },
                ...members
            ],
            messages: ["Workspace members fetched successfully"]
        });
    } catch (error) {
        console.error("ERROR: fetching workspace members", error);
        return sendFailure(res, 500, "Unable to fetch workspace members");
    }
}

async function addWorkspaceMember(req, res) {
    try {
        const parsedWorkspaceId = objectIdSchema.safeParse(req.params.workspaceId);
        if (!parsedWorkspaceId.success) {
            return sendFailure(res, 400, validationMessages(parsedWorkspaceId));
        }

        const parsedBody = addMemberSchema.safeParse(req.body);
        if (!parsedBody.success) {
            return sendFailure(res, 400, validationMessages(parsedBody));
        }

        const access = await getOwnedWorkspace(req.user, parsedWorkspaceId.data);
        if (access.error) {
            return sendFailure(res, access.error.status, access.error.message);
        }

        const memberUser = await User.findOne({ email: parsedBody.data.email });
        if (!memberUser) {
            return sendFailure(
                res,
                404,
                "No registered user was found with this email address"
            );
        }

        if (access.workspace.owner.equals(memberUser._id)) {
            return sendFailure(res, 400, "The workspace owner is already a member");
        }

        const existingMembership = await WorkspaceMember.findOne({
            workspace: access.workspace._id,
            member: memberUser._id
        });
        if (existingMembership) {
            return sendFailure(res, 409, "This user is already a workspace member");
        }

        const membership = await WorkspaceMember.create({
            workspace: access.workspace._id,
            member: memberUser._id,
            role: "member",
            access: parsedBody.data.access
        });
        await membership.populate("member", "name email");

        return res.status(201).json({
            status: "success",
            data: serializeMember(membership),
            messages: ["Workspace member added successfully"]
        });
    } catch (error) {
        if (error?.code === 11000) {
            return sendFailure(res, 409, "This user is already a workspace member");
        }
        console.error("ERROR: adding workspace member", error);
        return sendFailure(res, 500, "Unable to add the workspace member");
    }
}

async function updateWorkspaceMember(req, res) {
    try {
        const parsedWorkspaceId = objectIdSchema.safeParse(req.params.workspaceId);
        const parsedMembershipId = objectIdSchema.safeParse(req.params.membershipId);
        if (!parsedWorkspaceId.success || !parsedMembershipId.success) {
            const result = !parsedWorkspaceId.success
                ? parsedWorkspaceId
                : parsedMembershipId;
            return sendFailure(res, 400, validationMessages(result));
        }

        const parsedBody = updateAccessSchema.safeParse(req.body);
        if (!parsedBody.success) {
            return sendFailure(res, 400, validationMessages(parsedBody));
        }

        const access = await getOwnedWorkspace(req.user, parsedWorkspaceId.data);
        if (access.error) {
            return sendFailure(res, access.error.status, access.error.message);
        }

        const membership = await WorkspaceMember.findOne({
            _id: parsedMembershipId.data,
            workspace: access.workspace._id
        });
        if (!membership) {
            return sendFailure(res, 404, "Workspace member not found");
        }

        membership.access = parsedBody.data.access;
        await membership.save();
        await membership.populate("member", "name email");

        return res.status(200).json({
            status: "success",
            data: serializeMember(membership),
            messages: ["Workspace member access updated successfully"]
        });
    } catch (error) {
        console.error("ERROR: updating workspace member", error);
        return sendFailure(res, 500, "Unable to update the workspace member");
    }
}

async function removeWorkspaceMember(req, res) {
    try {
        const parsedWorkspaceId = objectIdSchema.safeParse(req.params.workspaceId);
        const parsedMembershipId = objectIdSchema.safeParse(req.params.membershipId);
        if (!parsedWorkspaceId.success || !parsedMembershipId.success) {
            const result = !parsedWorkspaceId.success
                ? parsedWorkspaceId
                : parsedMembershipId;
            return sendFailure(res, 400, validationMessages(result));
        }

        const access = await getOwnedWorkspace(req.user, parsedWorkspaceId.data);
        if (access.error) {
            return sendFailure(res, access.error.status, access.error.message);
        }

        const membership = await WorkspaceMember.findOneAndDelete({
            _id: parsedMembershipId.data,
            workspace: access.workspace._id
        });
        if (!membership) {
            return sendFailure(res, 404, "Workspace member not found");
        }

        return res.sendStatus(204);
    } catch (error) {
        console.error("ERROR: removing workspace member", error);
        return sendFailure(res, 500, "Unable to remove the workspace member");
    }
}

export {
    getWorkspaceMembers,
    addWorkspaceMember,
    updateWorkspaceMember,
    removeWorkspaceMember
};
