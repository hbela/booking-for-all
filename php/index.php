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

// Log all incoming requests for debugging
error_log(sprintf(
    '[PHP Proxy] %s %s from %s',
    $_SERVER['REQUEST_METHOD'] ?? 'UNKNOWN',
    $_SERVER['REQUEST_URI'] ?? '/',
    $_SERVER['REMOTE_ADDR'] ?? 'unknown'
));

/**
 * Normalize a domain value from configuration.
 *
 * @param string $value
 * @return string normalized domain (lowercase host without scheme or trailing slash)
 */
function normalizeDomain($value)
{
    if (!is_string($value)) {
        return '';
    }

    $domain = strtolower(trim($value));

    if ($domain === '') {
        return '';
    }

    // Remove protocol if present
    if (strpos($domain, '://') !== false) {
        $parsed = parse_url($domain);
        if ($parsed && isset($parsed['host'])) {
            $domain = strtolower($parsed['host']);
        }
    }

    // Remove any trailing slash characters
    $domain = rtrim($domain, '/');

    return $domain;
}

/**
 * Compare two domains allowing for a leading www. difference.
 *
 * @param string $domainA
 * @param string $domainB
 * @return bool
 */
function domainsMatch($domainA, $domainB)
{
    $a = strtolower($domainA);
    $b = strtolower($domainB);

    if ($a === $b) {
        return true;
    }

    $aStripped = preg_replace('/^www\./', '', $a);
    $bStripped = preg_replace('/^www\./', '', $b);

    return $aStripped === $bStripped;
}

// ---- CORS Configuration ----
// SECURITY FIX: Restrict CORS to specific allowed origins
$allowedOrigins = getenv('ALLOWED_CORS_ORIGINS');
// Determine environment
$phpEnvRaw = getenv('APP_ENV') ?? 'development';
$phpEnv = strtolower($phpEnvRaw);
$isProduction = in_array($phpEnv, ['production', 'prod', 'live'], true);
$shouldLogDebug = !$isProduction || filter_var(getenv('PHP_DEBUG_LOG'), FILTER_VALIDATE_BOOLEAN);

