require("dotenv").config();

const app = require("./app");
const pool = require("./config/db");

const PORT = process.env.PORT || 5000;

if (require.main === module) {
    app.listen(PORT, async () => {
        console.log(`Server running on port ${PORT}`);

        try {
            const result = await pool.query("SELECT NOW()");
            console.log("Database connected:", result.rows[0]);
        } catch (error) {
            console.error("Database connection failed:", error.message);
        }
    });
}

module.exports = app;