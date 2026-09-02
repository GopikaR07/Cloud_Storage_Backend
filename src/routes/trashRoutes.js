const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

const {
    getTrash,
    restoreFile,
    permanentlyDeleteFile,
    restoreFolder,
    permanentlyDeleteFolder
} = require("../controllers/trashController");

const router = express.Router();

router.get("/", authMiddleware, getTrash);
router.patch("/files/:id/restore", authMiddleware, restoreFile);
router.delete("/files/:id", authMiddleware, permanentlyDeleteFile);
router.patch("/folders/:id/restore", authMiddleware, restoreFolder);
router.delete("/folders/:id", authMiddleware, permanentlyDeleteFolder);

module.exports = router;
