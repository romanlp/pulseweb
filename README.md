# Pulseweb

Pulseweb is a TanStack Start application deployed to Cloudflare Workers. Users
sign in with Better Auth, then explicitly link a Google account for Google
Health access.

## Local development

Install dependencies and create the local environment file:

```bash
bun install
cp .env.example .env.local
```

Replace every placeholder in `.env.local`. Generate `BETTER_AUTH_SECRET` with a
cryptographically secure value of at least 32 bytes, for example:

```bash
openssl rand -base64 32
```

Apply the local D1 migrations and start the app:

```bash
bun run db:migrate
bun --bun run dev
```

## Google OAuth configuration

Pulseweb uses Better Auth's Google provider for both Google sign-in and explicit
Google Health account linking. Better Auth owns the OAuth state, PKCE, callback,
token exchange, and token refresh flow. OAuth tokens are stored in the linked
Better Auth `account` row in D1 and are encrypted before persistence.

### Google Cloud

1. Enable the **Google Health API** in the appropriate Google Cloud project.
2. Configure the OAuth consent screen. Request only
   `https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly`.
3. Create an OAuth 2.0 **Web application** client.
4. Register these exact authorized redirect URIs:

   ```text
   http://localhost:3000/api/auth/callback/google
   https://<production-domain>/api/auth/callback/google
   ```

The scheme, host, port, path, and trailing slash must match exactly. The
production URI must use HTTPS. Use separate Google Cloud projects or OAuth
clients for development and production.

While an external consent screen remains in **Testing**, add each developer as
a test user. Google refresh tokens for sensitive scopes normally expire after
seven days in this mode, so long-lived connection testing requires the
appropriate production publishing and verification status.

### Required environment variables

| Variable | Purpose |
| --- | --- |
| `BETTER_AUTH_URL` | Canonical app origin, without a trailing slash. Better Auth derives the callback from this value. |
| `BETTER_AUTH_SECRET` | Stable high-entropy key used to sign auth state and encrypt stored OAuth tokens. |
| `GOOGLE_CLIENT_ID` | OAuth web-client ID for the current environment. |
| `GOOGLE_CLIENT_SECRET` | OAuth web-client secret for the current environment. |

Do not rotate `BETTER_AUTH_SECRET` casually: changing it invalidates signed auth
state and can make encrypted OAuth tokens unreadable. Use Better Auth's
versioned-secret rotation support for a planned rotation.

If OAuth rows existed before `encryptOAuthTokens` was enabled, audit or replace
those rows before production. Enabling encryption protects newly written token
values but is not a complete migration of every existing plaintext value.

### Cloudflare production setup

Set `BETTER_AUTH_URL` and `GOOGLE_CLIENT_ID` as environment-specific Worker
variables, using the production origin and production Google client. Store the
sensitive values with Wrangler:

```bash
bunx wrangler secret put BETTER_AUTH_SECRET
bunx wrangler secret put GOOGLE_CLIENT_SECRET
```

Then apply D1 migrations and deploy:

```bash
bun run db:migrate:remote
bun run deploy
```

Do not reuse production secrets in local development or preview environments.
Before releasing, confirm the deployed Worker has all four variables and that
`BETTER_AUTH_URL` matches the authorized production callback's origin.

### OAuth smoke test

Before a release, verify:

1. Email/password and Google sign-in both create valid Pulseweb sessions.
2. An authenticated user can explicitly connect Google Health.
3. The callback returns to `/health` without `redirect_uri_mismatch` or state
   errors.
4. Reloading and signing in from a new browser session preserves the connection.
5. An expired access token refreshes without user interaction.
6. A missing or rejected refresh token produces `reconnect_required`.
7. OAuth tokens never appear in browser storage, URLs, client responses, or logs.

Official references:

- [Better Auth configuration](https://better-auth.com/docs/reference/options)
- [Better Auth Google provider](https://better-auth.com/docs/authentication/google)
- [Google OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google OAuth production policies](https://developers.google.com/identity/protocols/oauth2/policies)
- [Cloudflare environment variables](https://developers.cloudflare.com/workers/configuration/environment-variables/)

## Building for production

```bash
bun --bun run build
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

### Removing Tailwind CSS

If you prefer not to use Tailwind CSS:

1. Remove the demo pages in `src/routes/demo/`
2. Replace the Tailwind import in `src/styles.css` with your own styles
3. Remove `tailwindcss()` from the plugins array in `vite.config.ts`
4. Remove `@tailwindcss/vite` and `tailwindcss` from `package.json`


## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
})
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from '@tanstack/react-start'

const getServerTime = createServerFn({
  method: 'GET',
}).handler(async () => {
  return new Date().toISOString()
})

// Use in a component
function MyComponent() {
  const [time, setTime] = useState('')
  
  useEffect(() => {
    getServerTime().then(setTime)
  }, [])
  
  return <div>Server time: {time}</div>
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/hello')({
  server: {
    handlers: {
      GET: () => json({ message: 'Hello, World!' }),
    },
  },
})
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/people')({
  loader: async () => {
    const response = await fetch('https://swapi.dev/api/people')
    return response.json()
  },
  component: PeopleComponent,
})

function PeopleComponent() {
  const data = Route.useLoaderData()
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  )
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).



# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).
