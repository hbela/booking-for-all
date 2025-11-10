<?php
// connect.php - Secure API Key Proxy for External Apps
// This proxy handles multiple organizations and their API keys securely

// Load environment variables from .env file if it exists
function loadEnv($path)
{
    if (!file_exists($path)) {
        return;
    }
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        // Skip empty lines and comments
        if (empty($line) || strpos($line, '#') === 0) {
            continue;
        }
        // Check if line contains = sign
        if (strpos($line, '=') === false) {
            continue; // Skip lines without = sign
        }
        list($name, $value) = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value);

        // Remove quotes if present (single or double)
        if ((substr($value, 0, 1) === '"' && substr($value, -1) === '"') ||
            (substr($value, 0, 1) === "'" && substr($value, -1) === "'")
        ) {
            $value = substr($value, 1, -1);
        }

        // Only set if not already set in environment
        if (!array_key_exists($name, $_SERVER) && !array_key_exists($name, $_ENV)) {
            putenv(sprintf('%s=%s', $name, $value));
            $_ENV[$name] = $value;
            $_SERVER[$name] = $value;
        }
    }
}

// Load .env file from the same directory as this script
// Supports both .env and .env.php formats
loadEnv(__DIR__ . '/.env');

// ---- CORS Configuration ----
// SECURITY FIX: Restrict CORS to specific allowed origins
$allowedOrigins = getenv('ALLOWED_CORS_ORIGINS');
if (!$allowedOrigins) {
    // Default to localhost for development (both IPv4 and IPv6)
    $allowedOrigins = 'http://localhost:3001,http://localhost:5173,http://[::1]:3001,http://[::1]:5173';
}
$allowedOriginsArray = array_map('trim', explode(',', $allowedOrigins));

// Get the request origin (check both HTTP_ORIGIN and ORIGIN headers)
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['ORIGIN'] ?? '';

// Normalize localhost origins (IPv6 ::1 -> IPv4 localhost)
if ($requestOrigin === 'http://[::1]:3001' || $requestOrigin === 'http://[::1]:5173') {
    $requestOrigin = str_replace('[::1]', 'localhost', $requestOrigin);
}

// Set CORS headers first (before any validation)
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Organization-ID, X-API-Key");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Max-Age: 3600"); // Cache preflight for 1 hour

// Handle OPTIONS preflight request FIRST
// OPTIONS requests need CORS headers - actual origin validation happens on the real request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    // For OPTIONS preflight, check origin if present
    if (!empty($requestOrigin)) {
        // Normalize for comparison
        $normalizedOrigins = array_map(function ($origin) {
            return str_replace('[::1]', 'localhost', $origin);
        }, $allowedOriginsArray);

        $normalizedRequestOrigin = str_replace('[::1]', 'localhost', $requestOrigin);

        if (
            in_array($normalizedRequestOrigin, $normalizedOrigins) ||
            in_array($requestOrigin, $allowedOriginsArray)
        ) {
            header("Access-Control-Allow-Origin: " . $requestOrigin);
        } else {
            // In development, allow localhost variations for OPTIONS
            if (getenv('PHP_ENV') !== 'production') {
                if (
                    strpos($requestOrigin, 'localhost') !== false ||
                    strpos($requestOrigin, '[::1]') !== false ||
                    strpos($requestOrigin, '127.0.0.1') !== false
                ) {
                    header("Access-Control-Allow-Origin: " . $requestOrigin);
                } else {
                    // Deny unknown origins
                    http_response_code(403);
                    exit;
                }
            } else {
                // Production: deny unknown origins
                http_response_code(403);
                exit;
            }
        }
    } else {
        // No origin header in OPTIONS - this can happen with some clients
        // In development, allow it; in production, use first allowed origin
        if (getenv('PHP_ENV') !== 'production') {
            header("Access-Control-Allow-Origin: " . ($allowedOriginsArray[0] ?? '*'));
        } else {
            // Production: use first allowed origin (more secure than *)
            header("Access-Control-Allow-Origin: " . ($allowedOriginsArray[0] ?? '*'));
        }
    }
    http_response_code(200);
    exit;
}

