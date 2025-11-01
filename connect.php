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
            (substr($value, 0, 1) === "'" && substr($value, -1) === "'")) {
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
        $normalizedOrigins = array_map(function($origin) {
            return str_replace('[::1]', 'localhost', $origin);
        }, $allowedOriginsArray);
        
        $normalizedRequestOrigin = str_replace('[::1]', 'localhost', $requestOrigin);
        
        if (in_array($normalizedRequestOrigin, $normalizedOrigins) || 
            in_array($requestOrigin, $allowedOriginsArray)) {
            header("Access-Control-Allow-Origin: " . $requestOrigin);
        } else {
            // In development, allow localhost variations for OPTIONS
            if (getenv('PHP_ENV') !== 'production') {
                if (strpos($requestOrigin, 'localhost') !== false || 
                    strpos($requestOrigin, '[::1]') !== false ||
                    strpos($requestOrigin, '127.0.0.1') !== false) {
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
    $normalizedOrigins = array_map(function($origin) {
        return str_replace('[::1]', 'localhost', $origin);
    }, $allowedOriginsArray);
    
    $normalizedRequestOrigin = str_replace('[::1]', 'localhost', $requestOrigin);
    
    if (in_array($normalizedRequestOrigin, $normalizedOrigins) || 
        in_array($requestOrigin, $allowedOriginsArray)) {
        header("Access-Control-Allow-Origin: " . $requestOrigin);
    } else {
        // In development, allow localhost variations
        if (getenv('PHP_ENV') !== 'production') {
            if (strpos($requestOrigin, 'localhost') !== false || 
                strpos($requestOrigin, '[::1]') !== false ||
                strpos($requestOrigin, '127.0.0.1') !== false) {
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
// SECURITY FIX: Load API keys from environment variables
// Falls back to hardcoded values if env vars not set (for backward compatibility)
$ORGANIZATION_API_KEYS = [];

// Wellness Center
// Check both getenv() and $_ENV (in case one doesn't work)
$wellnessApiKey = getenv('WELLNESS_API_KEY') ?: ($_ENV['WELLNESS_API_KEY'] ?? null);
if ($wellnessApiKey) {
    $ORGANIZATION_API_KEYS["wellness"] = [
        "api_key" => $wellnessApiKey,
        "name" => getenv('WELLNESS_NAME') ?: ($_ENV['WELLNESS_NAME'] ?? "Wellness Center"),
        "organization_id" => getenv('WELLNESS_ORG_ID') ?: ($_ENV['WELLNESS_ORG_ID'] ?? "")
    ];
} else {
    // FALLBACK: Use hardcoded value if env var not set (for development/migration)
    // SECURITY WARNING: This should be moved to .env file in production!
    $phpEnv = getenv('PHP_ENV') ?: ($_ENV['PHP_ENV'] ?? '');
    if ($phpEnv === 'development' || $phpEnv === '') {
        $ORGANIZATION_API_KEYS["wellness"] = [
            "api_key" => "0f55219535594f6b8be71094e5026e1c",
            "name" => "Wellness Center",
            "organization_id" => "8f79bdba-7095-4a47-90c7-a2e839cc413b"
        ];
        // Log warning only in development
        $phpEnv = getenv('PHP_ENV') ?: ($_ENV['PHP_ENV'] ?? '');
        if ($phpEnv !== 'production') {
            error_log("SECURITY WARNING: Using hardcoded API key for 'wellness'. Set WELLNESS_API_KEY in .env file.");
        }
    }
}

// Medical Clinic
$medicalApiKey = getenv('MEDICAL_API_KEY') ?: ($_ENV['MEDICAL_API_KEY'] ?? null);
if ($medicalApiKey && $medicalApiKey !== 'YOUR_MEDICAL_CLINIC_API_KEY_HERE') {
    $ORGANIZATION_API_KEYS["medical"] = [
        "api_key" => $medicalApiKey,
        "name" => getenv('MEDICAL_NAME') ?: ($_ENV['MEDICAL_NAME'] ?? "Test Hospital"),
        "organization_id" => getenv('MEDICAL_ORG_ID') ?: ($_ENV['MEDICAL_ORG_ID'] ?? "")
    ];
}

// Fitness Center
$fitnessApiKey = getenv('FITNESS_API_KEY') ?: ($_ENV['FITNESS_API_KEY'] ?? null);
if ($fitnessApiKey && $fitnessApiKey !== 'YOUR_FITNESS_CENTER_API_KEY_HERE') {
    $ORGANIZATION_API_KEYS["fitness"] = [
        "api_key" => $fitnessApiKey,
        "name" => getenv('FITNESS_NAME') ?: ($_ENV['FITNESS_NAME'] ?? "Fitness Center"),
        "organization_id" => getenv('FITNESS_ORG_ID') ?: ($_ENV['FITNESS_ORG_ID'] ?? "")
    ];
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
