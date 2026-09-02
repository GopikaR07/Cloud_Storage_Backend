const pool = require("../config/db");
const supabase = require("../config/supabase");

const bucket = process.env.SUPABASE_STORAGE_BUCKET;

const getOwnedFile = async (fileId, userId) => {
    const result = await pool.query(
        `SELECT * FROM files
         WHERE id = $1 AND owner_id = $2 AND is_deleted = false`,
        [fileId, userId]
    );
    return result.rows[0] || null;
};

const getVersions = async (req, res) => {
    try {
        const file = await getOwnedFile(req.params.fileId, req.user.userId);
        if (!file) return res.status(404).json({ message: "File not found" });

        const result = await pool.query(
            `SELECT id, file_id, version_number, name, mime_type, size_bytes, created_at
             FROM file_versions
             WHERE file_id = $1
             ORDER BY version_number DESC`,
            [file.id]
        );

        res.json({ versions: result.rows });
    } catch (error) {
        console.error("Get versions error:", error);
        res.status(500).json({ message: "Failed to get versions" });
    }
};

const uploadVersion = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "No file uploaded" });

        const userId = req.user.userId;
        const fileId = req.params.fileId;
        const currentFile = await getOwnedFile(fileId, userId);

        if (!currentFile) return res.status(404).json({ message: "File not found" });

        const maxResult = await pool.query(
            `SELECT COALESCE(MAX(version_number), 0) AS max_version
             FROM file_versions WHERE file_id = $1`,
            [fileId]
        );
        const nextVersion = Number(maxResult.rows[0].max_version) + 1;

        const newStorageKey = `${userId}/${Date.now()}-${req.file.originalname}`;
        const { error: uploadError } = await supabase
            .storage
            .from(bucket)
            .upload(newStorageKey, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false
            });

        if (uploadError) {
            console.error("Version upload error:", uploadError);
            return res.status(500).json({ message: "New version upload failed" });
        }

        try {
            await pool.query(
                `INSERT INTO file_versions
                 (file_id, version_number, storage_key, name, mime_type, size_bytes)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    fileId,
                    nextVersion,
                    currentFile.storage_key,
                    currentFile.name,
                    currentFile.mime_type,
                    currentFile.size_bytes
                ]
            );

            const updated = await pool.query(
                `UPDATE files
                 SET name = $1, mime_type = $2, size_bytes = $3,
                     storage_key = $4, updated_at = now()
                 WHERE id = $5 AND owner_id = $6 AND is_deleted = false
                 RETURNING *`,
                [
                    req.file.originalname,
                    req.file.mimetype,
                    req.file.size,
                    newStorageKey,
                    fileId,
                    userId
                ]
            );

            if (!updated.rows.length) {
                await pool.query(
                    `DELETE FROM file_versions WHERE file_id = $1 AND version_number = $2`,
                    [fileId, nextVersion]
                );
                await supabase.storage.from(bucket).remove([newStorageKey]);
                return res.status(404).json({ message: "File not found" });
            }

            res.status(201).json({
                message: "New file version uploaded",
                file: updated.rows[0],
                version: nextVersion
            });
        } catch (dbError) {
            await supabase.storage.from(bucket).remove([newStorageKey]);
            throw dbError;
        }
    } catch (error) {
        console.error("Upload version error:", error);
        res.status(500).json({ message: "Failed to upload new version" });
    }
};

const downloadVersion = async (req, res) => {
    try {
        const file = await getOwnedFile(req.params.fileId, req.user.userId);
        if (!file) return res.status(404).json({ message: "File not found" });

        const result = await pool.query(
            `SELECT storage_key FROM file_versions
             WHERE id = $1 AND file_id = $2`,
            [req.params.versionId, file.id]
        );

        if (!result.rows.length) return res.status(404).json({ message: "Version not found" });

        const { data, error } = await supabase
            .storage
            .from(bucket)
            .createSignedUrl(result.rows[0].storage_key, 300);

        if (error) return res.status(500).json({ message: "Could not create download URL" });

        res.json({ downloadUrl: data.signedUrl });
    } catch (error) {
        console.error("Download version error:", error);
        res.status(500).json({ message: "Failed to download version" });
    }
};

const restoreVersion = async (req, res) => {
    try {
        const userId = req.user.userId;
        const fileId = req.params.fileId;
        const currentFile = await getOwnedFile(fileId, userId);

        if (!currentFile) return res.status(404).json({ message: "File not found" });

        const versionResult = await pool.query(
            `SELECT * FROM file_versions
             WHERE id = $1 AND file_id = $2`,
            [req.params.versionId, fileId]
        );

        if (!versionResult.rows.length) return res.status(404).json({ message: "Version not found" });

        const version = versionResult.rows[0];

        const maxResult = await pool.query(
            `SELECT COALESCE(MAX(version_number), 0) AS max_version
             FROM file_versions WHERE file_id = $1`,
            [fileId]
        );
        const nextVersion = Number(maxResult.rows[0].max_version) + 1;

        await pool.query(
            `INSERT INTO file_versions
             (file_id, version_number, storage_key, name, mime_type, size_bytes)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                fileId,
                nextVersion,
                currentFile.storage_key,
                currentFile.name,
                currentFile.mime_type,
                currentFile.size_bytes
            ]
        );

        const updated = await pool.query(
            `UPDATE files
             SET name = $1, mime_type = $2, size_bytes = $3,
                 storage_key = $4, updated_at = now()
             WHERE id = $5 AND owner_id = $6
             RETURNING *`,
            [
                version.name,
                version.mime_type,
                version.size_bytes,
                version.storage_key,
                fileId,
                userId
            ]
        );

        res.json({ message: "Version restored successfully", file: updated.rows[0] });
    } catch (error) {
        console.error("Restore version error:", error);
        res.status(500).json({ message: "Failed to restore version" });
    }
};

module.exports = {
    getVersions,
    uploadVersion,
    downloadVersion,
    restoreVersion
};
