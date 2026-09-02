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

app.use(cors());
app.use(express.json());
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
        message: "Cloud Storage API is running"
    });
});

app.get("/db-test", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");

        res.json({
            status: "OK",
            database: "Connected",
            time: result.rows[0].now
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            status: "ERROR",
            database: "Not connected"
        });
    }
});

module.exports = app;