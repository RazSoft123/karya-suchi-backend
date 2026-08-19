import dotenv from "dotenv";
import express from "express";
import { connectDB, disconnectDB } from "./config/db.mjs";
import { apiRoutes } from "./routes/api.routes.mjs";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import cors from "cors"

dotenv.config();

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: process.env.CROSS_ORIGIN,
    credentials: true
}));
app.use(morgan('dev'));

// Basic routes
app.get("/ping", (req, res) => {
    res.status(200).json({
        status: "success",
        message: "server is running"
    })
});

// API endpoint routes for version 1
app.use("/api/v1", apiRoutes);

// Send a 404 response for default route
app.get("/", (req, res) => {
    res.status(404).json({
        status: "failed",
        message: "route not defiend"
    })
});

const HOST = process.env.HOST || "127.0.0.1";
const PORT = process.env.PORT || "8000";

// connecting to database
connectDB();

const server = app.listen(PORT, HOST, () => {
    console.log(`SERVER: started\n HOST: ${HOST}\n PORT: ${PORT} \n LINK: http://${HOST}:${PORT}`);
});

// Closing connection to database when server closes
process.on('SIGINT', async () => {
    console.log('\nClosing server...');
    server.close();
    await disconnectDB();
    process.exit(0);
});
