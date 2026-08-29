const express = require("express");
const multer = require("multer");

const authMiddleware = require("../middleware/authMiddleware");

const {
    getFiles,
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


/* =========================================================
   FILE LISTING
========================================================= */

// Root files
// GET /api/files

router.get(
    "/",
    authMiddleware,
    getFiles
);


/* =========================================================
   FILE UPLOAD
========================================================= */

router.post(
    "/upload",
    authMiddleware,
    upload.single("file"),
    uploadFile
);


/* =========================================================
   SINGLE FILE
========================================================= */

router.get(
    "/:id",
    authMiddleware,
    getFile
);


/* =========================================================
   RENAME
========================================================= */

router.patch(
    "/:id",
    authMiddleware,
    renameFile
);


/* =========================================================
   MOVE
========================================================= */

router.patch(
    "/:id/move",
    authMiddleware,
    moveFile
);


/* =========================================================
   DELETE
========================================================= */

router.delete(
    "/:id",
    authMiddleware,
    deleteFile
);


module.exports = router;