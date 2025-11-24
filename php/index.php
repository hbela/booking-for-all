<?php
// connect.php - Secure API Key Proxy for External Apps
// This proxy handles multiple organizations and their API keys securely

// Load environment variables from .env file if it exists
function loadEnv($path)
{
    if (!file_exists($path)) {
        error_log('[PHP Proxy] loadEnv: File does not exist: ' . $path);
        return;
    }

    if (!is_readable($path)) {
        error_log('[PHP Proxy] loadEnv: File is not readable: ' . $path);
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    error_log('[PHP Proxy] loadEnv: Read ' . count($lines) . ' lines from .env file');

    $loadedCount = 0;
    foreach ($lines as $lineNum => $line) {
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
            $loadedCount++;
            error_log('[PHP Proxy] loadEnv: Loaded ' . $name . ' = ' . (strpos($name, 'KEY') !== false ? '***' : $value));
        } else {
            error_log('[PHP Proxy] loadEnv: Skipped ' . $name . ' (already set)');
        }
    }
    error_log('[PHP Proxy] loadEnv: Successfully loaded ' . $loadedCount . ' environment variables');
}

// Load .env file from the same directory as this script
// Supports both .env and .env.php formats
$envPath = __DIR__ . '/.env';
error_log('[PHP Proxy] Attempting to load .env from: ' . $envPath);
error_log('[PHP Proxy] .env file exists: ' . (file_exists($envPath) ? 'YES' : 'NO'));
if (file_exists($envPath)) {
    error_log('[PHP Proxy] .env file is readable: ' . (is_readable($envPath) ? 'YES' : 'NO'));
}
loadEnv($envPath);
// Verify loading worked
$wellnessCheck = getenv('WELLNESS_DOMAIN');
$medicareCheck = getenv('MEDICARE_DOMAIN');
error_log('[PHP Proxy] After loadEnv - WELLNESS_DOMAIN: ' . ($wellnessCheck ?: 'NOT SET'));
error_log('[PHP Proxy] After loadEnv - MEDICARE_DOMAIN: ' . ($medicareCheck ?: 'NOT SET'));

// Determine environment early (needed for config endpoint)
// Production: production, prod, live, local (Coolify uses 'local' for VPS/production)
// Development: development, dev, staging, test, etc.
$phpEnvRaw = getenv('APP_ENV') ?? 'development';
$phpEnv = strtolower($phpEnvRaw);
$isProduction = in_array($phpEnv, ['production', 'prod', 'live', 'local'], true);

// Handle config endpoint EARLY - returns PHP server URL based on APP_ENV
// This must be before CORS validation so it's always accessible
if (isset($_GET['config']) && $_GET['config'] === '1') {
    // Set CORS headers for config endpoint
    $requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['ORIGIN'] ?? '';
    if ($requestOrigin) {
        header("Access-Control-Allow-Origin: " . $requestOrigin);
        header("Access-Control-Allow-Credentials: true");
    } else {
        // Allow from any origin for config endpoint (it's safe, just returns URLs)
        header("Access-Control-Allow-Origin: *");
    }
    header("Content-Type: application/json");

    $phpServerUrl = $isProduction
        ? (getenv('PHP_SERVER_URL') ?: 'https://php.appointer.hu')
        : (getenv('PHP_SERVER_URL') ?: 'http://localhost:8000');

    echo json_encode([
        'phpServerUrl' => $phpServerUrl,
        'environment' => $phpEnv
    ]);
    exit;
}

