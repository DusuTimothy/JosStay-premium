import bcrypt from "bcryptjs";
import { HttpError, asyncHandler } from "../lib/http.js";
import { signAccessToken } from "../lib/tokens.js";
import {
  DUMMY_PASSWORD_HASH,
  createUser,
  findUserByEmail,
  findUserById,
  publicUser,
  touchLastLogin,
} from "../store/userStore.js";
import { LoginSchema, RegisterSchema } from "../validators/authSchemas.js";

export const register = asyncHandler(async (req, res) => {
  const payload = RegisterSchema.parse(req.body);

  const user = await createUser({
    name: payload.name,
    email: payload.email,
    password: payload.password,
    role: "guest",
  });

  res.status(201).json({
    data: {
      token: signAccessToken(user),
      user,
    },
    message: "Account created",
  });
});

export const login = asyncHandler(async (req, res) => {
  const payload = LoginSchema.parse(req.body);
  const user = await findUserByEmail(payload.email);

  // Always run a bcrypt comparison so a missing account and a wrong password
  // take a similar amount of time.
  const valid = await bcrypt.compare(
    payload.password,
    user?.passwordHash || DUMMY_PASSWORD_HASH,
  );

  if (!user || !valid) {
    throw new HttpError(401, "Invalid email or password");
  }

  await touchLastLogin(user.id);

  res.json({
    data: {
      token: signAccessToken(user),
      user: publicUser(user),
    },
  });
});

export const me = asyncHandler(async (req, res) => {
  const user = await findUserById(req.auth.userId);
  if (!user) {
    throw new HttpError(401, "Account no longer exists");
  }
  res.json({ data: publicUser(user) });
});
