import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { users } from "../config/db";
import { User } from "../types/User";
import { JWT_SECRET } from "../config/env";
import jwt from "jsonwebtoken";
export const signup = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser: User = {
    id: Date.now().toString(),
    email,
    password: hashedPassword,
    createdAt: new Date()
  };

  users.push(newUser);

  res.json({
    message: "User created successfully",
    user: { id: newUser.id, email: newUser.email ,hashedPassword: newUser.password}
  });
};
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = users.find(u => u.email === email);

  if (!user) {
    return res.status(400).json({ message: "User not found" });
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    return res.status(400).json({ message: "Invalid password" });
  }

  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.json({
    message: "Login successful",
    token
  });
};