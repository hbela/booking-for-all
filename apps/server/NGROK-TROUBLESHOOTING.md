# Ngrok 502 Bad Gateway Troubleshooting

A 502 Bad Gateway error means ngrok can reach the internet but can't connect to your local server.

## Quick Checks

### 1. Is your server running?

Check if the server is running on port 3000:

```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000
# Or on Linux/Mac:
# lsof -i :3000
```

### 2. Verify ngrok is forwarding to the correct port

Your ngrok command should be:

```bash
ngrok http 3000
```

Or if using ngrok config:

```yaml
version: "2"
authtoken: YOUR_TOKEN
tunnels:
  server:
    addr: 3000
    proto: http
```

### 3. Check server is listening on the correct interface

Your server should listen on `0.0.0.0` (all interfaces), not just `localhost`. 
Check `apps/server/src/server.ts` - it should have:

```typescript
const host = process.env.HOST || '0.0.0.0';
```

### 4. Test locally first

Before testing through ngrok, verify the server works locally:

```bash
# Start server
cd apps/server
pnpm dev

# In another terminal, test locally
node test-auth-endpoints.js http://localhost:3000
```

### 5. Common Issues

**Issue: Server not running**
- Solution: Start the server with `pnpm dev` in `apps/server`

**Issue: Wrong port**
- Solution: Make sure ngrok forwards to the same port your server uses (default: 3000)

**Issue: Server listening on localhost only**
- Solution: Set `HOST=0.0.0.0` in your `.env` or ensure server.ts uses `0.0.0.0`

**Issue: Firewall blocking connections**
- Solution: Check Windows Firewall isn't blocking port 3000

## Test Server Locally

Once server is running, test locally:

```bash
# Test health endpoint
curl http://localhost:3000/health

# Test auth endpoint
curl -X POST http://localhost:3000/api/auth/sign-up \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123456","name":"Test"}'
```

If localhost works but ngrok doesn't, the issue is with ngrok configuration, not your server.

