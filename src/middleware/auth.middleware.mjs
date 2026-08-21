import jwt from "jsonwebtoken";
import User from "../models/User.mjs";

function sendUnauthorized(res, message) {
    return res.status(401).json({
        status: "failed",
        data: {},
        message
    });
}

async function authUser(req, res, next) {
    try {
        const accessToken = req.cookies?.accessToken;

        if (!accessToken) {
            return sendUnauthorized(res, "Authentication token missing");
        }

        let payload;
        try {
            payload = jwt.verify(accessToken, process.env.JWT_SECRET);
        } catch (error) {
            const message = error.name === "TokenExpiredError"
                ? "Authentication token expired"
                : "Invalid authentication token";
            return sendUnauthorized(res, message);
        }

        const user = await User.findById(payload.id);
        if (!user) {
            return sendUnauthorized(res, "Authenticated user no longer exists");
        }

        req.user = user;
        return next();
    } catch (error) {
        console.error("ERROR: authenticating user", error);
        return res.status(500).json({
            status: "failed",
            data: {},
            message: "Unable to authenticate the user"
        });
    }
}

export {
    authUser
}
