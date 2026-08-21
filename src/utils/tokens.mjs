// Utility function to generate the new JWT Token and Refresh Token
import jwt from "jsonwebtoken";

function cookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production" || process.env.NODE_ENV === "prod",
        sameSite: "strict"
    };
}

function accessTokenMaxAge() {
    return Number(process.env.ACCESS_TOKEN_MAX_AGE) || 15 * 60 * 1000;
}

function refreshTokenMaxAge() {
    return Number(process.env.REFRESH_TOKEN_MAX_AGE) || 7 * 24 * 60 * 60 * 1000;
}

// add system to generate new access token
function generateAccessToken(payload) {

    const jwtToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_TIMEOUT })
    return jwtToken;

}

// add system to genreate new refresh token
function generateRefreshToken(payload) {

    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_TIMEOUT })
    return refreshToken;

}

// add system to new token in response object http only cookies
function setNewTokens(res, jwtToken, refreshToken) {
    setAccessToken(res, jwtToken);

    res.cookie("refreshToken", refreshToken, {
        ...cookieOptions(),
        maxAge: refreshTokenMaxAge()
    });
}

function setAccessToken(res, jwtToken) {
    res.cookie("accessToken", jwtToken, {
        ...cookieOptions(),
        maxAge: accessTokenMaxAge()
    });
}

function clearTokens(res) {
    const options = cookieOptions();
    res.clearCookie("accessToken", options);
    res.clearCookie("refreshToken", options);
}

export {
    generateAccessToken,
    generateRefreshToken,
    setNewTokens,
    setAccessToken,
    clearTokens
}
