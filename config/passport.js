const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;

const configurePassport = () => {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_ID,
    clientSecret: process.env.GOOGLE_SECRET,
    callbackURL: "/api/users/auth/google/callback",
    passReqToCallback: true
  }, (req, accessToken, refreshToken, profile, done) => {
    req.user = {
      provider: 'google',
      profile: {
        id: profile.id,
        name: profile.displayName,
        email: profile.emails[0].value,
      }
    };
    done(null, req.user || {});
  }));

  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_ID,
    clientSecret: process.env.GITHUB_SECRET,
    callbackURL: "/api/users/auth/github/callback",
    passReqToCallback: true
  }, (req, accessToken, refreshToken, profile, done) => {
    req.user = {
      provider: 'github',
      profile: {
        id: profile.id,
        name: profile.displayName || profile.username,
        email: profile.emails[0].value,
      }
    };
    done(null, req.user || {});
  }));
};

module.exports = configurePassport;
