import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';

import { findUserById } from '@/controllers/user';
import type { UserDocument } from '@/models/user';
import User from '@/models/user';
import { auditLogin } from '@/services/audit';
import { recordLoginFailure, recordLoginSuccess } from '@/services/loginGuard';

import logger from './logger';

passport.serializeUser(function (user, done) {
  done(null, (user as any)._id);
});

passport.deserializeUser(function (id: string, done) {
  findUserById(id)
    .then(user => {
      if (user == null) {
        return done(new Error('User not found'));
      }
      done(null, user as UserDocument);
    })
    .catch(done);
});

// Use local passport strategy via passport-local-mongoose plugin
const passportLocalMongooseAuthenticate = (User as any).authenticate();

passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passReqToCallback: true,
    },
    async function (req, username, password, done) {
      try {
        // FIB §22: refuse before bcrypt-compare if the account is locked.
        // FIB §24: refuse if the password has expired.
        const existing = await User.findOne({ email: username.toLowerCase() });
        if (existing) {
          if (existing.lockedUntil && existing.lockedUntil.getTime() > Date.now()) {
            await auditLogin(
              'denied',
              {
                actorEmail: username,
                actorUserId: existing._id,
                teamId: existing.team,
                action: 'login.blocked.locked',
                errorMessage: `Account locked until ${existing.lockedUntil.toISOString()}`,
              },
              req as any,
            );
            return done(null, false, {
              message: 'Account is locked due to too many failed attempts.',
            });
          }
          if (
            existing.passwordExpiresAt &&
            existing.passwordExpiresAt.getTime() < Date.now()
          ) {
            await auditLogin(
              'denied',
              {
                actorEmail: username,
                actorUserId: existing._id,
                teamId: existing.team,
                action: 'login.blocked.passwordExpired',
                errorMessage: 'Password expired',
              },
              req as any,
            );
            return done(null, false, {
              message: 'Password expired. Please reset it via the admin.',
            });
          }
        }

        const { user, error } = await passportLocalMongooseAuthenticate(
          username,
          password,
        );

        if (user) {
          await recordLoginSuccess(user, req as any);
          await auditLogin(
            'success',
            {
              actorEmail: user.email,
              actorUserId: user._id,
              teamId: user.team,
            },
            req as any,
          );
        } else {
          await recordLoginFailure(username, req as any, error?.message);
          await auditLogin(
            'failure',
            {
              actorEmail: username,
              actorUserId: existing?._id,
              teamId: existing?.team,
              errorMessage: error?.message,
            },
            req as any,
          );
          logger.info({
            message: `Login for "${username}" failed, ${error}"`,
            type: 'user_login',
            authType: 'password',
          });
        }
        return done(null, user, error);
      } catch (err) {
        logger.error({ err, username }, 'Login failed with error');
        return done(err);
      }
    },
  ),
);

export default passport;
