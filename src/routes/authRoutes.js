const express = require("express");

const {
    register,
    login,
    getMe,
    findUserByEmail,
    getUserByEmail
} = require("../controllers/authController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);

router.post("/logout", (req, res) => {
    res.json({
        message: "Logout successful"
    });
});

router.get("/me", authMiddleware, getMe);
router.get(
    "/by-email",
    authMiddleware,
    findUserByEmail
);

router.get(
    "/by-email",
    authMiddleware,
    getUserByEmail
);

module.exports = router;