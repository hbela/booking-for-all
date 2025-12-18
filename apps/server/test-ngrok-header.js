#!/usr/bin/env node

/**
 * Quick test to verify ngrok header works
 */

const BASE_URL = process.argv[2] || "https://2c70c7c57e60.ngrok-free.app";

async function test() {
  console.log(`Testing ngrok header with: ${BASE_URL}\n`);
  
  // Test 1: Without header
  console.log("1. Testing WITHOUT ngrok-skip-browser-warning header:");
  try {
    const res1 = await fetch(`${BASE_URL}/health`, {
      headers: { "Content-Type": "application/json" }
    });
    const text1 = await res1.text();
    console.log(`   Status: ${res1.status}`);
    console.log(`   Content-Type: ${res1.headers.get("content-type")}`);
    console.log(`   Is HTML: ${text1.includes("<!DOCTYPE html>")}\n`);
  } catch (e) {
    console.log(`   Error: ${e.message}\n`);
  }

  // Test 2: With header
  console.log("2. Testing WITH ngrok-skip-browser-warning header:");
  try {
    const res2 = await fetch(`${BASE_URL}/health`, {
      headers: { 
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true"
      }
    });
    const text2 = await res2.text();
    console.log(`   Status: ${res2.status}`);
    console.log(`   Content-Type: ${res2.headers.get("content-type")}`);
    console.log(`   Is HTML: ${text2.includes("<!DOCTYPE html>")}`);
    console.log(`   Response preview: ${text2.substring(0, 100)}`);
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }
}

test();

