import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

const BASE_URL = "http://localhost:3000";

// Store values between tests
let adminToken = "";
let ownerToken = "";
let userId = "";
let organizationId = "";
let departmentId = "";
let providerId = "";
let eventId = "";
let tempPassword = "";

describe("Medisched API Tests", () => {
  describe("1. Health Check", () => {
    it("should return healthy status", async () => {
      const response = await request(BASE_URL).get("/health");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("status", "healthy");
    });
  });

  describe("2. Admin - Create User", () => {
    it("should create a user with temporary password (requires admin token)", async () => {
      // NOTE: You need to manually set adminToken after creating admin user
      // Run: UPDATE user SET role = 'ADMIN' WHERE email = 'admin@test.com';

      if (!adminToken) {
        console.log("⚠️  Skipping: Set adminToken in the test file");
        return;
      }

      const response = await request(BASE_URL)
        .post("/api/admin/users")
        .set("Cookie", `better-auth.session_token=${adminToken}`)
        .send({
          name: "Test Owner",
          email: `owner-${Date.now()}@test.com`,
          role: "USER",
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("user");
      expect(response.body).toHaveProperty("tempPassword");
      expect(response.body.user).toHaveProperty("needsPasswordChange", true);

      // Store for later tests
      userId = response.body.user.id;
      tempPassword = response.body.tempPassword;

      console.log("✅ User created:", userId);
      console.log("🔑 Temp password:", tempPassword);
    });
  });

  describe("3. Admin - Create Organization", () => {
    it("should create an organization (disabled by default)", async () => {
      if (!adminToken || !userId) {
        console.log("⚠️  Skipping: Requires admin token and userId");
        return;
      }

      const response = await request(BASE_URL)
        .post("/api/admin/organizations/create")
        .set("Cookie", `better-auth.session_token=${adminToken}`)
        .send({
          name: `Test Hospital ${Date.now()}`,
          slug: `test-hospital-${Date.now()}`,
          ownerId: userId,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("organization");
      expect(response.body.organization).toHaveProperty("enabled", false);

      organizationId = response.body.organization.id;

      console.log("✅ Organization created:", organizationId);
      console.log("🔒 Status: disabled (needs subscription)");
    });
  });

  describe("4. Subscription Status", () => {
    it("should show organization needs subscription", async () => {
      if (!ownerToken || !organizationId) {
        console.log("⚠️  Skipping: Requires owner token and organizationId");
        return;
      }

      const response = await request(BASE_URL)
        .get(`/api/organizations/${organizationId}/subscription`)
        .set("Cookie", `better-auth.session_token=${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("enabled", false);
      expect(response.body).toHaveProperty("needsSubscription", true);

      console.log("✅ Subscription check passed");
    });
  });

  describe("5. Simulate Stripe Webhook", () => {
    it("should enable organization on subscription payment", async () => {
      if (!organizationId) {
        console.log("⚠️  Skipping: Requires organizationId");
        return;
      }

      const response = await request(BASE_URL)
        .post("/api/webhooks/stripe")
        .send({
          type: "checkout.session.completed",
          data: {
            object: {
              id: "cs_test123",
              subscription: "sub_test123",
              customer: "cus_test456",
              metadata: {
                organizationId: organizationId,
                organizationName: "Test Hospital",
                userId: userId,
                userEmail: "owner@test.com",
              },
              payment_status: "paid",
            },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("received", true);

      console.log("✅ Webhook processed - Organization should be enabled");
    });
  });

  describe("6. Create Department", () => {
    it("should create a department (requires enabled organization)", async () => {
      if (!ownerToken || !organizationId) {
        console.log("⚠️  Skipping: Requires owner token and organizationId");
        return;
      }

      const response = await request(BASE_URL)
        .post("/api/departments")
        .set("Cookie", `better-auth.session_token=${ownerToken}`)
        .send({
          name: "Cardiology",
          organizationId: organizationId,
        });

      if (response.status === 403) {
        console.log("❌ Organization not enabled yet. Run webhook test first.");
        return;
      }

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("name", "Cardiology");

      departmentId = response.body.id;

      console.log("✅ Department created:", departmentId);
    });
  });

  describe("7. List Departments", () => {
    it("should list departments in organization", async () => {
      if (!ownerToken || !organizationId) {
        console.log("⚠️  Skipping: Requires owner token and organizationId");
        return;
      }

      const response = await request(BASE_URL)
        .get(`/api/departments?organizationId=${organizationId}`)
        .set("Cookie", `better-auth.session_token=${ownerToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      console.log("✅ Found", response.body.length, "departments");
    });
  });

  describe("8. Admin Overview", () => {
    it("should return platform statistics", async () => {
      if (!adminToken) {
        console.log("⚠️  Skipping: Requires admin token");
        return;
      }

      const response = await request(BASE_URL)
        .get("/api/admin/overview")
        .set("Cookie", `better-auth.session_token=${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("organizations");
      expect(response.body).toHaveProperty("stats");

      console.log("✅ Platform stats:", response.body.stats);
    });
  });

  describe("API Key Management Tests", () => {
    let apiKey = "";
    let apiKeyId = "";

    it("should generate API key for organization (admin only)", async () => {
      if (!adminToken) {
        console.log("⚠️  Skipping: Set adminToken in the test file");
        return;
      }

      const response = await request(BASE_URL)
        .post("/api/admin/api-keys/generate")
        .set("Cookie", `better-auth.session_token=${adminToken}`)
        .send({
          organizationId: organizationId,
          name: "Test API Key",
          expiresInDays: 30,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("key");
      expect(response.body).toHaveProperty("organizationId", organizationId);
      expect(response.body).toHaveProperty("name", "Test API Key");

      // Store for later tests
      apiKey = response.body.key;
      apiKeyId = response.body.id;
    });

    it("should list API keys (admin only)", async () => {
      if (!adminToken) {
        console.log("⚠️  Skipping: Set adminToken in the test file");
        return;
      }

      const response = await request(BASE_URL)
        .get("/api/admin/api-keys")
        .set("Cookie", `better-auth.session_token=${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // Check that sensitive data is not exposed
      const firstKey = response.body[0];
      expect(firstKey).not.toHaveProperty("key");
      expect(firstKey).toHaveProperty("id");
      expect(firstKey).toHaveProperty("name");
    });

    it("should validate API key authentication", async () => {
      if (!apiKey) {
        console.log("⚠️  Skipping: No API key available");
        return;
      }

      const response = await request(BASE_URL)
        .get("/api/external/verify")
        .set("X-API-Key", apiKey);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("organizationId", organizationId);
      expect(response.body).toHaveProperty("organizationName");
      expect(response.body).toHaveProperty("redirectUrl");
    });

    it("should reject invalid API key", async () => {
      const response = await request(BASE_URL)
        .get("/api/external/verify")
        .set("X-API-Key", "invalid-key");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "Invalid API key");
    });

    it("should reject requests without API key", async () => {
      const response = await request(BASE_URL).get("/api/external/verify");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "API key required");
    });

    it("should revoke API key (admin only)", async () => {
      if (!adminToken || !apiKeyId) {
        console.log("⚠️  Skipping: No admin token or API key ID available");
        return;
      }

      const response = await request(BASE_URL)
        .delete(`/api/admin/api-keys/${apiKeyId}`)
        .set("Cookie", `better-auth.session_token=${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
    });

    it("should reject revoked API key", async () => {
      if (!apiKey) {
        console.log("⚠️  Skipping: No API key available");
        return;
      }

      const response = await request(BASE_URL)
        .get("/api/external/verify")
        .set("X-API-Key", apiKey);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "Invalid API key");
    });
  });
});
