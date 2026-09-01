const pool = require("../config/db");

const SORT_COLUMNS_FILES = {
    name: "name",
    size: "size_bytes",
    date: "created_at",
};

const SORT_COLUMNS_FOLDERS = {
    name: "name",
    size: "created_at", // folders have no size, fall back to date
    date: "created_at",
};

const searchFiles = async (req, res) => {
    try {
        const userId = req.user.userId;

        const {
            q,
            type = "all",
            sort = "date",
            order = "desc",
            page = 1,
            limit = 10,
        } = req.query;

        if (!q || !q.trim()) {
            return res.status(400).json({
                message: "Search query is required"
            });
        }

        const searchQuery = q.trim();

        const pageNumber = Math.max(Number.parseInt(page, 10) || 1, 1);
        const limitNumber = Math.min(
            Math.max(Number.parseInt(limit, 10) || 10, 1),
            50
        );
        const offset = (pageNumber - 1) * limitNumber;

        const sortOrder =
            String(order).toLowerCase() === "asc" ? "ASC" : "DESC";

        const fileSortColumn =
            SORT_COLUMNS_FILES[sort] || "created_at";

        const folderSortColumn =
            SORT_COLUMNS_FOLDERS[sort] || "created_at";

        const results = [];
        let total = 0;

        // ==========================================
        // FILES
        // ==========================================

        if (type === "all" || type === "file") {
            const fileResult = await pool.query(
                `SELECT id, name, mime_type, size_bytes, owner_id,
                        folder_id, storage_key, created_at, updated_at,
                        'file' AS resource_type
                 FROM files
                 WHERE owner_id = $1
                 AND is_deleted = false
                 AND (
                     name ILIKE $2
                     OR to_tsvector('english', name)
                        @@ plainto_tsquery('english', $3)
                 )
                 ORDER BY ${fileSortColumn} ${sortOrder}
                 LIMIT $4
                 OFFSET $5`,
                [userId, `%${searchQuery}%`, searchQuery, limitNumber, offset]
            );

            results.push(...fileResult.rows);

            const fileCount = await pool.query(
                `SELECT COUNT(*)
                 FROM files
                 WHERE owner_id = $1
                 AND is_deleted = false
                 AND (
                     name ILIKE $2
                     OR to_tsvector('english', name)
                        @@ plainto_tsquery('english', $3)
                 )`,
                [userId, `%${searchQuery}%`, searchQuery]
            );

            total += Number(fileCount.rows[0].count);
        }

        // ==========================================
        // FOLDERS
        // ==========================================

        if (type === "all" || type === "folder") {
            const folderResult = await pool.query(
                `SELECT id, name, owner_id, parent_id,
                        created_at, updated_at,
                        'folder' AS resource_type
                 FROM folders
                 WHERE owner_id = $1
                 AND is_deleted = false
                 AND name ILIKE $2
                 ORDER BY ${folderSortColumn} ${sortOrder}
                 LIMIT $3
                 OFFSET $4`,
                [userId, `%${searchQuery}%`, limitNumber, offset]
            );

            results.push(...folderResult.rows);

            const folderCount = await pool.query(
                `SELECT COUNT(*)
                 FROM folders
                 WHERE owner_id = $1
                 AND is_deleted = false
                 AND name ILIKE $2`,
                [userId, `%${searchQuery}%`]
            );

            total += Number(folderCount.rows[0].count);
        }

        res.json({
            results,
            page: pageNumber,
            limit: limitNumber,
            total,
            totalPages: Math.ceil(total / limitNumber),
            hasMore: pageNumber < Math.ceil(total / limitNumber),
        });

    } catch (error) {
        console.error("Search error:", error);

        res.status(500).json({
            message: "Search failed"
        });
    }
};

module.exports = {
    searchFiles
};