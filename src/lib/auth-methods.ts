/**
 * Which sign-in methods the login page offers. Public build-time flags: the process.env reads must
 * stay literal so Next.js can inline them into the client bundle.
 * Google is the main method; email links stay available behind a flag for development and fallback.
 */
export type AuthMethods = { google: boolean; email: boolean };

export function authMethods(): AuthMethods {
  return {
    google: process.env.NEXT_PUBLIC_GOOGLE_AUTH === "1",
    email: process.env.NEXT_PUBLIC_EMAIL_AUTH === "1",
  };
}