function php_proxy_log($message)
{
    global $shouldLogDebug;

    if (!$shouldLogDebug) {
        return;
    }

    $formatted = is_string($message) ? $message : print_r($message, true);
    error_log('[PHP Proxy] ' . $formatted);
}
if (!$allowedOrigins) {
    if ($isProduction) {
        $allowedOrigins = 'https://wellness.appointer.hu,https://medicare.appointer.hu';
    } else {
        // Default development origins (both IPv4 and IPv6)
        $allowedOrigins = implode(',', [
            'http://localhost:3001',
            'http://localhost:5173',
            'http://localhost:5500',
            'http://127.0.0.1:3001',
            'http://127.0.0.1:5173',
            'http://127.0.0.1:5500',
            'http://[::1]:3001',
            'http://[::1]:5173',
        ]);
    }
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
header("Access-Control-Allow-Headers: Content-Type, X-Organization-ID, X-API-Key, X-Organization-Slug");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Max-Age: 3600"); // Cache preflight for 1 hour

// Handle OPTIONS preflight request FIRST
// OPTIONS requests need CORS headers - actual origin validation happens on the real request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    error_log('[PHP Proxy] OPTIONS preflight - Origin: ' . ($requestOrigin ?: 'none'));
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
            if (!$isProduction) {
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
        if (!$isProduction) {
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
error_log('[PHP Proxy] Processing ' . $_SERVER['REQUEST_METHOD'] . ' request');
error_log('[PHP Proxy] Request Origin: ' . ($requestOrigin ?: 'none'));
error_log('[PHP Proxy] Allowed Origins: ' . implode(', ', $allowedOriginsArray));

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
        error_log('[PHP Proxy] Origin allowed (exact match)');
    } else {
        // In development, allow localhost variations
        if (!$isProduction) {
            if (
                strpos($requestOrigin, 'localhost') !== false ||
                strpos($requestOrigin, '[::1]') !== false ||
                strpos($requestOrigin, '127.0.0.1') !== false
            ) {
                header("Access-Control-Allow-Origin: " . $requestOrigin);
                error_log('[PHP Proxy] Origin allowed (localhost variation)');
            } else {
                error_log('[PHP Proxy] Origin NOT allowed: ' . $requestOrigin);
                http_response_code(403);
                echo json_encode([
                    "success" => false,
                    "message" => "Origin not allowed"
                ]);
                exit;
            }
        } else {
            // Production: strict validation
            error_log('[PHP Proxy] Origin NOT allowed (production): ' . $requestOrigin);
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
    error_log('[PHP Proxy] No origin header, using default');
    header("Access-Control-Allow-Origin: " . ($allowedOriginsArray[0] ?? '*'));
}

// Start session for secure validation
session_start();

header("Content-Type: application/json");

// ---- Configuration ----
$VERIFY_URL = getenv('VERIFY_URL') ?: "http://localhost:3000/api/external/verify";
$FRONTEND_REDIRECT = getenv('FRONTEND_REDIRECT') ?: "http://localhost:3001/login";

// ---- Organization configuration from environment ----
// Load values defined as <PREFIX>_DOMAIN, <PREFIX>_API_KEY, <PREFIX>_NAME, <PREFIX>_ORG_ID
$organizationConfigs = [];
$envVars = array_merge($_SERVER, $_ENV);

foreach ($envVars as $key => $value) {
    if (!is_string($key)) {
        continue;
    }

    if (preg_match('/^([A-Z0-9_]+)_(DOMAIN|API_KEY|NAME|ORG_ID)$/', $key, $matches)) {
        $slug = strtolower($matches[1]);
        $type = $matches[2];

        if (!isset($organizationConfigs[$slug])) {
            $organizationConfigs[$slug] = [
                "domain" => "",
                "api_key" => "",
                "name" => "",
                "organization_id" => ""
            ];
        }

        switch ($type) {
            case 'DOMAIN':
                $organizationConfigs[$slug]['domain'] = normalizeDomain($value);
                break;
            case 'API_KEY':
                if ($value && $value !== "YOUR_" . strtoupper($matches[1]) . "_API_KEY_HERE") {
                    $organizationConfigs[$slug]['api_key'] = $value;
                }
                break;
            case 'NAME':
                $organizationConfigs[$slug]['name'] = $value;
                break;
            case 'ORG_ID':
                $organizationConfigs[$slug]['organization_id'] = $value;
                break;
        }
    }
}

// ---- Detect requesting domain ----
$requestHost = '';
if (!empty($requestOrigin)) {
    $originParts = parse_url($requestOrigin);
    if ($originParts && isset($originParts['host'])) {
        $requestHost = strtolower($originParts['host']);
    }
}

if ($requestHost === '' && !empty($_SERVER['HTTP_REFERER'])) {
    $refererParts = parse_url($_SERVER['HTTP_REFERER']);
    if ($refererParts && isset($refererParts['host'])) {
        $requestHost = strtolower($refererParts['host']);
    }
}

if ($requestHost === '') {
    $requestHost = strtolower($_SERVER['HTTP_HOST'] ?? '');
}

$organizationSlug = null;

$slugOverride = null;
// Normalize request host by removing port for comparison
$requestHostNormalized = $requestHost;
if (strpos($requestHost, ':') !== false) {
    $requestHostNormalized = substr($requestHost, 0, strpos($requestHost, ':'));
}
$allowSlugOverride = in_array(
    $requestHostNormalized,
    [
        'localhost',
        '127.0.0.1',
        '[::1]',
        '::1',
    ],
    true
);

if (!empty($_GET['slug'])) {
    $slugOverride = strtolower(preg_replace('/[^a-z0-9-_]/i', '', $_GET['slug']));
} elseif (!empty($_SERVER['HTTP_X_ORGANIZATION_SLUG'])) {
    $slugOverride = strtolower(preg_replace('/[^a-z0-9-_]/i', '', $_SERVER['HTTP_X_ORGANIZATION_SLUG']));
}

if ($slugOverride && isset($organizationConfigs[$slugOverride]) && $allowSlugOverride) {
    $organizationSlug = $slugOverride;
    php_proxy_log("Using organization slug override from request: {$slugOverride}");
}

if (!$organizationSlug) {
    foreach ($organizationConfigs as $slug => $config) {
        if (!empty($config['domain']) && domainsMatch($config['domain'], $requestHost)) {
            $organizationSlug = $slug;
            break;
        }
    }
}

php_proxy_log("Request Host: " . ($requestHost ?: 'null'));
php_proxy_log("Request Host Normalized: " . ($requestHostNormalized ?? 'null'));
php_proxy_log("Slug Override: " . ($slugOverride ?? 'null'));
php_proxy_log("Allow Slug Override: " . ($allowSlugOverride ? 'true' : 'false'));
php_proxy_log("Available Organization Configs: " . implode(', ', array_keys($organizationConfigs)));
php_proxy_log("Matched Organization Slug: " . ($organizationSlug ?? 'null'));

// ---- Validate organization ----
if (!$organizationSlug || !isset($organizationConfigs[$organizationSlug])) {
    php_proxy_log("Unable to determine organization for host: {$requestHost}");
    php_proxy_log("Slug override was: " . ($slugOverride ?? 'null'));
    php_proxy_log("Available slugs: " . implode(', ', array_keys($organizationConfigs)));
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Unable to determine organization for this domain"
    ]);
    exit;
}

$orgConfig = $organizationConfigs[$organizationSlug];

if (empty($orgConfig['api_key'])) {
    php_proxy_log("Organization configuration incomplete for slug: {$organizationSlug}");
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Organization configuration incomplete"
    ]);
    exit;
}

