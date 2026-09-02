const express = require("express");
const multer = require("multer");
const authMiddleware = require("../middleware/authMiddleware");

const {
    getVersions,
    uploadVersion,
    downloadVersion,
    restoreVersion
} = require("../controllers/versionController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/:fileId", authMiddleware, getVersions);
router.post("/:fileId", authMiddleware, upload.single("file"), uploadVersion);
router.get("/:fileId/:versionId/download", authMiddleware, downloadVersion);
router.patch("/:fileId/:versionId/restore", authMiddleware, restoreVersion);

module.exports = router;
