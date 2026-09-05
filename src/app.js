const express = require("express");
const cors = require("cors");
const pool = require("./config/db");

const app = express();

const authRoutes = require("./routes/authRoutes");
const fileRoutes = require("./routes/fileRoutes");
const folderRoutes = require("./routes/folderRoutes");
const shareRoutes = require("./routes/shareRoutes");
const publicShareRoutes = require("./routes/publicShareRoutes");
const searchRoutes = require("./routes/searchRoutes");
const trashRoutes = require("./routes/trashRoutes");
const versionRoutes = require("./routes/versionRoutes");

const allowedOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        // Allow server-to-server requests and local tools such as Postman.
        if (!origin) return callback(null, true);

        const normalizedOrigin = origin.replace(/\/+$/, "");

        if (allowedOrigins.includes(normalizedOrigin)) {
            return callback(null, true);
        }

        return callback(new Error("CORS origin not allowed"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json({ limit: "1mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/trash", trashRoutes);
app.use("/api/versions", versionRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/folders", folderRoutes);
app.use("/api/public", publicShareRoutes);
app.use("/api/shares", shareRoutes);

app.get("/health", (req, res) => {
    res.json({
        status: "OK",
        message: "Cloud Storage API is running",
    });
});

app.get("/db-test", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");

        res.json({
            status: "OK",
            database: "Connected",
            time: result.rows[0].now,
        });
    } catch (error) {
        console.error("Database test error:", error);

        res.status(500).json({
            status: "ERROR",
            database: "Not connected",
        });
    }
});

// Keep API errors JSON-shaped instead of returning an HTML error page.
app.use((error, req, res, next) => {
    if (error && error.message === "CORS origin not allowed") {
        return res.status(403).json({
            message: "Origin is not allowed",
        });
    }

    console.error("Unhandled API error:", error);

    return res.status(500).json({
        message: "Internal server error",
    });
});

module.exports = app;