$apiKey = $orgConfig['api_key'];
$organizationIdentifier = $orgConfig['organization_id'] ?: $organizationSlug;
$configuredOrganizationName = $orgConfig['name'];

// ---- Call your Express API ----
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $VERIFY_URL);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "X-API-Key: $apiKey",
    "Content-Type: application/json"
]);
$response = curl_exec($ch);
$curlError = curl_error($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// ---- Handle errors ----
if ($httpCode !== 200 || !$response) {
    php_proxy_log([
        'message' => 'Verification request failed',
        'http_code' => $httpCode ?: 0,
        'curl_error' => $curlError,
        'verify_url' => $VERIFY_URL,
        'organization' => $organizationSlug
    ]);
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
    php_proxy_log([
        'message' => 'Invalid verification response payload',
        'response' => $response,
        'organization' => $organizationSlug
    ]);
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Invalid response from API",
        "organization" => $organizationSlug
    ]);
    exit;
}

// ---- Set secure session data ----
$_SESSION['validated_organization'] = $data['organizationId'];
$_SESSION['organization_slug'] = $organizationSlug;
$_SESSION['api_key_validated'] = true;
$_SESSION['expires_at'] = time() + 3600; // 1 hour expiration
$_SESSION['organization_name'] = $configuredOrganizationName ?: ($data['organizationName'] ?? '');
$_SESSION['configured_organization_id'] = $organizationIdentifier;
$_SESSION['request_origin_domain'] = $requestHost;

// ---- Prepare JSON output with clean redirect ----
echo json_encode([
    "success" => true,
    "organizationId" => $data['organizationId'] ?? $organizationIdentifier,
    "organizationName" => $configuredOrganizationName ?: ($data['organizationName'] ?? ''),
    "organization" => $organizationSlug,
    "redirectUrl" => $FRONTEND_REDIRECT . "?org=" . urlencode($data['organizationId'] ?? $organizationIdentifier) // Include org ID for signup/login
]);
exit;

exit;
