const express = require("express");
const multer = require("multer");

const authMiddleware = require("../middleware/authMiddleware");

const {
    uploadFile,
    getFile,
    renameFile,
    moveFile,
    deleteFile
} = require("../controllers/fileController");

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage()
});

router.post(
    "/upload",
    authMiddleware,
    upload.single("file"),
    uploadFile
);

router.get("/:id", authMiddleware, getFile);

router.patch("/:id", authMiddleware, renameFile);

router.patch("/:id/move", authMiddleware, moveFile);

router.delete("/:id", authMiddleware, deleteFile);

module.exports = router;