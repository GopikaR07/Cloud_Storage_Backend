const request = require("supertest");
const app = require("../src/app");

describe("Authentication API", () => {

    test("POST /api/auth/login should login user", async () => {

        const response = await request(app)
            .post("/api/auth/login")
            .send({
                email: "gopika@example.com",
                password: "password123"
            });

        expect(response.statusCode).toBe(200);

        expect(response.body).toHaveProperty("token");
    });

});