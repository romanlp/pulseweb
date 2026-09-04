import { z } from "zod";

const fieldErrorMessageSchema = z.union([
  z.string(),
  z.object({ message: z.string() }).transform(({ message }) => message),
]);

export function firstFieldErrorMessage<T>(errors: readonly T[]) {
  for (const error of errors) {
    const result = fieldErrorMessageSchema.safeParse(error);
    if (result.success) return result.data;
  }

  return undefined;
}
