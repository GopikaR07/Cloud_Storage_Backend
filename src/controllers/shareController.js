const pool = require("../config/db");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const supabase = require("../config/supabase");

const FRONTEND_URL =
    process.env.FRONTEND_URL || "http://localhost:5173";


// =====================================================
// Helper: Check whether current user owns the resource
// =====================================================

const checkResourceOwner = async (
    userId,
    resourceType,
    resourceId
) => {

    let result;

    if (resourceType === "file") {

        result = await pool.query(
            `SELECT id
             FROM files
             WHERE id = $1
               AND owner_id = $2
               AND is_deleted = false`,
            [resourceId, userId]
        );

    } else {

        result = await pool.query(
            `SELECT id
             FROM folders
             WHERE id = $1
               AND owner_id = $2
               AND is_deleted = false`,
            [resourceId, userId]
        );
    }

    return result.rows.length > 0;
};


// =====================================================
// Share resource with another registered user
// =====================================================

const createShare = async (req, res) => {

    try {

        const {
            resourceType,
            resourceId,
            granteeUserId,
            role
        } = req.body;

        const userId = req.user.userId;

        if (
            !resourceType ||
            !resourceId ||
            !granteeUserId ||
            !role
        ) {
            return res.status(400).json({
                message: "All sharing fields are required"
            });
        }

        if (!["file", "folder"].includes(resourceType)) {
            return res.status(400).json({
                message: "Invalid resource type"
            });
        }

        if (!["viewer", "editor"].includes(role)) {
            return res.status(400).json({
                message: "Invalid role"
            });
        }

        // Check that current user owns resource
        const isOwner = await checkResourceOwner(
            userId,
            resourceType,
            resourceId
        );

        if (!isOwner) {
            return res.status(403).json({
                message: "You do not have permission to share this resource"
            });
        }

        // Prevent sharing with yourself
        if (String(granteeUserId) === String(userId)) {
            return res.status(400).json({
                message: "You cannot share a resource with yourself"
            });
        }

        // Check that target user exists
        const userResult = await pool.query(
            `SELECT id, email, name
             FROM users
             WHERE id = $1`,
            [granteeUserId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        // Check whether already shared
        const existing = await pool.query(
            `SELECT id
             FROM shares
             WHERE resource_type = $1
               AND resource_id = $2
               AND grantee_user_id = $3`,
            [
                resourceType,
                resourceId,
                granteeUserId
            ]
        );

        let result;

        if (existing.rows.length > 0) {

            // Update existing permission
            result = await pool.query(
                `UPDATE shares
                 SET role = $1
                 WHERE id = $2
                 RETURNING *`,
                [
                    role,
                    existing.rows[0].id
                ]
            );

        } else {

            // Create new share
            result = await pool.query(
                `INSERT INTO shares
                (
                    resource_type,
                    resource_id,
                    grantee_user_id,
                    role,
                    created_by
                )
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *`,
                [
                    resourceType,
                    resourceId,
                    granteeUserId,
                    role,
                    userId
                ]
            );
        }

        res.status(201).json({
            message: "Resource shared successfully",
            share: result.rows[0]
        });

    } catch (error) {

        console.error(
            "Create share error:",
            error
        );

        res.status(500).json({
            message: "Failed to share resource"
        });
    }
};


// =====================================================
// Get files shared with current user
// =====================================================

const getSharedFiles = async (req, res) => {

    try {

        const userId = req.user.userId;

        const result = await pool.query(
            `SELECT
                f.*,
                s.role,
                s.id AS share_id,
                s.created_at AS shared_at,
                u.email AS shared_by_email,
                u.name AS shared_by_name
             FROM shares s
             JOIN files f
               ON s.resource_id = f.id
             JOIN users u
               ON s.created_by = u.id
             WHERE s.grantee_user_id = $1
               AND s.resource_type = 'file'
               AND f.is_deleted = false
             ORDER BY s.created_at DESC`,
            [userId]
        );

        res.json({
            files: result.rows
        });

    } catch (error) {

        console.error(
            "Get shared files error:",
            error
        );

        res.status(500).json({
            message: "Failed to fetch shared files"
        });
    }
};


// =====================================================
// Get people who have access to a resource
// =====================================================

const getResourceShares = async (req, res) => {

    try {

        const {
            resourceType,
            resourceId
        } = req.params;

        const userId = req.user.userId;

        if (!["file", "folder"].includes(resourceType)) {
            return res.status(400).json({
                message: "Invalid resource type"
            });
        }

        const isOwner = await checkResourceOwner(
            userId,
            resourceType,
            resourceId
        );

        if (!isOwner) {
            return res.status(403).json({
                message: "You do not have permission to view these shares"
            });
        }

        const result = await pool.query(
            `SELECT
                s.id,
                s.resource_type,
                s.resource_id,
                s.grantee_user_id,
                s.role,
                s.created_at,
                u.email,
                u.name
             FROM shares s
             JOIN users u
               ON s.grantee_user_id = u.id
             WHERE s.resource_type = $1
               AND s.resource_id = $2
             ORDER BY s.created_at DESC`,
            [
                resourceType,
                resourceId
            ]
        );

        res.json({
            shares: result.rows
        });

    } catch (error) {

        console.error(
            "Get resource shares error:",
            error
        );

        res.status(500).json({
            message: "Failed to fetch shares"
        });
    }
};


// =====================================================
// Change Viewer / Editor permission
// =====================================================

const updateShare = async (req, res) => {

    try {

        const { id } = req.params;
        const { role } = req.body;

        const userId = req.user.userId;

        if (!["viewer", "editor"].includes(role)) {
            return res.status(400).json({
                message: "Invalid role"
            });
        }

        const shareResult = await pool.query(
            `SELECT *
             FROM shares
             WHERE id = $1`,
            [id]
        );

        if (shareResult.rows.length === 0) {
            return res.status(404).json({
                message: "Share not found"
            });
        }

        const share = shareResult.rows[0];

        const isOwner = await checkResourceOwner(
            userId,
            share.resource_type,
            share.resource_id
        );

        if (!isOwner) {
            return res.status(403).json({
                message: "You do not have permission to modify this share"
            });
        }

        const result = await pool.query(
            `UPDATE shares
             SET role = $1
             WHERE id = $2
             RETURNING *`,
            [
                role,
                id
            ]
        );

        res.json({
            message: "Permission updated successfully",
            share: result.rows[0]
        });

    } catch (error) {

        console.error(
            "Update share error:",
            error
        );

        res.status(500).json({
            message: "Failed to update permission"
        });
    }
};


// =====================================================
// Revoke user access
// =====================================================

const deleteShare = async (req, res) => {

    try {

        const { id } = req.params;

        const userId = req.user.userId;

        const shareResult = await pool.query(
            `SELECT *
             FROM shares
             WHERE id = $1`,
            [id]
        );

        if (shareResult.rows.length === 0) {
            return res.status(404).json({
                message: "Share not found"
            });
        }

        const share = shareResult.rows[0];

        const isOwner = await checkResourceOwner(
            userId,
            share.resource_type,
            share.resource_id
        );

        if (!isOwner) {
            return res.status(403).json({
                message: "You do not have permission to revoke this share"
            });
        }

        await pool.query(
            `DELETE FROM shares
             WHERE id = $1`,
            [id]
        );

        res.json({
            message: "Share revoked successfully"
        });

    } catch (error) {

        console.error(
            "Delete share error:",
            error
        );

        res.status(500).json({
            message: "Failed to revoke share"
        });
    }
};


// =====================================================
// Create public shareable link
// =====================================================

const createPublicLink = async (req, res) => {

    try {

        const {
            resourceType,
            resourceId,
            expiresIn,
            password
        } = req.body;

        const userId = req.user.userId;

        if (!resourceType || !resourceId) {
            return res.status(400).json({
                message: "Resource type and resource ID are required"
            });
        }

        if (!["file", "folder"].includes(resourceType)) {
            return res.status(400).json({
                message: "Invalid resource type"
            });
        }

        const isOwner = await checkResourceOwner(
            userId,
            resourceType,
            resourceId
        );

        if (!isOwner) {
            return res.status(403).json({
                message: "You do not have permission to create a public link"
            });
        }

        // Generate secure random token
        const token = crypto.randomBytes(32).toString("hex");

        let expiresAt = null;

        if (expiresIn) {

            const days = Number(expiresIn);

            if (![1, 7, 30].includes(days)) {
                return res.status(400).json({
                    message: "Invalid expiry period"
                });
            }

            expiresAt = new Date(
                Date.now() + days * 24 * 60 * 60 * 1000
            );
        }

        let passwordHash = null;

        if (password && password.trim() !== "") {

            passwordHash = await bcrypt.hash(
                password,
                10
            );
        }

        const result = await pool.query(
            `INSERT INTO link_shares
            (
                resource_type,
                resource_id,
                token,
                role,
                password_hash,
                expires_at,
                created_by
            )
            VALUES ($1, $2, $3, 'viewer', $4, $5, $6)
            RETURNING id,
                      resource_type,
                      resource_id,
                      token,
                      role,
                      expires_at,
                      created_at`,
            [
                resourceType,
                resourceId,
                token,
                passwordHash,
                expiresAt,
                userId
            ]
        );

        const link =
            `${FRONTEND_URL}/shared/${token}`;

        res.status(201).json({
            message: "Public link created successfully",
            link,
            share: result.rows[0]
        });

    } catch (error) {

        console.error(
            "Create public link error:",
            error
        );

        res.status(500).json({
            message: "Failed to create public link"
        });
    }
};


// =====================================================
// Get public links for a resource
// =====================================================

const getPublicLinks = async (req, res) => {

    try {

        const {
            resourceType,
            resourceId
        } = req.params;

        const userId = req.user.userId;

        const isOwner = await checkResourceOwner(
            userId,
            resourceType,
            resourceId
        );

        if (!isOwner) {
            return res.status(403).json({
                message: "You do not have permission to view public links"
            });
        }

        const result = await pool.query(
            `SELECT
                id,
                resource_type,
                resource_id,
                token,
                role,
                expires_at,
                created_at
             FROM link_shares
             WHERE resource_type = $1
               AND resource_id = $2
             ORDER BY created_at DESC`,
            [
                resourceType,
                resourceId
            ]
        );

        const links = result.rows.map(link => ({
            ...link,
            link:
                `${FRONTEND_URL}/shared/${link.token}`
        }));

        res.json({
            links
        });

    } catch (error) {

        console.error(
            "Get public links error:",
            error
        );

        res.status(500).json({
            message: "Failed to fetch public links"
        });
    }
};


// =====================================================
// Revoke public link
// =====================================================

const deletePublicLink = async (req, res) => {

    try {

        const { id } = req.params;

        const userId = req.user.userId;

        const result = await pool.query(
            `SELECT *
             FROM link_shares
             WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Public link not found"
            });
        }

        const linkShare = result.rows[0];

        const isOwner = await checkResourceOwner(
            userId,
            linkShare.resource_type,
            linkShare.resource_id
        );

        if (!isOwner) {
            return res.status(403).json({
                message: "You do not have permission to revoke this link"
            });
        }

        await pool.query(
            `DELETE FROM link_shares
             WHERE id = $1`,
            [id]
        );

        res.json({
            message: "Public link revoked successfully"
        });

    } catch (error) {

        console.error(
            "Delete public link error:",
            error
        );

        res.status(500).json({
            message: "Failed to revoke public link"
        });
    }
};


// =====================================================
// Public link information
// =====================================================

const getPublicLink = async (req, res) => {

    try {

        const { token } = req.params;

        const result = await pool.query(
            `SELECT
                ls.id,
                ls.resource_type,
                ls.resource_id,
                ls.token,
                ls.password_hash,
                ls.expires_at,
                f.name AS file_name,
                f.storage_key
             FROM link_shares ls
             LEFT JOIN files f
               ON ls.resource_type = 'file'
              AND ls.resource_id = f.id
             WHERE ls.token = $1`,
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Public link not found"
            });
        }

        const link = result.rows[0];

        // Check expiry
        if (
            link.expires_at &&
            new Date(link.expires_at) < new Date()
        ) {
            return res.status(410).json({
                message: "This public link has expired"
            });
        }

        const requiresPassword = Boolean(link.password_hash);

        let downloadUrl = null;

        // Only hand out the download URL up front when there's no
        // password gate. Password-protected links get their URL from
        // verifyPublicLinkPassword instead.
        if (!requiresPassword && link.storage_key) {

            const { data, error } = await supabase
                .storage
                .from(process.env.SUPABASE_STORAGE_BUCKET)
                .createSignedUrl(link.storage_key, 300);

            if (!error) {
                downloadUrl = data.signedUrl;
            }
        }

        res.json({
            id: link.id,
            resourceType: link.resource_type,
            resourceId: link.resource_id,
            fileName: link.file_name,
            requiresPassword,
            expiresAt: link.expires_at,
            downloadUrl
        });

    } catch (error) {

        console.error(
            "Get public link error:",
            error
        );

        res.status(500).json({
            message: "Failed to access public link"
        });
    }
};


// =====================================================
// Verify public-link password
// =====================================================

const verifyPublicLinkPassword = async (req, res) => {

    try {

        const { token } = req.params;
        const { password } = req.body;

        const result = await pool.query(
            `SELECT
                ls.*,
                f.name AS file_name,
                f.storage_key
             FROM link_shares ls
             LEFT JOIN files f
               ON ls.resource_type = 'file'
              AND ls.resource_id = f.id
             WHERE ls.token = $1`,
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Public link not found"
            });
        }

        const link = result.rows[0];

        if (
            link.expires_at &&
            new Date(link.expires_at) < new Date()
        ) {
            return res.status(410).json({
                message: "This public link has expired"
            });
        }

        // If there's a password, it must be checked before we hand out
        // anything else.
        if (link.password_hash) {

            if (!password) {
                return res.status(400).json({
                    message: "Password is required"
                });
            }

            const valid = await bcrypt.compare(
                password,
                link.password_hash
            );

            if (!valid) {
                return res.status(401).json({
                    message: "Incorrect password"
                });
            }
        }

        let downloadUrl = null;

        if (link.storage_key) {

            const { data, error } = await supabase
                .storage
                .from(process.env.SUPABASE_STORAGE_BUCKET)
                .createSignedUrl(link.storage_key, 300);

            if (!error) {
                downloadUrl = data.signedUrl;
            }
        }

        res.json({
            valid: true,
            fileName: link.file_name,
            downloadUrl
        });

    } catch (error) {

        console.error(
            "Verify public link password error:",
            error
        );

        res.status(500).json({
            message: "Failed to verify password"
        });
    }
};


module.exports = {
    createShare,
    getSharedFiles,
    getResourceShares,
    updateShare,
    deleteShare,
    createPublicLink,
    getPublicLinks,
    deletePublicLink,
    getPublicLink,
    verifyPublicLinkPassword
};