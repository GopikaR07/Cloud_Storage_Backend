const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
    createShare,
    getSharedFiles
} = require("../controllers/shareController");

const router = express.Router();

router.post("/", authMiddleware, createShare);
router.get("/", authMiddleware, getSharedFiles);

module.exports = router;
