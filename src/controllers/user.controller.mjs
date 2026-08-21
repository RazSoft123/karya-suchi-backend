function getUser(req, res) {
    return res.status(200).json({
        status: "success",
        data: {
            id: req.user._id,
            name: req.user.name,
            email: req.user.email
        },
        messages: ["User fetched successfully"]
    });

}

export { getUser };
