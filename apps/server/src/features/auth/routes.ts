import type { FastifyPluginAsync } from 'fastify';
import { auth } from '@my-better-t-app/auth';
import { toNodeHandler } from 'better-auth/node';

const authRoutes: FastifyPluginAsync = async (_app) => {};

export default authRoutes;


