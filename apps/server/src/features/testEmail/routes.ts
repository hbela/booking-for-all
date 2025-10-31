import type { FastifyPluginAsync } from 'fastify';

const testEmailRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/test-email', async (req, reply) => {
    const { to, subject, message } = (req.body as any) || {};
    if (!to || !subject || !message) {
      return reply.status(400).send({ error: 'Missing required fields: to, subject, message' });
    }

    const emailData = {
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: [to],
      subject,
      html: `<p>${message}</p><p><strong>Test sent at:</strong> ${new Date().toISOString()}</p>`,
    } as const;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(emailData),
    });
    const result = await response.json();
    if (result.id) {
      return reply.send({ success: true, emailId: result.id, message: 'Test email sent successfully', resendDashboard: `https://resend.com/emails/${result.id}` });
    }
    return reply.status(400).send({ success: false, error: result.message || 'Failed to send email', details: result });
  });
};

export default testEmailRoutes;


