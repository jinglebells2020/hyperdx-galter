import type { MeApiResponse } from '@hyperdx/common-utils/dist/types';
import express from 'express';

import { AI_API_KEY, ANTHROPIC_API_KEY, USAGE_STATS_ENABLED } from '@/config';
import { getTeam } from '@/controllers/team';
import User from '@/models/user';
import { Api404Error } from '@/utils/errors';
import { sendJson } from '@/utils/serialization';

const router = express.Router();

router.get('/', async (req, res: express.Response<MeApiResponse>, next) => {
  try {
    if (req.user == null) {
      throw new Api404Error('Request without user found');
    }

    const {
      _id: id,
      accessKey,
      createdAt,
      email,
      name,
      team: teamId,
    } = req.user;

    const team = await getTeam(teamId);
    if (team == null) {
      throw new Api404Error(`Team not found for user ${id}`);
    }

    return sendJson(res, {
      accessKey,
      createdAt,
      email,
      id,
      name,
      team,
      usageStatsEnabled: USAGE_STATS_ENABLED,
      aiAssistantEnabled: !!(AI_API_KEY || ANTHROPIC_API_KEY),
    });
  } catch (e) {
    next(e);
  }
});

// FIB §54 — surface last successful login + failed-attempt counter to the
// authenticated user so they can detect credential abuse. Read-only.
router.get('/login-history', async (req, res, next) => {
  try {
    if (req.user == null) {
      throw new Api404Error('Request without user found');
    }
    const u = await User.findById(req.user._id).select(
      'lastLoginAt lastLoginIp lastFailedLoginAt lastFailedLoginIp failedLoginCountSinceLastSuccess passwordChangedAt passwordExpiresAt mustChangePasswordOnNextLogin role',
    );
    if (!u) {
      throw new Api404Error('User not found');
    }
    res.json({
      role: u.role ?? 'user',
      lastLoginAt: u.lastLoginAt ?? null,
      lastLoginIp: u.lastLoginIp ?? null,
      lastFailedLoginAt: u.lastFailedLoginAt ?? null,
      lastFailedLoginIp: u.lastFailedLoginIp ?? null,
      failedLoginCountSinceLastSuccess:
        u.failedLoginCountSinceLastSuccess ?? 0,
      passwordChangedAt: u.passwordChangedAt ?? null,
      passwordExpiresAt: u.passwordExpiresAt ?? null,
      mustChangePasswordOnNextLogin: !!u.mustChangePasswordOnNextLogin,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
