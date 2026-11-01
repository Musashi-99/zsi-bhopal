const { signToken } = require('./auth');
const { COOKIE_NAME } = require('../middleware/auth');

const WEEK = 7 * 24 * 60 * 60 * 1000;

function cookieOptions() {
  const prod = process.env.NODE_ENV === 'production';
  return { httpOnly: true, sameSite: prod ? 'none' : 'lax', secure: prod, maxAge: WEEK, path: '/' };
}

function startSession(res, user) {
  res.cookie(COOKIE_NAME, signToken({ userId: user.id, role: user.role }), cookieOptions());
}

module.exports = { cookieOptions, startSession };
