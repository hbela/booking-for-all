#!/usr/bin/env node

/**
 * Standalone script to test Better-Auth API endpoints
 * 
 * Requirements: Node.js 18+ (for built-in fetch) or install node-fetch
 * 
 * Usage: 
 *   node test-auth-endpoints.js [baseURL]
 *   npm run test:auth:standalone [baseURL]
 * 
 * Examples:
 *   node test-auth-endpoints.js http://localhost:3000
 *   node test-auth-endpoints.js https://2c70c7c57e60.ngrok-free.app
 */

// Check for Node.js version
const nodeVersion = process.versions.node.split('.')[0];
if (parseInt(nodeVersion) < 18) {
  console.error('❌ This script requires Node.js 18+ for built-in fetch support');
  console.error('   Current Node.js version:', process.versions.node);
  process.exit(1);
}

const BASE_URL = process.argv[2] || "http://localhost:3000";

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, "green");
}

function logError(message) {
  log(`❌ ${message}`, "red");
}

function logInfo(message) {
  log(`ℹ️  ${message}`, "blue");
}

function logTest(message) {
  log(`\n🧪 ${message}`, "cyan");
}

// Store test data
let sessionToken = "";
let userId = "";
const testEmail = `test-${Date.now()}@example.com`;
const testPassword = "testPassword123";

async function makeRequest(method, endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    // Add ngrok-skip-browser-warning header to bypass ngrok verification page
    "ngrok-skip-browser-warning": "true",
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // Check if it's ngrok warning page
      if (text.includes("ngrok") || text.includes("<!DOCTYPE html>")) {
        return { 
          error: "Ngrok browser warning page detected",
          status: response.status,
          isNgrokWarning: true,
          rawResponse: text.substring(0, 200)
        };
      }
      data = { error: "No JSON response", rawResponse: text.substring(0, 200) };
    }
    return { status: response.status, data, headers: Object.fromEntries(response.headers.entries()) };
  } catch (error) {
    return { error: error.message };
  }
}

async function testSignUp() {
  logTest("Testing POST /api/auth/sign-up");

  const result = await makeRequest("POST", "/api/auth/sign-up", {
    body: {
      email: testEmail,
      password: testPassword,
      name: "Test User",
    },
  });

  if (result.error) {
    logError(`Request failed: ${result.error}`);
    return false;
  }

  console.log("Response:", JSON.stringify(result, null, 2));

  if (result.status === 200 && result.data?.data?.user && result.data?.data?.session) {
    sessionToken = result.data.data.session.token;
    userId = result.data.data.user.id;
    logSuccess("Sign-up successful");
    logInfo(`User ID: ${userId}`);
    logInfo(`Session Token: ${sessionToken.substring(0, 20)}...`);
    return true;
  } else {
    logError(`Sign-up failed: ${result.status} - ${JSON.stringify(result.data)}`);
    return false;
  }
}

async function testDuplicateSignUp() {
  logTest("Testing duplicate email rejection");

  const result = await makeRequest("POST", "/api/auth/sign-up", {
    body: {
      email: testEmail,
      password: testPassword,
      name: "Duplicate User",
    },
  });

  if (result.status === 400 || result.status === 409) {
    logSuccess("Duplicate email correctly rejected");
    return true;
  } else {
    logError(`Expected 400/409, got ${result.status}`);
    return false;
  }
}

async function testSignIn() {
  logTest("Testing POST /api/auth/sign-in");

  const result = await makeRequest("POST", "/api/auth/sign-in", {
    body: {
      email: testEmail,
      password: testPassword,
    },
  });

  console.log("Response:", JSON.stringify(result, null, 2));

  if (result.status === 200 && result.data?.data?.session) {
    sessionToken = result.data.data.session.token;
    logSuccess("Sign-in successful");
    return true;
  } else {
    logError(`Sign-in failed: ${result.status}`);
    return false;
  }
}

async function testWrongPassword() {
  logTest("Testing incorrect password rejection");

  const result = await makeRequest("POST", "/api/auth/sign-in", {
    body: {
      email: testEmail,
      password: "wrongPassword123",
    },
  });

  if (result.status === 401) {
    logSuccess("Wrong password correctly rejected");
    return true;
  } else {
    logError(`Expected 401, got ${result.status}`);
    return false;
  }
}

async function testGetSession() {
  logTest("Testing GET /api/auth/session with Bearer token");

  const result = await makeRequest("GET", "/api/auth/session", {
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  console.log("Response:", JSON.stringify(result, null, 2));

  if (result.status === 200 && result.data?.data?.session && result.data?.data?.user) {
    logSuccess("Session retrieved successfully");
    return true;
  } else {
    logError(`Get session failed: ${result.status}`);
    return false;
  }
}

async function testGetSessionUnauthenticated() {
  logTest("Testing GET /api/auth/session without authentication");

  const result = await makeRequest("GET", "/api/auth/session");

  if (result.status === 401) {
    logSuccess("Unauthenticated request correctly rejected");
    return true;
  } else {
    logError(`Expected 401, got ${result.status}`);
    return false;
  }
}

async function testSignOut() {
  logTest("Testing POST /api/auth/sign-out with Bearer token");

  const result = await makeRequest("POST", "/api/auth/sign-out", {
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  console.log("Response:", JSON.stringify(result, null, 2));

  if (result.status === 200 && result.data?.data?.success === true) {
    logSuccess("Sign-out successful");
    return true;
  } else {
    logError(`Sign-out failed: ${result.status}`);
    return false;
  }
}

async function testSessionAfterSignOut() {
  logTest("Testing session invalidation after sign-out");

  const result = await makeRequest("GET", "/api/auth/session", {
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  if (result.status === 401) {
    logSuccess("Session correctly invalidated after sign-out");
    return true;
  } else {
    logError(`Session still valid after sign-out: ${result.status}`);
    return false;
  }
}

async function runAllTests() {
  log(`\n${colors.bright}🚀 Starting Better-Auth API Endpoint Tests${colors.reset}`);
  log(`Base URL: ${BASE_URL}`);
  log(`Test Email: ${testEmail}\n`);

  const results = [];

  // Test 1: Sign Up
  results.push(await testSignUp());
  if (!results[results.length - 1]) {
    logError("Sign-up failed, stopping tests");
    return;
  }

  // Test 2: Duplicate Sign Up
  results.push(await testDuplicateSignUp());

  // Test 3: Sign In
  results.push(await testSignIn());
  if (!results[results.length - 1]) {
    logError("Sign-in failed, stopping tests");
    return;
  }

  // Test 4: Wrong Password
  results.push(await testWrongPassword());

  // Test 5: Get Session
  results.push(await testGetSession());

  // Test 6: Get Session Unauthenticated
  results.push(await testGetSessionUnauthenticated());

  // Test 7: Sign Out
  results.push(await testSignOut());

  // Test 8: Session After Sign Out
  results.push(await testSessionAfterSignOut());

  // Summary
  const passed = results.filter((r) => r === true).length;
  const total = results.length;

  log(`\n${colors.bright}📊 Test Summary${colors.reset}`);
  log(`Passed: ${passed}/${total}`);

  if (passed === total) {
    logSuccess("All tests passed! 🎉");
    process.exit(0);
  } else {
    logError(`Some tests failed. ${total - passed} test(s) failed.`);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((error) => {
  logError(`Test execution failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});