// Handle debug endpoint - shows loaded env vars and organization configs (development only)
if (isset($_GET['debug']) && $_GET['debug'] === '1' && !$isProduction) {
    header("Content-Type: application/json");

    // Load organization configs to show them
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
                $organizationConfigs[$slug] = ['domain' => '', 'api_key' => '', 'name' => '', 'organization_id' => ''];
            }
            switch ($type) {
                case 'DOMAIN':
                    $organizationConfigs[$slug]['domain'] = normalizeDomain($value);
                    break;
                case 'API_KEY':
                    if ($value && $value !== "YOUR_" . strtoupper($matches[1]) . "_API_KEY_HERE") {
                        $organizationConfigs[$slug]['api_key'] = $value ? '***SET***' : '';
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

    echo json_encode([
        'envFileExists' => file_exists(__DIR__ . '/.env'),
        'envFile' => __DIR__ . '/.env',
        'wellnessDomain' => getenv('WELLNESS_DOMAIN'),
        'medicareDomain' => getenv('MEDICARE_DOMAIN'),
        'organizationConfigs' => $organizationConfigs,
        'requestOrigin' => $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['ORIGIN'] ?? 'none',
        'requestHost' => $_SERVER['HTTP_HOST'] ?? 'none'
    ], JSON_PRETTY_PRINT);
    exit;
}

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
// Environment already determined above
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

// Build dynamic allowed origins from organization configs (will be populated later)
// This function will be called after organization configs are loaded
function buildDynamicAllowedOrigins($organizationConfigs, $isProduction)
{
    $origins = [];

    if ($isProduction) {
        // In production, use https:// for all organization domains
        foreach ($organizationConfigs as $slug => $config) {
            if (!empty($config['domain'])) {
                $origins[] = 'https://' . $config['domain'];
            }
        }
    } else {
        // In development, include localhost variants and http:// for org domains with :5500 port
        $origins = [
            'http://localhost:3001',
            'http://localhost:5173',
            'http://localhost:5500',
            'http://127.0.0.1:3001',
            'http://127.0.0.1:5173',
            'http://127.0.0.1:5500',
            'http://[::1]:3001',
            'http://[::1]:5173',
        ];

        // Add all organization domains with :5500 port for development (HTTP)
        foreach ($organizationConfigs as $slug => $config) {
            if (!empty($config['domain'])) {
                $origins[] = 'http://' . $config['domain'] . ':5500';
            }
        }
        
        // Add HTTPS versions of organization domains for development (when using Caddy with HTTPS)
        foreach ($organizationConfigs as $slug => $config) {
            if (!empty($config['domain'])) {
                $origins[] = 'https://' . $config['domain'];
            }
        }
    }

    return $origins;
}

if (!$allowedOrigins) {
    // We'll build this dynamically after organization configs are loaded
    // For now, set a placeholder that will be replaced
    $allowedOrigins = ''; // Will be set dynamically
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
            http_response_code(200);
            exit;
        } else {
            // In development, allow localhost variations and any configured organization domains for OPTIONS
            if (!$isProduction) {
                $isLocalhost = strpos($requestOrigin, 'localhost') !== false ||
                    strpos($requestOrigin, '[::1]') !== false ||
                    strpos($requestOrigin, '127.0.0.1') !== false;

                // Check if origin matches any configured organization domain
                // For OPTIONS, we check env vars directly since organizationConfigs not loaded yet
                $matchesOrgDomain = false;
                $envVarsForCors = array_merge($_SERVER, $_ENV);
                php_proxy_log("OPTIONS preflight - Checking origin: " . $requestOrigin);
                foreach ($envVarsForCors as $key => $value) {
                    if (preg_match('/^([A-Z0-9_]+)_DOMAIN$/', $key, $matches) && is_string($value)) {
                        $domain = normalizeDomain($value);
                        php_proxy_log("OPTIONS - Found domain config: {$key} = {$domain}");
                        if (!empty($domain)) {
                            // Check if origin contains the domain (works for both http:// and https://)
                            if (strpos($requestOrigin, $domain) !== false) {
                                $matchesOrgDomain = true;
                                php_proxy_log("OPTIONS - Origin matches domain: {$requestOrigin} contains {$domain}");
                                break;
                            }
                        }
                    }
                }
                
                // Also check if origin hostname matches any domain (extract hostname from origin)
                if (!$matchesOrgDomain && !empty($requestOrigin)) {
                    $originHost = parse_url($requestOrigin, PHP_URL_HOST);
                    if ($originHost) {
                        php_proxy_log("OPTIONS - Extracted origin hostname: " . $originHost);
                        foreach ($envVarsForCors as $key => $value) {
                            if (preg_match('/^([A-Z0-9_]+)_DOMAIN$/', $key) && is_string($value)) {
                                $domain = normalizeDomain($value);
                                if (!empty($domain) && domainsMatch($originHost, $domain)) {
                                    $matchesOrgDomain = true;
                                    php_proxy_log("OPTIONS - Origin hostname matches domain: {$originHost} matches {$domain}");
                                    break;
                                }
                            }
                        }
                    }
                }

                if ($isLocalhost || $matchesOrgDomain) {
                    header("Access-Control-Allow-Origin: " . $requestOrigin);
                    php_proxy_log("OPTIONS - Origin allowed: " . $requestOrigin);
                    http_response_code(200);
                    exit;
                } else {
                    // Deny unknown origins
                    php_proxy_log("OPTIONS - Origin NOT allowed: " . $requestOrigin . " (isLocalhost: " . ($isLocalhost ? 'true' : 'false') . ", matchesOrgDomain: " . ($matchesOrgDomain ? 'true' : 'false') . ")");
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
        // In development, allow localhost variations and any configured organization domains
        if (!$isProduction) {
            $isLocalhost = strpos($requestOrigin, 'localhost') !== false ||
                strpos($requestOrigin, '[::1]') !== false ||
                strpos($requestOrigin, '127.0.0.1') !== false;

            // Check if origin matches any configured organization domain
            // Check env vars directly (same approach as OPTIONS handler)
            $matchesOrgDomain = false;
            php_proxy_log("Checking origin against organization domains: " . $requestOrigin);
            $envVarsForCors = array_merge($_SERVER, $_ENV);
            foreach ($envVarsForCors as $key => $value) {
                if (preg_match('/^([A-Z0-9_]+)_DOMAIN$/', $key, $matches) && is_string($value)) {
                    $domain = normalizeDomain($value);
                    php_proxy_log("Comparing origin with domain config: {$requestOrigin} vs {$domain}");
                    if (!empty($domain)) {
                        // Check if origin contains the domain (works for both http:// and https://)
                        if (strpos($requestOrigin, $domain) !== false) {
                            $matchesOrgDomain = true;
                            php_proxy_log("Origin matches domain (strpos): {$requestOrigin} contains {$domain}");
                            break;
                        }
                    }
                }
            }
            
            // Also check if origin hostname matches any domain (extract hostname from origin)
            if (!$matchesOrgDomain && !empty($requestOrigin)) {
                $originHost = parse_url($requestOrigin, PHP_URL_HOST);
                if ($originHost) {
                    php_proxy_log("Extracted origin hostname: " . $originHost);
                    foreach ($envVarsForCors as $key => $value) {
                        if (preg_match('/^([A-Z0-9_]+)_DOMAIN$/', $key) && is_string($value)) {
                            $domain = normalizeDomain($value);
                            if (!empty($domain) && domainsMatch($originHost, $domain)) {
                                $matchesOrgDomain = true;
                                php_proxy_log("Origin hostname matches domain: {$originHost} matches {$domain}");
                                break;
                            }
                        }
                    }
                }
            }

            if ($isLocalhost || $matchesOrgDomain) {
                header("Access-Control-Allow-Origin: " . $requestOrigin);
                php_proxy_log("Origin allowed (localhost/organization domain variation): " . $requestOrigin);
            } else {
                php_proxy_log("Origin NOT allowed: " . $requestOrigin . " (isLocalhost: " . ($isLocalhost ? 'true' : 'false') . ", matchesOrgDomain: " . ($matchesOrgDomain ? 'true' : 'false') . ")");
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
// Check both $_ENV and getenv() to ensure we catch all env vars
$envVars = array_merge($_SERVER, $_ENV);

// Handle backwards format: wellness.hu=wellness -> WELLNESS_DOMAIN=wellness.hu
// This is a fallback for incorrectly formatted .env files
foreach ($envVars as $key => $value) {
    if (!is_string($key) || !is_string($value)) {
        continue;
    }
    // Check if key is a domain (e.g., wellness.hu) and value is a slug (e.g., wellness)
    if (preg_match('/^[a-z0-9.-]+\.(hu|com|net|org|app)$/i', $key) && preg_match('/^[a-z0-9-_]+$/i', $value)) {
        // Convert wellness.hu=wellness -> WELLNESS_DOMAIN=wellness.hu
        $slug = strtoupper($value);
        $domainKey = $slug . '_DOMAIN';
        if (!isset($envVars[$domainKey])) {
            $envVars[$domainKey] = $key;
            putenv(sprintf('%s=%s', $domainKey, $key));
            $_ENV[$domainKey] = $key;
            $_SERVER[$domainKey] = $key;
            php_proxy_log("Converted backwards format: {$key}={$value} -> {$domainKey}={$key}");
        }
    }
}

// Also check getenv() for variables that might not be in $_ENV
$wellnessDomain = getenv('WELLNESS_DOMAIN');
$medicareDomain = getenv('MEDICARE_DOMAIN');
if ($wellnessDomain && !isset($envVars['WELLNESS_DOMAIN'])) {
    $envVars['WELLNESS_DOMAIN'] = $wellnessDomain;
}
if ($medicareDomain && !isset($envVars['MEDICARE_DOMAIN'])) {
    $envVars['MEDICARE_DOMAIN'] = $medicareDomain;
}

php_proxy_log("Loading organization configs from environment...");
php_proxy_log("WELLNESS_DOMAIN from getenv(): " . ($wellnessDomain ?: 'NOT SET'));
php_proxy_log("MEDICARE_DOMAIN from getenv(): " . ($medicareDomain ?: 'NOT SET'));

// Build dynamic allowed origins from organization configs (before they're populated)
// This will be updated after configs are loaded

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
                $normalized = normalizeDomain($value);
                $organizationConfigs[$slug]['domain'] = $normalized;
                php_proxy_log("Loaded {$key} = '{$value}' -> normalized to '{$normalized}' for slug '{$slug}'");
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
// Priority: Origin header > Referer header > HTTP_HOST
// This extracts the domain (e.g., wellness.appointer.hu or medicare.appointer.hu)
// regardless of the URL path (e.g., /wellness_external.html or /medicare_external.html)
$requestHost = '';
if (!empty($requestOrigin)) {
    $originParts = parse_url($requestOrigin);
    if ($originParts && isset($originParts['host'])) {
        $requestHost = strtolower($originParts['host']);
        php_proxy_log("Extracted host from Origin header: {$requestHost}");
    }
}

if ($requestHost === '' && !empty($_SERVER['HTTP_REFERER'])) {
    $refererParts = parse_url($_SERVER['HTTP_REFERER']);
    if ($refererParts && isset($refererParts['host'])) {
        $requestHost = strtolower($refererParts['host']);
        php_proxy_log("Extracted host from Referer header: {$requestHost}");
    }
}

if ($requestHost === '') {
    $requestHost = strtolower($_SERVER['HTTP_HOST'] ?? '');
    if ($requestHost) {
        php_proxy_log("Extracted host from HTTP_HOST: {$requestHost}");
    }
}

if ($requestHost === '') {
    php_proxy_log("WARNING: Could not extract request host from any source!");
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
    // Match domain using normalized host (without port) for proper comparison
    // This works for ALL organizations dynamically (wellness, medicare, hospital, etc.)
    // The domain is extracted from the Origin header (e.g., wellness.appointer.hu or medicare.appointer.hu)
    // and matched against WELLNESS_DOMAIN, MEDICARE_DOMAIN, etc. from environment variables
    // Works regardless of URL path (e.g., /wellness_external.html or /wellness/wellness_external.html)
    foreach ($organizationConfigs as $slug => $config) {
        if (!empty($config['domain']) && domainsMatch($config['domain'], $requestHostNormalized)) {
            $organizationSlug = $slug;
            php_proxy_log("Matched organization slug '{$slug}' for domain '{$requestHostNormalized}' (config domain: '{$config['domain']}')");
            break;
        }
    }
}

// Now that organization configs are loaded, build dynamic CORS origins if not explicitly set
if (empty($allowedOrigins)) {
    $dynamicOrigins = buildDynamicAllowedOrigins($organizationConfigs, $isProduction);
    $allowedOrigins = implode(',', $dynamicOrigins);
    php_proxy_log("Built dynamic allowed origins from organization configs: " . $allowedOrigins);
    // Rebuild allowed origins array with the new dynamic origins
    $allowedOriginsArray = array_map('trim', explode(',', $allowedOrigins));
}

php_proxy_log("Request Origin: " . ($requestOrigin ?: 'null'));
php_proxy_log("Request Host: " . ($requestHost ?: 'null'));
php_proxy_log("Request Host Normalized: " . ($requestHostNormalized ?? 'null'));
php_proxy_log("Slug Override: " . ($slugOverride ?? 'null'));
php_proxy_log("Allow Slug Override: " . ($allowSlugOverride ? 'true' : 'false'));
php_proxy_log("Available Organization Configs: " . implode(', ', array_keys($organizationConfigs)));
if (!empty($organizationConfigs)) {
    foreach ($organizationConfigs as $slug => $config) {
        php_proxy_log("  - {$slug}: domain='{$config['domain']}'");
    }
}
php_proxy_log("Matched Organization Slug: " . ($organizationSlug ?? 'null'));

// ---- Validate organization ----
if (empty($organizationConfigs)) {
    php_proxy_log("ERROR: No organization configurations found in environment variables!");
    php_proxy_log("Please ensure .env file contains variables like WELLNESS_DOMAIN, WELLNESS_API_KEY, etc.");
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "No organization configurations found. Please check PHP server environment variables."
    ]);
    exit;
}

if (!$organizationSlug || !isset($organizationConfigs[$organizationSlug])) {
    php_proxy_log("Unable to determine organization for host: {$requestHost}");
    php_proxy_log("Request Origin: {$requestOrigin}");
    php_proxy_log("Request Host Normalized: {$requestHostNormalized}");
    php_proxy_log("Slug override was: " . ($slugOverride ?? 'null'));
    php_proxy_log("Available slugs: " . implode(', ', array_keys($organizationConfigs)));
    php_proxy_log("Available domains: " . implode(', ', array_map(function ($c) {
        return $c['domain'];
    }, array_values($organizationConfigs))));
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Unable to determine organization for this domain. Request host: {$requestHostNormalized}. Please ensure WELLNESS_DOMAIN (or MEDICARE_DOMAIN) matches this domain in your .env file."
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
// Backend API returns nested structure: {success: true, data: {organizationId, ...}}
$apiData = $data['data'] ?? $data; // Support both nested and flat structures for backwards compatibility
if (!$data || !isset($apiData['organizationId'])) {
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
$_SESSION['validated_organization'] = $apiData['organizationId'];
$_SESSION['organization_slug'] = $organizationSlug;
$_SESSION['api_key_validated'] = true;
$_SESSION['expires_at'] = time() + 3600; // 1 hour expiration
$_SESSION['organization_name'] = $configuredOrganizationName ?: ($apiData['organizationName'] ?? '');
$_SESSION['configured_organization_id'] = $organizationIdentifier;
$_SESSION['request_origin_domain'] = $requestHost;

// ---- Prepare JSON output with clean redirect ----
// Use redirectUrl from API if provided, otherwise construct it
$redirectUrl = $apiData['redirectUrl'] ?? ($FRONTEND_REDIRECT . "?org=" . urlencode($apiData['organizationId'] ?? $organizationIdentifier));
echo json_encode([
    "success" => true,
    "organizationId" => $apiData['organizationId'] ?? $organizationIdentifier,
    "organizationName" => $configuredOrganizationName ?: ($apiData['organizationName'] ?? ''),
    "organization" => $organizationSlug,
    "redirectUrl" => $redirectUrl
]);
exit;

exit;
