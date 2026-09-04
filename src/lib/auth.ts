import {betterAuth} from "better-auth";
import {drizzleAdapter} from "better-auth/adapters/drizzle";
import {getDb} from "@/db/db-client.server";
import {tanstackStartCookies} from "better-auth/tanstack-start";
import {bearer} from "better-auth/plugins";

export const auth = betterAuth({
    database: drizzleAdapter(getDb(), {
        provider: "sqlite",
    }),
    account: {
        encryptOAuthTokens: true,
        accountLinking: {
            enabled: true,
            disableImplicitLinking: true,
            trustedProviders: ["google"],
            allowDifferentEmails: true,
        },
    },
    emailAndPassword: {
        enabled: true,
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }
    },
    plugins: [bearer({requireSignature: true}), tanstackStartCookies()]
});
