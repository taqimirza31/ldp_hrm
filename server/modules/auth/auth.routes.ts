import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { AuthController } from "./AuthController.js";

const router = Router();
const ctrl = new AuthController();

// Local auth
router.post("/login",            ctrl.login);
router.post("/logout",           ctrl.logout);
router.get("/me",                ctrl.me);
router.patch("/me",              requireAuth, ctrl.updateMe);
router.post("/register",         requireAuth, requireRole(["admin"]), ctrl.register);
router.post("/change-password",  ctrl.changePassword);

// User management (admin)
router.get("/users",             requireAuth, requireRole(["admin"]), ctrl.listUsers);
router.patch("/users/:id",       requireAuth, requireRole(["admin"]), ctrl.updateUser);
router.delete("/users/:id",      requireAuth, requireRole(["admin"]), ctrl.deleteUser);

// Microsoft SSO
router.get("/microsoft/config",              ctrl.microsoftConfig);
router.get("/microsoft/login",               ctrl.microsoftLogin);
router.get("/microsoft/callback",            ctrl.microsoftCallback);
router.get("/Microsoft/callback",            ctrl.microsoftCallback);

export const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
export const COOKIE_NAME = "auth_token";
export default router;
