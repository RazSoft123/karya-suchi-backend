import mongoose from "mongoose";

const notesSchema = new mongoose.Schema({
    title: {
        type: String,
        default: "Untitled",
        trim: true,
        maxlength: 200
    },

    content: {
        type: String,
        default: ""
    },

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true,
        index: true
    },

    workspace: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Workspace",
        required: true,
        index: true
    },

    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },

    deletedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

notesSchema.index({ workspace: 1, updatedAt: -1 });

const Note = mongoose.model("Note", notesSchema);
export default Note;
