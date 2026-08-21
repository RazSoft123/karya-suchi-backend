import mongoose from "mongoose";

const workspaceSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 100
    },

    description: {
        type: String,
        default: "",
        trim: true,
        maxlength: 2000
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

workspaceSchema.index({ owner: 1, isDeleted: 1 });

const Workspace = mongoose.model('Workspace', workspaceSchema);

export default Workspace;
