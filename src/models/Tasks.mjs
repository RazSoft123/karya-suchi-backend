import mongoose from "mongoose";

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },

    description: {
        type: String,
        default: "",
        maxlength: 10000
    },

    status: {
        type: String,
        enum: ["todo", "in_progress", "completed", "archived"],
        default: "todo",
        index: true
    },

    priority: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "medium"
    },

    dueDate: {
        type: Date,
        default: null
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
}, {
    timestamps: true
});

taskSchema.index({ workspace: 1, createdAt: -1 });

const Task = mongoose.model("Task", taskSchema);

export default Task;
