Welcome to your new TanStack Start app!

# Getting Started

To run this application:

```bash
bun install
bun --bun run dev
```

## Google Health API POC

This app reads reconciled Google Health activity (steps, distance, zone minutes,
energy, workouts, and VO₂ max) from the last seven days using the Google Health
API v4.

Users must **sign into a Pulseweb account first** (Better Auth, email/password or
Google). Google Health is then connected as a **secondary Better Auth account**
linked to that Pulseweb user — it is not a separate login. Connecting and reading
data happens inside the protected `/health` page.

Google OAuth access and refresh tokens are stored in **Cloudflare D1** in the
linked Better Auth `account` row, never in browser cookies. Access tokens
**refresh automatically** when they expire. A reconnect prompt appears only when
Google Health cannot be used at all — for example if Google revokes or rejects
the refresh token, or if the linked account is missing the required scope.
Access-token expiry alone never triggers a reconnect.

### Google Cloud configuration

1. Enable the **Google Health API**.
2. Create an OAuth 2.0 **Web application** client.
3. Add the Better Auth Google callback as an **authorized redirect URI** for both
   local and production origins:

   ```text
   http://localhost:3000/api/auth/callback/google
   https://<production-domain>/api/auth/callback/google
   ```

4. Add the
   `https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly`
   scope to the OAuth consent screen and add your Google account as a test user.
5. Create `.env.local`:

```bash
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
APP_ORIGIN="http://localhost:3000"
```

For Cloudflare, store the client ID and secret with `wrangler secret put` and
configure `APP_ORIGIN` to use the deployed HTTPS origin. Configure `APP_ORIGIN`
and the matching authorized redirect URI for production before deploying.

### Google OAuth testing-mode limitation

While the external OAuth app's publishing status is `Testing`, Google normally
issues **refresh tokens that expire after seven days**. Long-lived connection
acceptance cannot be verified until the OAuth app has the appropriate production
publishing status.

# Database

Drizzle ORM connects to the existing Cloudflare D1 database through the
`prod_pulseweb_db` binding in `wrangler.jsonc`. Define tables in
`src/db/schema.ts`, then generate and apply migrations with:

```bash
bun run db:generate
bun run db:migrate
```

`bun run dev` uses the local D1 database stored in `.wrangler`. Apply migrations
to the remote D1 database only when intended:

```bash
bun run db:migrate:remote
```

# Building For Production

To build this application for production:

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


## Deploy to Cloudflare Workers

This project uses the Cloudflare Vite plugin (configured in `vite.config.ts`) and `wrangler.jsonc`:

1. Install Wrangler: `npm install -g wrangler`
2. Authenticate: `wrangler login`
3. Deploy: `npx wrangler deploy`

For production env vars, run `wrangler secret put MY_VAR` for each secret listed in `.env.example`. Public (non-secret) vars go in `wrangler.jsonc` under `vars`.

KV, D1, R2, and Durable Object bindings are configured in `wrangler.jsonc` — see https://developers.cloudflare.com/workers/wrangler/configuration/.



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
