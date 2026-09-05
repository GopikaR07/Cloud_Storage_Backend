const express = require("express");

const {
    register,
    login,
    getMe,
    findUserByEmail,
} = require("../controllers/authController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);

router.post("/logout", authMiddleware, (req, res) => {
    // JWTs are stored client-side in this project. The frontend removes the
    // token on logout; the protected route prevents unauthenticated logout calls.
    res.json({
        message: "Logout successful",
    });
});

router.get("/me", authMiddleware, getMe);
router.get("/by-email", authMiddleware, findUserByEmail);

module.exports = router;
