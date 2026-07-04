// Simple shared bearer token check on every REST route. If AUTH_TOKEN is
// unset/empty, auth is disabled (local dev convenience) - a real deploy
// should always set it.
export function requireAuth(authToken) {
  return function (req, res, next) {
    if (!authToken) return next();
    const header = req.headers["authorization"] || "";
    const token = header.replace(/^Bearer\s+/i, "");
    if (token !== authToken) {
      return res.status(401).json({ error: "unauthorized", message: "Missing or invalid bearer token." });
    }
    next();
  };
}
