import type { MeApiResponse } from '@hyperdx/common-utils/dist/types';
import express from 'express';
import { z } from 'zod';
import { validateRequest } from 'zod-express-middleware';

import { AI_API_KEY, ANTHROPIC_API_KEY, USAGE_STATS_ENABLED } from '@/config';
import { getTeam } from '@/controllers/team';
import User from '@/models/user';
import { changeUserPassword } from '@/services/passwordPolicy';
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

// FIB §24 — password change requiring old + new, with history + expiration
// enforcement. New password must not reuse any of the last 5 hashes.
const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(12, 'Password must have at least 12 characters')
      .refine(
        pass => /[a-z]/.test(pass) && /[A-Z]/.test(pass),
        'Password must include both lower and upper case characters',
      )
      .refine(
        pass => /\d/.test(pass),
        'Password must include at least one number',
      )
      .refine(
        pass => /[!@#$%^&*(),.?":{}|<>;\-+=]/.test(pass),
        'Password must include at least one special character',
      ),
    confirmPassword: z.string(),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

router.post(
  '/password-change',
  validateRequest({ body: changePasswordSchema }),
  async (req, res, next) => {
    try {
      if (req.user == null) {
        throw new Api404Error('Request without user found');
      }
      const result = await changeUserPassword({
        actor: req.user as any,
        oldPassword: req.body.oldPassword,
        newPassword: req.body.newPassword,
        req,
      });
      if (result.ok) {
        return res.json({ status: 'success' });
      }
      return res.status(400).json({ error: result.code, message: result.message });
    } catch (e) {
      next(e);
    }
  },
);

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
