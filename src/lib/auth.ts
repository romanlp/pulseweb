import {betterAuth} from "better-auth";
import {drizzleAdapter} from "better-auth/adapters/drizzle";
import {getDb} from "@/db/db-client.server";
import {tanstackStartCookies} from "better-auth/tanstack-start"; // your drizzle instance

export const auth = betterAuth({
    database: drizzleAdapter(getDb(), {
        provider: "sqlite",
    }),
    emailAndPassword: {
        enabled: true,
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET
        }
    },
    plugins: [tanstackStartCookies()]
});
