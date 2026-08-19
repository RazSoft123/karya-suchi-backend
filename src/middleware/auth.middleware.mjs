import jwt from "jsonwebtoken";
import User from "../models/User.mjs";
import { generateAccessToken, generateRefreshToken, setNewTokens } from "../utils/tokens.mjs";

async function authUser(req, res, next) {
    try {
        const jwtToken = req.cookies?.accessToken;

        if (!jwtToken) {
            return res.status(401).json({
                status: "failed",
                data: {},
                message: "Authentication token missing"
            })
        }

        try {
            let payload = await jwt.verify(jwtToken, process.env.JWT_SECRET)
            let user = await User.findById(payload.id);
            if (!user) {
                return res.status(401).json({
                    status: "failed",
                    data: {},
                    message: "Authenticated user no longer exists"
                });
            }
            req.user = user;
            return next();

        } catch (err) {
            if (err.name !== "TokenExpiredError") {
                return res.status(401).json({
                    status: "failed",
                    data: {},
                    message: "Authentication error happen"
                })
            }

            const refreshToken = req.cookies?.refreshToken;
            if (!refreshToken) {
                return res.status(401).json({
                    status: "failed",
                    data: {},
                    message: "JWT expire and refresh token is missing"
                })
            }

            try {
                const decode = await jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

                let user = await User.findById(decode.id);
                if (!user) {
                    return res.status(400).json({
                        statu: "failed",
                        data: {},
                        message: "No user found with this token"
                    })
                }

                if (user.refreshToken !== refreshToken) {
                    return res.status(401).json({
                        status: "failed",
                        data: {},
                        message: "Refresh token does not match the active session"
                    });
                }

                const newJwtToken = generateAccessToken({ id: user._id });
                const newRefreshToken = generateRefreshToken({ id: user._id });

                user.refreshToken = newRefreshToken;
                await user.save();

                setNewTokens(res, newJwtToken, newRefreshToken);

                req.user = user;
                return next();

            } catch (err) {
                return res.status(401).json({
                    status: "failed",
                    data: {},
                    message: "Inviled refresh token or expire refresh token login again"
                })
            }
        }

    } catch (err) {
        return res.status(500).json({
            status: "failed",
            data: {},
            message: "Internal error happen"
        })
    }
}

export {
    authUser
}
