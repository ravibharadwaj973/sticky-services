//lib/config

// The single place this service reads credentials from.
//
// Values land in process.env from AWS Secrets Manager (lib/secrets.js) before
// app.listen() runs, or from .env when AWS_SECRET_NAME is unset. Going through
// these accessors instead of touching process.env directly buys two things:
//
//   1. The read happens at CALL time, so it can never capture a value from
//      before the secret was loaded. Routes are require()d at the top of
//      app.js — long before loadSecrets() — so a module-scope
//      `const S = process.env.JWT_SECRET` would freeze in `undefined`.
//      Calling getJwtSecret() inside a handler cannot make that mistake.
//   2. A missing value fails with a message naming the key and where it should
//      have come from, instead of jsonwebtoken's "secretOrPrivateKey must have
//      a value".

const required = (key) => {
  const value = process.env[key];

  if (!value) {
    throw new Error(
      `${key} is not set. It comes from AWS Secrets Manager when AWS_SECRET_NAME ` +
      `is set, otherwise from services/todo-service/.env — see lib/secrets.js.`
    );
  }

  return value;
};

// This service only ever VERIFIES tokens — the core backend issues them. The
// value must be byte-identical there, which is why both read one shared secret.
const getJwtSecret = () => required('JWT_SECRET');

// Keeps the historical localhost fallback so an unconfigured local box still
// boots; in production loadSecrets() has already guaranteed a real value.
const getMongoUri = () => process.env.MONGODB_URI || 'mongodb://localhost:27017/your-db-name';

module.exports = { getJwtSecret, getMongoUri };
