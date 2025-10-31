<?php
// connect.php - Secure API Key Proxy for External Apps
// This proxy handles multiple organizations and their API keys securely

// Start session for secure validation
session_start();

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *"); // Adjust or remove for production
header("Access-Control-Allow-Methods: GET, POST");
header("Access-Control-Allow-Headers: Content-Type, X-Organization-ID");

// ---- Configuration ----
$VERIFY_URL = "http://localhost:3000/api/external/verify";
$FRONTEND_REDIRECT = "http://localhost:3001/login";

// ---- API Key Configuration per Organization ----
// In production, these should be stored in a secure database or environment variables
$ORGANIZATION_API_KEYS = [
    // Organization 1: Wellness Center
    "wellness" => [
        "api_key" => "org-6f9f21273PR9udaKMOeKt07cqXDHY6-nND4QyD1OElGasPPGYIs",
        "name" => "Wellness Center",
        "organization_id" => "6f9f2127-2270-46d0-80a3-a1680dfb7044"
    ],
    // Organization 2: Medical Clinic
    "medical" => [
        "api_key" => "YOUR_MEDICAL_CLINIC_API_KEY_HERE",
        "name" => "Test Hospital",
        "organization_id" => "9c91d5a8-6dac-49ec-b488-6f803a81ae38"
    ],
    // Organization 3: Fitness Center
    "fitness" => [
        "api_key" => "YOUR_FITNESS_CENTER_API_KEY_HERE",
        "name" => "Fitness Center",
        "organization_id" => "org_fitness_001"
    ]
];

// ---- Get organization identifier ----
$organizationId = null;

// Method 1: From URL parameter (recommended for external apps)
if (isset($_GET['org'])) {
    $organizationId = $_GET['org'];
}
// Method 2: From POST data
elseif (isset($_POST['org'])) {
    $organizationId = $_POST['org'];
}
// Method 3: From custom header
elseif (isset($_SERVER['HTTP_X_ORGANIZATION_ID'])) {
    $organizationId = $_SERVER['HTTP_X_ORGANIZATION_ID'];
}

// Debug logging
error_log("PHP Debug - Organization ID: " . ($organizationId ?? 'null'));
error_log("PHP Debug - Available organizations: " . implode(', ', array_keys($ORGANIZATION_API_KEYS)));

// ---- Validate organization ----
if (!$organizationId || !isset($ORGANIZATION_API_KEYS[$organizationId])) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Invalid or missing organization identifier",
        "debug" => [
            "organizationId" => $organizationId,
            "available_organizations" => array_keys($ORGANIZATION_API_KEYS)
        ]
    ]);
    exit;
}

// ---- Get API key for organization ----
$orgConfig = $ORGANIZATION_API_KEYS[$organizationId];
$apiKey = $orgConfig['api_key'];

// ---- Call your Express API ----
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $VERIFY_URL);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "X-API-Key: $apiKey",
    "Content-Type: application/json"
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// ---- Handle errors ----
if ($httpCode !== 200 || !$response) {
    http_response_code($httpCode ?: 500);
    echo json_encode([
        "success" => false,
        "message" => "Verification failed for organization: " . $orgConfig['name'],
        "organization" => $organizationId,
        "details" => $response
    ]);
    exit;
}

// ---- Parse the response ----
$data = json_decode($response, true);
if (!$data || !isset($data['organizationId'])) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Invalid response from API",
        "organization" => $organizationId
    ]);
    exit;
}

// ---- Set secure session data ----
$_SESSION['validated_organization'] = $data['organizationId'];
$_SESSION['organization_slug'] = $organizationId;
$_SESSION['api_key_validated'] = true;
$_SESSION['expires_at'] = time() + 3600; // 1 hour expiration
$_SESSION['organization_name'] = $data['organizationName'];

// ---- Prepare JSON output with clean redirect ----
echo json_encode([
    "success" => true,
    "organizationId" => $data['organizationId'],
    "organizationName" => $data['organizationName'],
    "organization" => $organizationId,
    "redirectUrl" => $FRONTEND_REDIRECT . "?org=" . urlencode($data['organizationId']) // Include org ID for signup/login
]);
exit;
