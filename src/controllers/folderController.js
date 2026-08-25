const pool = require("../config/db");

const createFolder = async (req, res) => {
    try {
        const { name, parentId } = req.body;
        const userId = req.user.userId;

        if (!name) {
            return res.status(400).json({
                message: "Folder name is required"
            });
        }

        const result = await pool.query(
            `INSERT INTO folders (name, owner_id, parent_id)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [name, userId, parentId || null]
        );

        res.status(201).json({
            message: "Folder created successfully",
            folder: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to create folder"
        });
    }
};

const getFolders = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { parentId } = req.query;

        const result = await pool.query(
            `SELECT *
             FROM folders
             WHERE owner_id = $1
             AND is_deleted = false
             AND parent_id IS NOT DISTINCT FROM $2
             ORDER BY name ASC`,
            [userId, parentId || null]
        );

        res.json({
            folders: result.rows
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to fetch folders"
        });
    }
};

const renameFolder = async (req, res) => {
    try {
        const { name } = req.body;
        const folderId = req.params.id;
        const userId = req.user.userId;

        if (!name) {
            return res.status(400).json({
                message: "Folder name is required"
            });
        }

        const result = await pool.query(
            `UPDATE folders
             SET name = $1, updated_at = now()
             WHERE id = $2
             AND owner_id = $3
             AND is_deleted = false
             RETURNING *`,
            [name, folderId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Folder not found"
            });
        }

        res.json({
            message: "Folder renamed successfully",
            folder: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to rename folder"
        });
    }
};


const deleteFolder = async (req, res) => {
    try {
        const folderId = req.params.id;
        const userId = req.user.userId;

        const result = await pool.query(
            `UPDATE folders
             SET is_deleted = true,
                 updated_at = now()
             WHERE id = $1
             AND owner_id = $2
             AND is_deleted = false
             RETURNING *`,
            [folderId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Folder not found"
            });
        }

        res.json({
            message: "Folder moved to trash",
            folder: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to delete folder"
        });
    }
};

module.exports = {
    createFolder,
    getFolders,
    renameFolder,
    deleteFolder
};