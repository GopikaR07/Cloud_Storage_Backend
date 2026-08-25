const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const { createFolder,getFolders,renameFolder, deleteFolder } = require("../controllers/folderController");

const router = express.Router();

router.post("/", authMiddleware, createFolder);
router.get("/", authMiddleware, getFolders);
router.patch("/:id", authMiddleware, renameFolder);
router.delete("/:id", authMiddleware, deleteFolder);

module.exports = router;