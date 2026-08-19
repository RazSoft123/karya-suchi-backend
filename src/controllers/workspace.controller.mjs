import Workspace from "./../models/Workspace.mjs";
import WorkspaceMember from "../models/WorkspaceMember.mjs";

// add system to get all workspace related to a user
async function getAllWorkspaces(req, res) {
    const user = req.user;

    const memberWorkspaceIds = await WorkspaceMember.find({
        member: user._id
    }).distinct("workspace");

    const workspaces = await Workspace.find({
        isDeleted: false,
        $or: [
            { owner: user._id },
            { _id: { $in: memberWorkspaceIds } }
        ]
    });

    if (workspaces.length === 0) {
        return res.status(200).json({
            status: "success",
            data: [],
            message: "No workspace for the user create one first"
        })
    }

    return res.status(200).json({
        status: "success",
        data: workspaces,
        length: workspaces.length,
        message: "Work space fetch successful"
    })

}

// Add system to get a single workspace details
async function getWorkspace(req, res) {
    const user = req.user;
    const { id } = req.params;

    const workspace = await Workspace.findOne({ _id: id, isDeleted: false });

    if (!workspace) {
        return res.status(404).json({
            status: "failed",
            data: {},
            message: "No, workspace with this id"
        })
    }

    if (!workspace.owner.equals(user._id)) {

        const workspaceMember = await WorkspaceMember.findOne({
            member: user._id,
            workspace: workspace._id
        })

        if (!workspaceMember) {
            return res.status(401).json({
                status: 'failed',
                data: {},
                message: "You don't have access to this workspace"
            })
        }
    }

    return res.status(200).json({
        status: "success",
        data: workspace,
        message: "Successfully get the workspace"
    })
}

// add system to create a new workspace
async function createWorkspace(req, res) {
    let { name, description } = req.body
    const user = req.user;

    name = name.trim().toLowerCase();
    if (typeof description === "string")
        description = description.trim();

    const workspace = await Workspace.create({
        name: name,
        description: description,
        owner: user._id,
    })

    return res.status(200).json({
        status: "success",
        data: workspace,
        message: "Workspace created successfully"
    })
}

// add system to update workspace
async function updateWorkspace(req, res) {

    const user = req.user;
    const { name, description } = req.body;
    const { id } = req.params;

    const workspace = await Workspace.findOne({ _id: id, isDeleted: false });
    if (!workspace) {
        return res.status(404).json({
            status: "success",
            data: {},
            message: "No, workspace with this id"
        })
    }

    if (!workspace.owner.equals(user._id)) {
        return res.status(401).json({
            status: "failed",
            data: {},
            message: "You don't have access to update this workspace"
        })
    }

    workspace.name = name;
    workspace.description = description;

    const updatedWorksapce = await workspace.save();
    return res.status(200).json({
        status: "success",
        data: updatedWorksapce,
        message: "Workspaces updated successfully"
    })

}

// add system to soft delete a workspace
async function deleteWorkspace(req, res) {
    const user = req.user;
    const { id } = req.params;

    const workspace = await Workspace.findOne({ _id: id, isDeleted: false });

    if (!workspace) {
        return res.status(404).json({
            status: "failed",
            data: {},
            message: "No, workspace with this id"
        })
    }

    if (!workspace.owner.equals(user._id)) {
        return res.status(401).json({
            status: "failed",
            data: {},
            message: "You don't have access to delete this workspace"
        })
    }

    workspace.isDeleted = true;
    workspace.deletedAt = new Date();

    await workspace.save();

    return res.sendStatus(204);
}


export {
    getAllWorkspaces,
    getWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace
}
