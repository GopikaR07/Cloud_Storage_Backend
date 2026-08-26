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

module.exports = {
    createShare
};