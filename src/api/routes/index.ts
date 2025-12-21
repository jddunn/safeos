/**
 * API Routes Index
 *
 * Central export for all API routes.
 *
 * @module api/routes
 */

import { Router } from 'express';
import streamRoutes from './streams.js';
import alertRoutes from './alerts.js';
import profileRoutes from './profiles.js';
import analysisRoutes from './analysis.js';
import systemRoutes from './system.js';
import notificationRoutes from './notifications.js';
import reviewRoutes from './review.js';

// =============================================================================
// API Router
// =============================================================================

const apiRouter = Router();

// Mount routes
apiRouter.use('/streams', streamRoutes);
apiRouter.use('/alerts', alertRoutes);
apiRouter.use('/profiles', profileRoutes);
apiRouter.use('/analysis', analysisRoutes);
apiRouter.use('/system', systemRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/review', reviewRoutes);

export default apiRouter;

