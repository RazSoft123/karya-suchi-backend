import mongoose from "mongoose";

const workspaceMemberSchema = mongoose.Schema({

    workspace: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Workspace",
        required: true
    },

    member: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    role: {
        type: String,
        enum: ["owner", "admin", "member"],
        default: "member"
    },

    access: {
        type: String,
        enum: ["view", "comment", "edit"],
        default: "edit"
    }
}, {
    timestamps: true
})

workspaceMemberSchema.index({ workspace: 1, member: 1 }, { unique: true });

const WorkspaceMember = mongoose.model("WorkspaceMember", workspaceMemberSchema);

export default WorkspaceMember;
