import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from './env.js';
import User from '../models/User.model.js';
import { logger } from '../src/utils/logger.js';

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error('No email from Google profile'), null);

          let user = await User.findOne({ googleId: profile.id });
          if (!user) {
            user = await User.findOne({ email });
            if (user) {
              user.googleId = profile.id;
              await user.save();
            } else {
              user = await User.create({
                email,
                fullName: profile.displayName || email,
                googleId: profile.id,
                role: 'patient',
                isActive: true,
              });
            }
          }
          return done(null, user);
        } catch (err) {
          logger.error('Google OAuth error', { error: err.message });
          return done(err, null);
        }
      }
    )
  );
} else {
  logger.info('Google OAuth credentials not set — Google login disabled');
}

export default passport;
