const pool = require("../config/db");

const searchFiles = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { q, page = 1, limit = 10 } = req.query;

        const offset = (page - 1) * limit;

        if (!q) {
            return res.status(400).json({
                message: "Search query is required"
            });
        }

        const result = await pool.query(
    `SELECT id, name, mime_type, size_bytes, owner_id, folder_id, created_at
FROM files
     WHERE owner_id = $1
     AND is_deleted = false
     AND to_tsvector('english', name)
         @@ plainto_tsquery('english', $2)
     ORDER BY created_at DESC
     LIMIT $3
     OFFSET $4`,
    [userId, q, limit, offset]
);

    const countResult = await pool.query(
    `SELECT COUNT(*)
     FROM files
     WHERE owner_id = $1
     AND is_deleted = false
     AND to_tsvector('english', name)
         @@ plainto_tsquery('english', $2)`,
    [userId, q]
);

    const total = Number(countResult.rows[0].count);

        res.json({
    results: result.rows,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages: Math.ceil(total / limit)
});

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Search failed"
        });
    }
};

module.exports = {
    searchFiles
};
