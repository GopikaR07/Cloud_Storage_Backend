const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
    searchFiles
} = require("../controllers/searchController");

const router = express.Router();

router.get("/", authMiddleware, searchFiles);

module.exports = router;
