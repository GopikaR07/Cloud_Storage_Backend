const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
    createShare
} = require("../controllers/shareController");

const router = express.Router();

router.post("/", authMiddleware, createShare);

module.exports = router;
