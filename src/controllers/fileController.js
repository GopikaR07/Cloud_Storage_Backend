const supabase = require("../config/supabase");
const pool = require("../config/db");

const getFile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const fileId = req.params.id;

        const result = await pool.query(
            `SELECT *
             FROM files
             WHERE id = $1
             AND owner_id = $2
             AND is_deleted = false`,
            [fileId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "File not found"
            });
        }

        const file = result.rows[0];

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

module.exports = {
    uploadFile,
    getFile
};