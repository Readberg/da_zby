import { z } from "zod";

// Zod's fast path compiles validators with `new Function`; a content security policy without
// 'unsafe-eval' (D-074) rejects that and, while only reporting, logs a violation on every page.
// Validators here are tiny, so the plain path costs nothing noticeable.
z.config({ jitless: true });

export { z };
