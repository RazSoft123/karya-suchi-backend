
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { validateEmail, validateName, validatePassword } from "../utils/validations.mjs";
import User from "./../models/User.mjs";
import Workspace from "./../models/Workspace.mjs";

// controller to authenticate user and send a JSON web token as response
async function loginController(req, res) {
    try {
        const { email, password } = req.body;

        const correctEmail = validateEmail(email);

        const user = await User.findOne({ email: correctEmail });
        if (!user) {
            return res.status(400).json({
                status: "failed",
                data: {},
                messages: ["Inviled email or password"]
            })
        }

        // If user found varify the password
        const result = await bcrypt.compare(password, user.password);
        if (!result) {
            return res.status(401).json({
                status: "failed",
                data: {},
                messages: ["Inviled email or password"]
            })
        }

        // Create a JWT token and refresh token and 
        const token = await jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_TIMEOUT });
        const refreshToken = await jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_TIMEOUT });

        user.refreshToken = refreshToken;
        await user.save();

        res.cookie("accessToken", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV == 'prod' ? true : false,
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000
        })

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV == 'prod' ? true : false,
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        })

        return res.status(200).json({
            status: "success",
            data: {
                id: user._id,
                name: user.name,
                email: user.email
            },
            messages: ["user login successful"]
        })

    } catch (err) {
        console.log("ERROR: Error in loggin user: ", err);
        return res.status(500).json({
            status: "failed",
            data: {},
            messages: ["Error while logging user"]
        })
    }
}

// controller to implement the logout of the user
async function logoutController(req, res) {
    try {
        const refreshToken = req.cookies?.refreshToken;
        const result = await jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');

        if (!result) {
            return res.status(400).json({
                status: "failed",
                data: {},
                messages: ["Can't varify the token "]
            })
        }

        const user = await User.findById(result.id);
        user.refreshToken = null;
        await user.save();

        return res.status(204).json({
            status: "success",
            data: {},
            messages: ["Logout successful"]
        })
    } catch (err) {
        console.log("ERROR: JWT not varified ", err);
        return res.status(500).json({
            status: "failed",
            data: {},
            messages: ["Logout failed"]
        })
    }
}

// controller to register a user and send the JWT token as response
async function registerController(req, res) {
    try {
        const { email, name, password } = req.body;

        const correctName = validateName(name);
        const correctEmail = validateEmail(email);
        const validatedPassword = validatePassword(password);

        if (!correctName) {
            return res.status(400).json({
                status: "failed",
                messages: ["Name must contain only letters and spaces"],
                data: {}
            });
        }

        if (!correctEmail) {
            return res.status(400).json({
                status: "failed",
                messages: ["A valid email address is required"],
                data: {}
            });
        }

        if (!validatedPassword) {
            return res.status(400).json({
                status: "failed",
                messages: ["Password must be between 8 and 32 chars long", "Must contain a number, an uppercase and lowercase letter and a special character"],
                data: {}
            });
        }

        const user = await User.findOne({ email: correctEmail });
        if (user) {
            return res.status(409).json({
                status: "failed",
                messages: ["User with this email already exists"],
                data: {}
            });
        }

        // Preallocate both ids so the required relationship is valid before either document is saved.
        const hashPass = await bcrypt.hash(password, 12);

        const newUser = new User({
            name: correctName,
            email: correctEmail,
            password: hashPass
        });

        const defaultWorkspace = new Workspace({
            name: "personal",
            description: "Default personal workspace",
            owner: newUser._id
        });

        newUser.defaultWorkspace = defaultWorkspace._id;

        const token = jwt.sign(
            { id: newUser._id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_TIMEOUT }
        );
        const refreshToken = jwt.sign(
            { id: newUser._id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: process.env.JWT_REFRESH_TIMEOUT }
        );

        newUser.refreshToken = refreshToken;

        // Validate both documents before writing and roll back the workspace if user creation fails.
        await Promise.all([newUser.validate(), defaultWorkspace.validate()]);
        await defaultWorkspace.save();

        try {
            await newUser.save();
        } catch (error) {
            await Workspace.deleteOne({ _id: defaultWorkspace._id });
            throw error;
        }

        res.cookie("accessToken", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000
        })

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        })

        return res.status(201).json({
            status: "success",
            messages: ["User registration successful"],
            data: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                defaultWorkspace: {
                    id: defaultWorkspace._id,
                    name: defaultWorkspace.name
                }
            }
        });

    } catch (err) {
        console.log("ERROR: registering user \n", err);

        if (err?.code === 11000) {
            return res.status(409).json({
                status: "failed",
                messages: ["User with this email already exists"],
                data: {}
            });
        }

        return res.status(500).json({
            status: "failed",
            messages: ["Internal server error"],
            data: {}
        })
    }
}

// controller for generating new refresh token evry time the JWT expires
async function refreshController(req, res) {
    try {
        const refreshToken = req.cookies?.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({
                status: "failed",
                data: {},
                messages: ["Refresh token missing"]
            });
        }

        let decoded;

        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        } catch (err) {
            return res.status(401).json({
                status: "failed",
                data: {},
                messages: ["Invalid or expired refresh token"]
            });
        }

        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(404).json({
                status: "failed",
                data: {},
                messages: ["User not found"]
            });
        }

        if (user.refreshToken !== refreshToken) {
            return res.status(401).json({
                status: "failed",
                data: {},
                messages: ["Refresh token mismatch"]
            });
        }

        const newAccessToken = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );

        const newRefreshToken = jwt.sign(
            { id: user._id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: "7d" }
        );

        user.refreshToken = newRefreshToken;
        await user.save();

        res.cookie("accessToken", newAccessToken, {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            maxAge: 15 * 60 * 1000
        });

        res.cookie("refreshToken", newRefreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.status(200).json({
            status: "success",
            data: {},
            messages: ["Token refreshed successfully"]
        });

    } catch (err) {
        console.log("ERROR: failed in refresh token ", err);

        return res.status(500).json({
            status: "failed",
            data: {},
            messages: ["Internal server error"]
        });
    }
}


export {
    loginController,
    logoutController,
    registerController,
    refreshController,
}
