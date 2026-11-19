import bcrypt from "bcryptjs";
import { users } from "../store/demoStore.js";
import { AuthSchema, LoginSchema } from "../validators/authSchemas.js";

export const register = async (req, res, next) => {
  try {
    const payload = AuthSchema.parse(req.body);
    if (users.some((u) => u.email === payload.email)) {
      return res.status(409).json({ error: "Email already registered" });
    }
    const passwordHash = await bcrypt.hash(payload.password, 10);
    const user = {
      id: users.length + 1,
      name: payload.name || payload.email.split("@")[0],
      email: payload.email,
      passwordHash,
      role: payload.role,
    };
    users.push(user);
    res.status(201).json({
      data: { id: user.id, name: user.name, email: user.email, role: user.role },
      message: "Registered (demo). Use the login endpoint to get a demo token.",
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const payload = LoginSchema.parse(req.body);
    const user = users.find((u) => u.email === payload.email);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const valid = await bcrypt.compare(payload.password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = Buffer.from(`${user.id}:${user.role}:${Date.now()}`).toString(
      "base64url"
    );
    res.json({
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      note: "Demo token only. Use signed JWTs in production.",
    });
  } catch (error) {
    next(error);
  }
};
