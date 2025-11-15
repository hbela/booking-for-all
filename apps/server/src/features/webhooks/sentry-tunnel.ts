import type { FastifyPluginAsync } from "fastify";

const sentryTunnel: FastifyPluginAsync = async (app) => {
  app.post("/sentry-tunnel", { config: { rawBody: true } }, async (req, reply) => {
    try {
      app.log.info("Sentry tunnel: Request received", {
        contentType: req.headers["content-type"],
        contentLength: req.headers["content-length"],
      });

      // @ts-expect-error provided by @fastify/raw-body
      const rawBody: Buffer | string | undefined = req.rawBody;

      if (!rawBody) {
        app.log.error("Sentry tunnel: No rawBody available");
        return reply.status(400).send({ error: "No body provided" });
      }

      // Ensure we have a Buffer
      const bodyBuffer = Buffer.isBuffer(rawBody)
        ? rawBody
        : Buffer.from(typeof rawBody === "string" ? rawBody : String(rawBody));

      if (bodyBuffer.length === 0) {
        app.log.error("Sentry tunnel: Empty body");
        return reply.status(400).send({ error: "No body provided" });
      }

      app.log.info("Sentry tunnel: Body buffer ready", { size: bodyBuffer.length });

      // Parse the Sentry envelope to extract project ID from the header
      // Envelope format: header (JSON) + newline + payload
      const envelopeText = bodyBuffer.toString("utf8");
      const firstNewline = envelopeText.indexOf("\n");

      if (firstNewline === -1) {
        app.log.error("Sentry tunnel: Invalid envelope format (no newline)", {
          envelopePreview: envelopeText.substring(0, 200),
        });
        return reply.status(400).send({ error: "Invalid envelope format" });
      }

      const headerText = envelopeText.substring(0, firstNewline);
      app.log.info("Sentry tunnel: Parsing header", { headerText });

      let header: any;
      try {
        header = JSON.parse(headerText);
      } catch (parseError) {
        app.log.error(parseError, "Sentry tunnel: Failed to parse envelope header", {
          headerText,
        });
        return reply.status(400).send({ error: "Invalid envelope header" });
      }

      // Extract project ID from DSN in header
      const dsn = header.dsn;
      if (!dsn) {
        app.log.error("Sentry tunnel: No DSN in envelope header", { header });
        return reply.status(400).send({ error: "No DSN in envelope" });
      }

      app.log.info("Sentry tunnel: Extracted DSN", { dsn });

      // Parse DSN: https://publicKey@host/projectId
      const dsnMatch = dsn.match(/https?:\/\/[^@]+@[^/]+\/(\d+)/);
      if (!dsnMatch) {
        app.log.error("Sentry tunnel: Invalid DSN format", { dsn });
        return reply.status(400).send({ error: "Invalid DSN format" });
      }

      const projectId = dsnMatch[1];
      const dsnUrl = new URL(dsn);
      const host = dsnUrl.host;

      const ingestUrl = `https://${host}/api/${projectId}/envelope/`;

      app.log.info(`Sentry tunnel: Forwarding ${bodyBuffer.length} bytes to ${ingestUrl}`, {
        projectId,
        host,
        dsn: dsn.replace(/\/\/[^@]+@/, "//***@"), // Hide public key in logs
      });

      const response = await fetch(ingestUrl, {
        method: "POST",
        headers: {
          "content-type": "application/x-sentry-envelope",
        },
        body: bodyBuffer,
      });

      const responseText = await response.text();
      app.log.info(`Sentry tunnel: Response status ${response.status}`, {
        responseLength: responseText.length,
        responseText: responseText || "(empty)",
        responsePreview: responseText.substring(0, 500),
        responseHeaders: Object.fromEntries(response.headers.entries()),
      });
      
      // Log if Sentry returned an error
      if (!response.ok) {
        app.log.error(`Sentry tunnel: Sentry returned error status ${response.status}`, {
          responseText,
        });
      } else if (responseText) {
        // Sentry might return JSON with status info
        try {
          const responseJson = JSON.parse(responseText);
          app.log.info("Sentry tunnel: Sentry response JSON", { responseJson });
        } catch (e) {
          // Not JSON, log the raw text
          app.log.info("Sentry tunnel: Sentry response (not JSON)", { 
            responseText,
            parseError: e instanceof Error ? e.message : String(e),
          });
        }
      } else {
        app.log.warn("Sentry tunnel: Empty response from Sentry (this might be normal)");
      }
      
      reply.status(response.status).send(responseText);
    } catch (error) {
      app.log.error(error, "Sentry tunnel error");
      reply.status(500).send({ error: "Tunnel error" });
    }
  });
};

export default sentryTunnel;

