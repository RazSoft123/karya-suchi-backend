import mongoose from "mongoose";

const workspaceSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        min: 3,
        max: 255
    },

    description: {
        type: String,
        default: "",
        trim: true
    },

    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true,
    },

    isDeleted: {
        type: Boolean,
        default: false
    },

    deletedAt: Date,

}, {
    timestamps: true
});

const Workspace = mongoose.model('Workspace', workspaceSchema);

export default Workspace;
