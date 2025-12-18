import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { buildApp } from "../app.js";

// Use environment variable or default to localhost
const BASE_URL = process.env.TEST_SERVER_URL || "http://localhost:3000";

// Store session token between tests
let sessionToken = "";
let userId = "";
let testEmail = "";
let testPassword = "testPassword123";

describe("Better-Auth API Endpoints Tests", () => {
  // Generate unique test email
  beforeAll(() => {
    testEmail = `test-${Date.now()}@example.com`;
    console.log(`\n🧪 Testing with email: ${testEmail}`);
  });

  describe("1. POST /api/auth/sign-up - User Registration", () => {
    it("should successfully create a new user", async () => {
      const response = await request(BASE_URL)
        .post("/api/auth/sign-up")
        .set("Content-Type", "application/json")
        .send({
          email: testEmail,
          password: testPassword,
          name: "Test User",
        });

      console.log("\n📝 Sign-up Response:", {
        status: response.status,
        body: JSON.stringify(response.body, null, 2),
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("data");
      expect(response.body.data).toHaveProperty("user");
      expect(response.body.data).toHaveProperty("session");

      // Verify user object structure
      expect(response.body.data.user).toHaveProperty("id");
      expect(response.body.data.user).toHaveProperty("email", testEmail);
      expect(response.body.data.user).toHaveProperty("name", "Test User");
      expect(response.body.data.user).toHaveProperty("emailVerified");

      // Verify session object structure
      expect(response.body.data.session).toHaveProperty("id");
      expect(response.body.data.session).toHaveProperty("userId");
      expect(response.body.data.session).toHaveProperty("expiresAt");
      expect(response.body.data.session).toHaveProperty("token");

      // Store session token and user ID for subsequent tests
      sessionToken = response.body.data.session.token;
      userId = response.body.data.user.id;

      console.log("✅ User created successfully");
      console.log(`🔑 Session token: ${sessionToken.substring(0, 20)}...`);
    });

    it("should reject duplicate email registration", async () => {
      const response = await request(BASE_URL)
        .post("/api/auth/sign-up")
        .set("Content-Type", "application/json")
        .send({
          email: testEmail, // Same email as above
          password: testPassword,
          name: "Duplicate User",
        });

      console.log("\n📝 Duplicate Sign-up Response:", {
        status: response.status,
        body: JSON.stringify(response.body, null, 2),
      });

      // Should return 400 or 409 for duplicate email
      expect([400, 409]).toContain(response.status);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toHaveProperty("message");

      console.log("✅ Duplicate email correctly rejected");
    });

    it("should reject invalid email format", async () => {
      const response = await request(BASE_URL)
        .post("/api/auth/sign-up")
        .set("Content-Type", "application/json")
        .send({
          email: "invalid-email",
          password: testPassword,
          name: "Invalid User",
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body).toHaveProperty("error");

      console.log("✅ Invalid email format correctly rejected");
    });

    it("should reject short password", async () => {
      const response = await request(BASE_URL)
        .post("/api/auth/sign-up")
        .set("Content-Type", "application/json")
        .send({
          email: `test-${Date.now()}@example.com`,
          password: "short", // Less than 8 characters
          name: "Short Password User",
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body).toHaveProperty("error");

      console.log("✅ Short password correctly rejected");
    });
  });

  describe("2. POST /api/auth/sign-in - User Login", () => {
    it("should successfully sign in with correct credentials", async () => {
      const response = await request(BASE_URL)
        .post("/api/auth/sign-in")
        .set("Content-Type", "application/json")
        .send({
          email: testEmail,
          password: testPassword,
        });

      console.log("\n📝 Sign-in Response:", {
        status: response.status,
        body: JSON.stringify(response.body, null, 2),
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("data");
      expect(response.body.data).toHaveProperty("user");
      expect(response.body.data).toHaveProperty("session");

      // Verify user object
      expect(response.body.data.user).toHaveProperty("id", userId);
      expect(response.body.data.user).toHaveProperty("email", testEmail);

      // Verify session object
      expect(response.body.data.session).toHaveProperty("token");
      expect(response.body.data.session).toHaveProperty("userId", userId);

      // Update session token
      sessionToken = response.body.data.session.token;

      console.log("✅ Sign-in successful");
    });

    it("should reject incorrect password", async () => {
      const response = await request(BASE_URL)
        .post("/api/auth/sign-in")
        .set("Content-Type", "application/json")
        .send({
          email: testEmail,
          password: "wrongPassword123",
        });

      console.log("\n📝 Wrong Password Response:", {
        status: response.status,
        body: JSON.stringify(response.body, null, 2),
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toHaveProperty("message");

      console.log("✅ Incorrect password correctly rejected");
    });

    it("should reject non-existent email", async () => {
      const response = await request(BASE_URL)
        .post("/api/auth/sign-in")
        .set("Content-Type", "application/json")
        .send({
          email: "nonexistent@example.com",
          password: testPassword,
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");

      console.log("✅ Non-existent email correctly rejected");
    });
  });

  describe("3. GET /api/auth/session - Get Current Session", () => {
    it("should return session with valid Bearer token", async () => {
      const response = await request(BASE_URL)
        .get("/api/auth/session")
        .set("Authorization", `Bearer ${sessionToken}`)
        .set("Content-Type", "application/json");

      console.log("\n📝 Get Session Response (Bearer):", {
        status: response.status,
        body: JSON.stringify(response.body, null, 2),
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("data");
      expect(response.body.data).toHaveProperty("session");
      expect(response.body.data).toHaveProperty("user");

      // Verify session object
      expect(response.body.data.session).toHaveProperty("id");
      expect(response.body.data.session).toHaveProperty("userId", userId);
      expect(response.body.data.session).toHaveProperty("token", sessionToken);
      expect(response.body.data.session).toHaveProperty("expiresAt");

      // Verify user object
      expect(response.body.data.user).toHaveProperty("id", userId);
      expect(response.body.data.user).toHaveProperty("email", testEmail);

      console.log("✅ Session retrieved successfully with Bearer token");
    });

    it("should return session with cookie", async () => {
      const response = await request(BASE_URL)
        .get("/api/auth/session")
        .set("Cookie", `better-auth.session_token=${sessionToken}`)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("data");
      expect(response.body.data).toHaveProperty("session");
      expect(response.body.data).toHaveProperty("user");

      console.log("✅ Session retrieved successfully with cookie");
    });

    it("should return 401 with invalid token", async () => {
      const response = await request(BASE_URL)
        .get("/api/auth/session")
        .set("Authorization", "Bearer invalid_token_12345")
        .set("Content-Type", "application/json");

      console.log("\n📝 Invalid Token Response:", {
        status: response.status,
        body: JSON.stringify(response.body, null, 2),
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toHaveProperty("message");

      console.log("✅ Invalid token correctly rejected");
    });

    it("should return 401 without authentication", async () => {
      const response = await request(BASE_URL)
        .get("/api/auth/session")
        .set("Content-Type", "application/json");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");

      console.log("✅ Unauthenticated request correctly rejected");
    });
  });

  describe("4. POST /api/auth/sign-out - User Logout", () => {
    it("should successfully sign out with Bearer token", async () => {
      const response = await request(BASE_URL)
        .post("/api/auth/sign-out")
        .set("Authorization", `Bearer ${sessionToken}`)
        .set("Content-Type", "application/json");

      console.log("\n📝 Sign-out Response (Bearer):", {
        status: response.status,
        body: JSON.stringify(response.body, null, 2),
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("data");
      expect(response.body.data).toHaveProperty("success", true);

      console.log("✅ Sign-out successful with Bearer token");
    });

    it("should invalidate session after sign-out", async () => {
      // Try to get session after sign-out
      const response = await request(BASE_URL)
        .get("/api/auth/session")
        .set("Authorization", `Bearer ${sessionToken}`)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");

      console.log("✅ Session correctly invalidated after sign-out");
    });

    it("should successfully sign out with cookie", async () => {
      // Sign in again to get a new session
      const signInResponse = await request(BASE_URL)
        .post("/api/auth/sign-in")
        .set("Content-Type", "application/json")
        .send({
          email: testEmail,
          password: testPassword,
        });

      const newToken = signInResponse.body.data.session.token;

      const response = await request(BASE_URL)
        .post("/api/auth/sign-out")
        .set("Cookie", `better-auth.session_token=${newToken}`)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty("success", true);

      console.log("✅ Sign-out successful with cookie");
    });
  });

  describe("5. Alternative Endpoint Names", () => {
    it("should support /api/auth/signup (alternative to sign-up)", async () => {
      const altEmail = `alt-${Date.now()}@example.com`;
      const response = await request(BASE_URL)
        .post("/api/auth/signup")
        .set("Content-Type", "application/json")
        .send({
          email: altEmail,
          password: testPassword,
          name: "Alt Endpoint User",
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("data");

      console.log("✅ Alternative endpoint /api/auth/signup works");
    });

    it("should support /api/auth/signin (alternative to sign-in)", async () => {
      const altEmail = `alt-${Date.now()}@example.com`;
      
      // First sign up
      await request(BASE_URL)
        .post("/api/auth/sign-up")
        .set("Content-Type", "application/json")
        .send({
          email: altEmail,
          password: testPassword,
          name: "Alt Signin User",
        });

      // Then sign in using alternative endpoint
      const response = await request(BASE_URL)
        .post("/api/auth/signin")
        .set("Content-Type", "application/json")
        .send({
          email: altEmail,
          password: testPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("data");

      console.log("✅ Alternative endpoint /api/auth/signin works");
    });

    it("should support /api/auth/signout (alternative to sign-out)", async () => {
      // Sign in first
      const signInResponse = await request(BASE_URL)
        .post("/api/auth/sign-in")
        .set("Content-Type", "application/json")
        .send({
          email: testEmail,
          password: testPassword,
        });

      const token = signInResponse.body.data.session.token;

      // Sign out using alternative endpoint
      const response = await request(BASE_URL)
        .post("/api/auth/signout")
        .set("Authorization", `Bearer ${token}`)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty("success", true);

      console.log("✅ Alternative endpoint /api/auth/signout works");
    });
  });
});

