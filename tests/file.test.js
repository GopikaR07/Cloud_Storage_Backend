const request = require("supertest");
const app = require("../src/app");

describe("File API", () => {

    test("GET /api/files/:id should return file for authenticated user", async () => {

        // Login
        const loginResponse = await request(app)
            .post("/api/auth/login")
            .send({
                email: "gopika@example.com",
                password: "password123"
            });

        const token = loginResponse.body.token;

        // Get file
        const response = await request(app)
            .get("/api/files/7ebaa0c8-befb-49d2-aa76-1436959eeb56")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(200);

        expect(response.body).toHaveProperty("file");
        expect(response.body).toHaveProperty("downloadUrl");

    });

});