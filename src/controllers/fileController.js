const supabase = require("../config/supabase");
const pool = require("../config/db");


const getFiles = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { folderId } = req.query;

        const result = await pool.query(
            `SELECT *
             FROM files
             WHERE owner_id = $1
             AND is_deleted = false
             AND folder_id IS NOT DISTINCT FROM $2
             ORDER BY name ASC`,
            [
                userId,
                folderId || null
            ]
        );

        res.json({
            files: result.rows
        });

    } catch (error) {
        console.error("Get files error:", error);

        res.status(500).json({
            message: "Failed to fetch files"
        });
    }
};

const getFile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const fileId = req.params.id;

        const result = await pool.query(
            `SELECT *
             FROM files
             WHERE id = $1
             
             AND is_deleted = false`,
            [fileId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "File not found"
            });
        }

        const file = result.rows[0];

        const isOwner = file.owner_id === userId;

if (!isOwner) {
    const shareResult = await pool.query(
        `SELECT role
         FROM shares
         WHERE resource_type = 'file'
         AND resource_id = $1
         AND grantee_user_id = $2`,
        [fileId, userId]
    );

    if (shareResult.rows.length === 0) {
        return res.status(403).json({
            message: "You do not have access to this file"
        });
    }
}

        const { data, error } = await supabase
            .storage
            .from(process.env.SUPABASE_STORAGE_BUCKET)
            .createSignedUrl(file.storage_key, 60);

        if (error) {
            return res.status(500).json({
                message: "Could not generate download URL"
            });
        }

        res.json({
            file,
            downloadUrl: data.signedUrl
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to get file"
        });
    }
};

const uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                message: "No file uploaded"
            });
        }

        const userId = req.user.userId;

        const file = req.file;

        const storageKey = `${userId}/${Date.now()}-${file.originalname}`;

        const { error: uploadError } = await supabase
            .storage
            .from(process.env.SUPABASE_STORAGE_BUCKET)
            .upload(storageKey, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (uploadError) {
            console.error(uploadError);

            return res.status(500).json({
                message: "File upload failed"
            });
        }

        const result = await pool.query(
            `INSERT INTO files
            (name, mime_type, size_bytes, storage_key, owner_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *`,
            [
                file.originalname,
                file.mimetype,
                file.size,
                storageKey,
                userId
            ]
        );

        res.status(201).json({
            message: "File uploaded successfully",
            file: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Something went wrong"
        });
    }
};

const renameFile = async (req, res) => {
    try {
        const { name } = req.body;
        const fileId = req.params.id;
        const userId = req.user.userId;

        if (!name) {
            return res.status(400).json({
                message: "File name is required"
            });
        }

        const result = await pool.query(
            `UPDATE files
             SET name = $1, updated_at = now()
             WHERE id = $2
             AND owner_id = $3
             AND is_deleted = false
             RETURNING *`,
            [name, fileId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "File not found"
            });
        }

        res.json({
            message: "File renamed successfully",
            file: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to rename file"
        });
    }
};

const moveFile = async (req, res) => {
    try {
        const { folderId } = req.body;
        const fileId = req.params.id;
        const userId = req.user.userId;

        const result = await pool.query(
            `UPDATE files
             SET folder_id = $1,
                 updated_at = now()
             WHERE id = $2
             AND owner_id = $3
             AND is_deleted = false
             RETURNING *`,
            [folderId || null, fileId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "File not found"
            });
        }

        res.json({
            message: "File moved successfully",
            file: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to move file"
        });
    }
};

const deleteFile = async (req, res) => {
    try {
        const fileId = req.params.id;
        const userId = req.user.userId;

        const result = await pool.query(
            `UPDATE files
             SET is_deleted = true,
                 updated_at = now()
             WHERE id = $1
             AND owner_id = $2
             AND is_deleted = false
             RETURNING *`,
            [fileId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "File not found"
            });
        }

        res.json({
            message: "File moved to trash",
            file: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to delete file"
        });
    }
};

module.exports = {
    getFiles,
    uploadFile,
    getFile,
    renameFile,
    moveFile,
    deleteFile
};