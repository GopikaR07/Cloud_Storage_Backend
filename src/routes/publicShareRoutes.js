const express = require("express");

const {
    getPublicLink,
    verifyPublicLinkPassword
} = require("../controllers/shareController");

const router = express.Router();


// Get public link information
router.get(
    "/:token",
    getPublicLink
);


// Verify password
router.post(
    "/:token/verify",
    verifyPublicLinkPassword
);


module.exports = router;