// For non-OPTIONS requests, validate origin strictly
if (!empty($requestOrigin)) {
    // Normalize for comparison
    $normalizedOrigins = array_map(function ($origin) {
        return str_replace('[::1]', 'localhost', $origin);
    }, $allowedOriginsArray);

    $normalizedRequestOrigin = str_replace('[::1]', 'localhost', $requestOrigin);

    if (
        in_array($normalizedRequestOrigin, $normalizedOrigins) ||
        in_array($requestOrigin, $allowedOriginsArray)
    ) {
        header("Access-Control-Allow-Origin: " . $requestOrigin);
    } else {
        // In development, allow localhost variations
        if (getenv('PHP_ENV') !== 'production') {
            if (
                strpos($requestOrigin, 'localhost') !== false ||
                strpos($requestOrigin, '[::1]') !== false ||
                strpos($requestOrigin, '127.0.0.1') !== false
            ) {
                header("Access-Control-Allow-Origin: " . $requestOrigin);
            } else {
                http_response_code(403);
                echo json_encode([
                    "success" => false,
                    "message" => "Origin not allowed"
                ]);
                exit;
            }
        } else {
            // Production: strict validation
            http_response_code(403);
            echo json_encode([
                "success" => false,
                "message" => "Origin not allowed"
            ]);
            exit;
        }
    }
} else {
    // No origin header - allow (direct access)
    header("Access-Control-Allow-Origin: " . ($allowedOriginsArray[0] ?? '*'));
}

// Start session for secure validation
session_start();

header("Content-Type: application/json");

// ---- Configuration ----
$VERIFY_URL = getenv('VERIFY_URL') ?: "http://localhost:3000/api/external/verify";
$FRONTEND_REDIRECT = getenv('FRONTEND_REDIRECT') ?: "http://localhost:3001/login";

// ---- API Key Configuration per Organization ----
// SECURITY FIX: Load API keys from environment variables only
// No hardcoded values - all organizations must be configured via environment variables
$ORGANIZATION_API_KEYS = [];

// Load API keys from environment variables in format: SLUG_API_KEY, SLUG_NAME, SLUG_ORG_ID
// This allows dynamic loading of any number of organizations without code changes
$envVars = array_merge($_SERVER, $_ENV);
foreach ($envVars as $key => $value) {
    // Look for keys matching the pattern: SLUG_API_KEY
    if (preg_match('/^([A-Z_]+)_API_KEY$/', $key, $matches)) {
        $slug = strtolower($matches[1]);

        // Get the corresponding name and org_id
        $nameKey = $matches[1] . '_NAME';
        $orgIdKey = $matches[1] . '_ORG_ID';

        $name = getenv($nameKey) ?: ($_ENV[$nameKey] ?? ucfirst(str_replace('_', ' ', $matches[1])));
        $orgId = getenv($orgIdKey) ?: ($_ENV[$orgIdKey] ?? "");

        if ($value && $value !== "YOUR_" . $matches[1] . "_API_KEY_HERE") {
            $ORGANIZATION_API_KEYS[$slug] = [
                "api_key" => $value,
                "name" => $name,
                "organization_id" => $orgId
            ];
        }
    }
}

// ---- Get organization identifier ----
$organizationId = null;

// Method 1: From URL parameter (recommended for external apps)
if (isset($_GET['org'])) {
    // SECURITY FIX: Sanitize and validate input
    $organizationId = filter_var(trim($_GET['org']), FILTER_SANITIZE_STRING);
    // Only allow alphanumeric, underscore, and hyphen
    if (!preg_match('/^[a-z0-9_-]+$/i', $organizationId)) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Invalid organization identifier format"
        ]);
        exit;
    }
}
// Method 2: From POST data
elseif (isset($_POST['org'])) {
    $organizationId = filter_var(trim($_POST['org']), FILTER_SANITIZE_STRING);
    if (!preg_match('/^[a-z0-9_-]+$/i', $organizationId)) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Invalid organization identifier format"
        ]);
        exit;
    }
}
// Method 3: From custom header
elseif (isset($_SERVER['HTTP_X_ORGANIZATION_ID'])) {
    $organizationId = filter_var(trim($_SERVER['HTTP_X_ORGANIZATION_ID']), FILTER_SANITIZE_STRING);
    if (!preg_match('/^[a-z0-9_-]+$/i', $organizationId)) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Invalid organization identifier format"
        ]);
        exit;
    }
}

// SECURITY FIX: Remove debug logging in production
// Only log in development mode
if (getenv('PHP_ENV') === 'development') {
    error_log("PHP Debug - Organization ID: " . ($organizationId ?? 'null'));
}

// ---- Validate organization ----
if (!$organizationId || !isset($ORGANIZATION_API_KEYS[$organizationId])) {
    http_response_code(400);
    // SECURITY FIX: Remove debug information from production responses
    echo json_encode([
        "success" => false,
        "message" => "Invalid or missing organization identifier"
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
    // SECURITY FIX: Remove sensitive details from error responses
    echo json_encode([
        "success" => false,
        "message" => "Verification failed. Please try again later."
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
