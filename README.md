# German Academy

A small Express and PostgreSQL app for managing students, teachers, courses, classes, enrollments, attendance, payments, and expenses.

## Run locally

1. Install Node.js (20 or later) and PostgreSQL.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` and a long random `JWT_SECRET`.
3. Create a PostgreSQL database and load the schema once:

   ```sh
   psql "$DATABASE_URL" -f db/schema.sql
   ```

4. Install dependencies and start the app:

   ```sh
   npm ci
   npm start
   ```

The app listens on `PORT` (default `3000`) and serves the interface at `/`. The `/health` endpoint returns `200` when the web process is running.

Create the first administrator after the schema is loaded:

```sh
npm run create-admin -- "Administrator Name" admin@example.com "a-long-password"
```

## Deploy on Railway

1. Create a Railway project and add a PostgreSQL service.
2. Add this repository as a web service. Railway detects the Node app and runs the `npm start` script from `package.json`.
3. In the web service variables, set:
   - `DATABASE_URL` to the PostgreSQL service's `DATABASE_URL` using Railway's variable reference picker.
   - `JWT_SECRET` to a long random secret (for example, generate 32 random bytes with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
4. Initialize the database schema once against the Railway database using the Railway PostgreSQL connection and `db/schema.sql`. Do not run it on every deploy; it contains non-idempotent `CREATE TABLE` statements.
5. Run `npm run create-admin -- "Administrator Name" admin@example.com "a-long-password"` once with the Railway service's environment, using Railway's service shell or a one-off command.
6. Set the service healthcheck path to `/health`, then generate a public domain for the web service. Railway supplies `PORT`; the app binds to `0.0.0.0`.

Keep production secrets in Railway variables. `.env` files are ignored by Git.
