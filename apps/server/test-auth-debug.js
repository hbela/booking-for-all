#!/usr/bin/env node

/**
 * Debug script to test better-auth endpoints
 * Tests different route variations to see what works
 */

const BASE_URL = process.argv[2] || "http://localhost:3000";
const testEmail = `debug-${Date.now()}@example.com`;
const testPassword = "testPassword123";

async function testEndpoint(method, path, body = null, headers = {}) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      // Add ngrok-skip-browser-warning header to bypass ngrok verification page
      "ngrok-skip-browser-warning": "true",
      ...headers,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { 
        error: "No JSON response", 
        rawResponse: text.substring(0, 500),
        contentType: response.headers.get("content-type")
      };
    }
    return {
      path,
      status: response.status,
      statusText: response.statusText,
      data,
      headers: Object.fromEntries(response.headers.entries()),
    };
  } catch (error) {
    return {
      path,
      error: error.message,
      stack: error.stack,
    };
  }
}

async function runTests() {
  console.log(`\n🔍 Testing Better-Auth endpoints at: ${BASE_URL}\n`);

  // Test Better Auth endpoints (using correct /email suffix)
  const routesToTest = [
    { method: "POST", path: "/api/auth/sign-up/email", body: { email: testEmail, password: testPassword, name: "Test User" } },
    { method: "POST", path: "/api/auth/sign-in/email", body: { email: testEmail, password: testPassword } },
    { method: "GET", path: "/api/auth/get-session" },
    { method: "GET", path: "/api" },
  ];

  for (const route of routesToTest) {
    console.log(`\n📡 Testing ${route.method} ${route.path}`);
    const result = await testEndpoint(route.method, route.path, route.body);
    console.log(`   Status: ${result.status || "ERROR"}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    } else {
      console.log(`   Response:`, JSON.stringify(result.data, null, 2).substring(0, 200));
    }
  }

  // Test health endpoint to verify server is running
  console.log(`\n📡 Testing GET /health (server health check)`);
  const healthResult = await testEndpoint("GET", "/health");
  console.log(`   Status: ${healthResult.status || "ERROR"}`);
  if (healthResult.data) {
    console.log(`   Response:`, JSON.stringify(healthResult.data, null, 2));
  }
}

runTests().catch(console.error);

