const pool = require("../config/db");
const supabase = require("../config/supabase");

const bucket = process.env.SUPABASE_STORAGE_BUCKET;

const getTrash = async (req, res) => {
    try {
        const userId = req.user.userId;

        const [filesResult, foldersResult] = await Promise.all([
            pool.query(
                `SELECT id, name, mime_type, size_bytes, storage_key, folder_id, owner_id, created_at, updated_at
                 FROM files
                 WHERE owner_id = $1 AND is_deleted = true
                 ORDER BY updated_at DESC`,
                [userId]
            ),
            pool.query(
                `SELECT id, name, parent_id, owner_id, created_at, updated_at
                 FROM folders
                 WHERE owner_id = $1 AND is_deleted = true
                 ORDER BY updated_at DESC`,
                [userId]
            )
        ]);

        res.json({
            files: filesResult.rows,
            folders: foldersResult.rows
        });
    } catch (error) {
        console.error("Get trash error:", error);
        res.status(500).json({ message: "Failed to load trash" });
    }
};

const restoreFile = async (req, res) => {
    try {
        const fileId = req.params.id;
        const userId = req.user.userId;

        const result = await pool.query(
            `UPDATE files
             SET is_deleted = false, updated_at = now()
             WHERE id = $1 AND owner_id = $2 AND is_deleted = true
             RETURNING *`,
            [fileId, userId]
        );

        if (!result.rows.length) {
            return res.status(404).json({ message: "Deleted file not found" });
        }

        res.json({ message: "File restored successfully", file: result.rows[0] });
    } catch (error) {
        console.error("Restore file error:", error);
        res.status(500).json({ message: "Failed to restore file" });
    }
};

const permanentlyDeleteFile = async (req, res) => {
    try {
        const fileId = req.params.id;
        const userId = req.user.userId;

        const fileResult = await pool.query(
            `SELECT id, storage_key
             FROM files
             WHERE id = $1 AND owner_id = $2 AND is_deleted = true`,
            [fileId, userId]
        );

        if (!fileResult.rows.length) {
            return res.status(404).json({ message: "Deleted file not found" });
        }

        const file = fileResult.rows[0];

        const versionResult = await pool.query(
            `SELECT storage_key FROM file_versions WHERE file_id = $1`,
            [fileId]
        );

        const keys = [
            file.storage_key,
            ...versionResult.rows.map(row => row.storage_key)
        ].filter(Boolean);

        const uniqueKeys = [...new Set(keys)];

        if (uniqueKeys.length) {
            const { error: storageError } = await supabase
                .storage
                .from(bucket)
                .remove(uniqueKeys);

            if (storageError) {
                console.error("Permanent storage delete error:", storageError);
                return res.status(500).json({ message: "Could not delete file from storage" });
            }
        }

        await pool.query(
            `DELETE FROM files
             WHERE id = $1 AND owner_id = $2 AND is_deleted = true`,
            [fileId, userId]
        );

        res.json({ message: "File permanently deleted" });
    } catch (error) {
        console.error("Permanent file delete error:", error);
        res.status(500).json({ message: "Failed to permanently delete file" });
    }
};

const restoreFolder = async (req, res) => {
    try {
        const folderId = req.params.id;
        const userId = req.user.userId;

        const result = await pool.query(
            `UPDATE folders
             SET is_deleted = false, updated_at = now()
             WHERE id = $1 AND owner_id = $2 AND is_deleted = true
             RETURNING *`,
            [folderId, userId]
        );

        if (!result.rows.length) {
            return res.status(404).json({ message: "Deleted folder not found" });
        }

        res.json({ message: "Folder restored successfully", folder: result.rows[0] });
    } catch (error) {
        console.error("Restore folder error:", error);
        res.status(500).json({ message: "Failed to restore folder" });
    }
};

const permanentlyDeleteFolder = async (req, res) => {
    try {
        const folderId = req.params.id;
        const userId = req.user.userId;

        const folderResult = await pool.query(
            `SELECT id FROM folders
             WHERE id = $1 AND owner_id = $2 AND is_deleted = true`,
            [folderId, userId]
        );

        if (!folderResult.rows.length) {
            return res.status(404).json({ message: "Deleted folder not found" });
        }

        const descendants = await pool.query(
            `WITH RECURSIVE descendants AS (
                SELECT id FROM folders WHERE id = $1 AND owner_id = $2
                UNION ALL
                SELECT f.id
                FROM folders f
                INNER JOIN descendants d ON f.parent_id = d.id
                WHERE f.owner_id = $2
            )
            SELECT id FROM descendants`,
            [folderId, userId]
        );

        const folderIds = descendants.rows.map(row => row.id);

        const filesResult = await pool.query(
            `SELECT id, storage_key
             FROM files
             WHERE folder_id = ANY($1::uuid[]) AND owner_id = $2`,
            [folderIds, userId]
        );

        const fileIds = filesResult.rows.map(row => row.id);
        const keys = filesResult.rows.map(row => row.storage_key).filter(Boolean);

        if (fileIds.length) {
            const versionsResult = await pool.query(
                `SELECT storage_key FROM file_versions WHERE file_id = ANY($1::uuid[])`,
                [fileIds]
            );
            keys.push(...versionsResult.rows.map(row => row.storage_key).filter(Boolean));
        }

        const uniqueKeys = [...new Set(keys)];

        if (uniqueKeys.length) {
            const { error: storageError } = await supabase
                .storage
                .from(bucket)
                .remove(uniqueKeys);

            if (storageError) {
                console.error("Permanent folder storage delete error:", storageError);
                return res.status(500).json({ message: "Could not delete folder files from storage" });
            }
        }

        if (fileIds.length) {
            await pool.query(
                `DELETE FROM files WHERE id = ANY($1::uuid[]) AND owner_id = $2`,
                [fileIds, userId]
            );
        }

        await pool.query(
            `DELETE FROM folders WHERE id = ANY($1::uuid[]) AND owner_id = $2`,
            [folderIds, userId]
        );

        res.json({ message: "Folder permanently deleted" });
    } catch (error) {
        console.error("Permanent folder delete error:", error);
        res.status(500).json({ message: "Failed to permanently delete folder" });
    }
};

module.exports = {
    getTrash,
    restoreFile,
    permanentlyDeleteFile,
    restoreFolder,
    permanentlyDeleteFolder
};
