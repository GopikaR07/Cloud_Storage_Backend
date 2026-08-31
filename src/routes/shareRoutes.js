const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
    createShare,
    getSharedFiles,
    getResourceShares,
    updateShare,
    deleteShare,
    createPublicLink,
    getPublicLinks,
    deletePublicLink
} = require("../controllers/shareController");

const router = express.Router();


// =====================================================
// User-to-user sharing
// =====================================================

router.post(
    "/",
    authMiddleware,
    createShare
);

router.get(
    "/",
    authMiddleware,
    getSharedFiles
);


// Get people who have access
router.get(
    "/:resourceType/:resourceId",
    authMiddleware,
    getResourceShares
);


// Change Viewer / Editor
router.put(
    "/:id",
    authMiddleware,
    updateShare
);


// Revoke user access
router.delete(
    "/:id",
    authMiddleware,
    deleteShare
);


// =====================================================
// Public links
// =====================================================

router.post(
    "/link",
    authMiddleware,
    createPublicLink
);

router.get(
    "/link/:resourceType/:resourceId",
    authMiddleware,
    getPublicLinks
);

router.delete(
    "/link/:id",
    authMiddleware,
    deletePublicLink
);


module.exports = router;