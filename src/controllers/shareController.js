const pool = require("../config/db");

const createShare = async (req, res) => {
    try {
        const {
            resourceType,
            resourceId,
            granteeUserId,
            role
        } = req.body;

        const userId = req.user.userId;

        if (!resourceType || !resourceId || !granteeUserId || !role) {
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

        const result = await pool.query(
            `INSERT INTO shares
            (resource_type, resource_id, grantee_user_id, role, created_by)
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

        res.status(201).json({
            message: "Resource shared successfully",
            share: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to share resource"
        });
    }
};

const getSharedFiles = async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await pool.query(
            `SELECT
                f.*,
                s.role,
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

module.exports = {
    createShare,
    getSharedFiles
};