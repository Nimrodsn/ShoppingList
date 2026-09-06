// Browsers reject the `__Host-` prefix over plain HTTP, so localhost gets the bare name.
// Every other attribute is identical in both environments.
const IS_SECURE_ORIGIN = process.env.NODE_ENV === "production";

export const HOUSEHOLD_COOKIE = IS_SECURE_ORIGIN ? "__Host-hh" : "hh";

/** Soft, forgeable identity used only to display "who added this". Never for authorization. */
export const MEMBER_NAME_COOKIE = "member_name";
export const MEMBER_ID_COOKIE = "member_id";

export const HOUSEHOLD_COOKIE_MAX_AGE = 31_536_000;

export const IS_SECURE_COOKIE = IS_SECURE_ORIGIN;
