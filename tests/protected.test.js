const request = require("supertest");
const app = require("../src/app");

describe("Protected API", () => {

    test("GET /api/folders should work with valid token", async () => {

        const loginResponse = await request(app)
            .post("/api/auth/login")
            .send({
                email: "gopika@example.com",
                password: "password123"
            });

        const token = loginResponse.body.token;

        const response = await request(app)
            .get("/api/folders")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(200);

    });

});