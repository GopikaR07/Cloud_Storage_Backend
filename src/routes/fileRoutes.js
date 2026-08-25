const express = require("express");
const multer = require("multer");

const authMiddleware = require("../middleware/authMiddleware");
const { uploadFile, getFile } = require("../controllers/fileController");

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage()
});

router.get("/:id", authMiddleware, getFile);

router.post(
    "/upload",
    authMiddleware,
    upload.single("file"),
    uploadFile
);

module.exports = router;