# Local Caddy Proxy for `wellness.hu`

Use this setup when Live Server/Five Server refuses connections for the custom hostname even though it is reachable via `127.0.0.1`.

## Prerequisites

- `wellness.hu` must point to `127.0.0.1` in `C:\Windows\System32\drivers\etc\hosts`.
- Live Server (or Five Server) has to run on **port 5501** and bind to `127.0.0.1`.

> Tip: in VS Code settings search for `liveServer.settings.port` (or `fiveServer.port`) and set it to `5501`. Leave the host as `127.0.0.1`.

## Caddy configuration

1. Ensure the `Caddyfile.dev` in the repo root contains:

   ```
   {
     auto_https off
     admin off
   }

   http://wellness.hu:5500 {
     encode gzip
     reverse_proxy 127.0.0.1:5501
   }
   ```

   This makes Caddy listen on `wellness.hu:5500` while forwarding every request to Live Server on `127.0.0.1:5501`.

2. Start Live Server/Five Server so it serves `wellness_external.html` on `http://127.0.0.1:5501/wellness/wellness_external.html`.

3. In a terminal at the project root run:

   ```
   caddy run --config Caddyfile.dev
   ```

4. Visit `http://wellness.hu:5500/wellness/wellness_external.html`. The browser connects to Caddy (which does listen on `wellness.hu`) and Caddy proxies traffic to Live Server.

## Troubleshooting

- If you see `address already in use` when starting Caddy, stop Live Server, change its port to `5501`, restart it, then relaunch Caddy.
- If the browser still refuses the connection, confirm `caddy run` is printing `serving initial configuration` without errors and that Windows Firewall allows `caddy.exe`.
- To stop Caddy press `Ctrl+C` in the terminal where it is running.

