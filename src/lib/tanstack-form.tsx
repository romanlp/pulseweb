import {createFormHook} from "@tanstack/react-form";
import {TextField} from "@/components/fields/text-field.tsx";
import {EmailField} from "#/components/fields/email-field.tsx";
import {PasswordField} from "#/components/fields/password-field.tsx";
import { SubmitButton } from "#/components/form/submit-button";
import {fieldContext, formContext} from "#/lib/tanstack-form.context.tsx";

// Allow us to bind components to the form to keep type safety but reduce production boilerplate
// Define this once to have a generator of consistent form instances throughout your app
export const { useAppForm } = createFormHook({
    fieldComponents: {
        TextField,
        EmailField,
        PasswordField
    },
    formComponents: {
        SubmitButton
    },
    fieldContext,
    formContext,
})
