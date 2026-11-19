/* Demo RBAC middleware: production should verify a signed JWT. */
export const requireRole = (...roles) => (req, res, next) => {
  const role = req.header("x-role");
  if (!role || !roles.includes(role)) {
    return res.status(403).json({
      error: "Forbidden",
      message: `Requires role: ${roles.join(" or ")}`,
      demo: "Send an x-role header with guest, host or admin.",
    });
  }
  next();
};
