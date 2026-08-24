// The middleware already validates the JWT with Supabase on every matched
// request. It forwards the verified email on this request header so server
// components can render "who is signed in" without a second round trip to the
// auth API. The middleware DELETES this header before setting it, so a
// client-supplied value can never reach a server component.
export const USER_EMAIL_HEADER = "x-tender-user-email";
