const crypto = require("crypto");
const supabase = require("../config/supabase");
const pool = require("../config/db");

const bucket = process.env.SUPABASE_STORAGE_BUCKET;

const sanitizeFileName = (value) => {
    const fallback = "file";
    const name = typeof value === "string" ? value.trim() : fallback;

    return (name
        .replace(/[\\/]+/g, "_")
        .replace(/[\0]/g, "")
        .slice(0, 255) || fallback);
};

const getFiles = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { folderId } = req.query;

        if (folderId) {
            const folderResult = await pool.query(
                `SELECT id FROM folders
                 WHERE id = $1 AND owner_id = $2 AND is_deleted = false`,
                [folderId, userId]
            );

            if (!folderResult.rows.length) {
                return res.status(404).json({ message: "Folder not found" });
            }
        }

        const result = await pool.query(
            `SELECT *
             FROM files
             WHERE owner_id = $1
             AND is_deleted = false
             AND folder_id IS NOT DISTINCT FROM $2
             ORDER BY name ASC`,
            [userId, folderId || null]
        );

        const filesWithUrls = await Promise.all(
            result.rows.map(async (file) => {
                const { data, error } = await supabase
                    .storage
                    .from(bucket)
                    .createSignedUrl(file.storage_key, 3600);

                return {
                    ...file,
                    url: error ? null : data.signedUrl,
                };
            })
        );

        res.json({ files: filesWithUrls });
    } catch (error) {
        console.error("Get files error:", error);
        res.status(500).json({ message: "Failed to fetch files" });
    }
};

const getFile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const fileId = req.params.id;

        const result = await pool.query(
            `SELECT * FROM files
             WHERE id = $1 AND is_deleted = false`,
            [fileId]
        );

        if (!result.rows.length) {
            return res.status(404).json({ message: "File not found" });
        }

        const file = result.rows[0];
        const isOwner = file.owner_id === userId;

        if (!isOwner) {
            const shareResult = await pool.query(
                `SELECT role FROM shares
                 WHERE resource_type = 'file'
                 AND resource_id = $1
                 AND grantee_user_id = $2`,
                [fileId, userId]
            );

            if (!shareResult.rows.length) {
                return res.status(403).json({ message: "You do not have access to this file" });
            }
        }

        const { data, error } = await supabase
            .storage
            .from(bucket)
            .createSignedUrl(file.storage_key, 300);

        if (error) {
            return res.status(500).json({ message: "Could not generate download URL" });
        }

        res.json({ file, downloadUrl: data.signedUrl });
    } catch (error) {
        console.error("Get file error:", error);
        res.status(500).json({ message: "Failed to get file" });
    }
};

const uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const userId = req.user.userId;
        const file = req.file;
        const folderId = req.body.folderId || null;
        const safeName = sanitizeFileName(file.originalname);

        if (folderId) {
            const folderResult = await pool.query(
                `SELECT id FROM folders
                 WHERE id = $1 AND owner_id = $2 AND is_deleted = false`,
                [folderId, userId]
            );

            if (!folderResult.rows.length) {
                return res.status(404).json({ message: "Destination folder not found" });
            }
        }

        if (file.size > 50 * 1024 * 1024) {
            return res.status(413).json({ message: "File is too large. Maximum size is 50 MB." });
        }

        const storageKey = `${userId}/${crypto.randomUUID()}-${safeName}`;

        const { error: uploadError } = await supabase
            .storage
            .from(bucket)
            .upload(storageKey, file.buffer, {
                contentType: file.mimetype || "application/octet-stream",
                upsert: false,
            });

        if (uploadError) {
            console.error("Supabase upload error:", uploadError);
            return res.status(500).json({ message: "File upload failed" });
        }

        try {
            const result = await pool.query(
                `INSERT INTO files
                (name, mime_type, size_bytes, storage_key, owner_id, folder_id)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *`,
                [safeName, file.mimetype, file.size, storageKey, userId, folderId]
            );

            const uploadedFile = result.rows[0];

            const { data, error } = await supabase
                .storage
                .from(bucket)
                .createSignedUrl(storageKey, 3600);

            res.status(201).json({
                message: "File uploaded successfully",
                file: {
                    ...uploadedFile,
                    url: error ? null : data.signedUrl,
                },
            });
        } catch (dbError) {
            await supabase.storage.from(bucket).remove([storageKey]);
            throw dbError;
        }
    } catch (error) {
        console.error("Upload file error:", error);

        if (error.code === "23505") {
            return res.status(409).json({ message: "A file with this storage key already exists" });
        }

        res.status(500).json({ message: "Something went wrong" });
    }
};

const renameFile = async (req, res) => {
    try {
        const name = sanitizeFileName(req.body.name);
        const fileId = req.params.id;
        const userId = req.user.userId;

        if (!req.body.name || !String(req.body.name).trim()) {
            return res.status(400).json({ message: "File name is required" });
        }

        const result = await pool.query(
            `UPDATE files SET name = $1, updated_at = now()
             WHERE id = $2 AND owner_id = $3 AND is_deleted = false
             RETURNING *`,
            [name, fileId, userId]
        );

        if (!result.rows.length) {
            return res.status(404).json({ message: "File not found" });
        }

        res.json({ message: "File renamed successfully", file: result.rows[0] });
    } catch (error) {
        console.error("Rename file error:", error);
        res.status(500).json({ message: "Failed to rename file" });
    }
};

const moveFile = async (req, res) => {
    try {
        const folderId = req.body.folderId || null;
        const fileId = req.params.id;
        const userId = req.user.userId;

        if (folderId) {
            const folderResult = await pool.query(
                `SELECT id FROM folders
                 WHERE id = $1 AND owner_id = $2 AND is_deleted = false`,
                [folderId, userId]
            );

            if (!folderResult.rows.length) {
                return res.status(404).json({ message: "Destination folder not found" });
            }
        }

        const result = await pool.query(
            `UPDATE files SET folder_id = $1, updated_at = now()
             WHERE id = $2 AND owner_id = $3 AND is_deleted = false
             RETURNING *`,
            [folderId, fileId, userId]
        );

        if (!result.rows.length) {
            return res.status(404).json({ message: "File not found" });
        }

        res.json({ message: "File moved successfully", file: result.rows[0] });
    } catch (error) {
        console.error("Move file error:", error);
        res.status(500).json({ message: "Failed to move file" });
    }
};

const deleteFile = async (req, res) => {
    try {
        const fileId = req.params.id;
        const userId = req.user.userId;

        const result = await pool.query(
            `UPDATE files SET is_deleted = true, updated_at = now()
             WHERE id = $1 AND owner_id = $2 AND is_deleted = false
             RETURNING *`,
            [fileId, userId]
        );

        if (!result.rows.length) {
            return res.status(404).json({ message: "File not found" });
        }

        res.json({ message: "File moved to trash", file: result.rows[0] });
    } catch (error) {
        console.error("Delete file error:", error);
        res.status(500).json({ message: "Failed to delete file" });
    }
};

module.exports = {
    getFiles,
    uploadFile,
    getFile,
    renameFile,
    moveFile,
    deleteFile,
};
