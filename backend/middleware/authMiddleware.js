import jwt from 'jsonwebtoken';
import asyncHandler from '../utils/asyncHandler.js';
import User from '../models/User.js';
import { ROLES } from '../constants/roles.js';

// Define Role Hierarchy for future scalable permissions (optional but requested)
// Higher index = higher permissions
export const roleHierarchy = [
  ROLES.AGENT,
  ROLES.MANAGER,
  ROLES.TEAM_LEAD,
  ROLES.DATA_ANALYST,
  ROLES.SUPER_ADMIN,
];

/**
 * Protect routes - Extracts and verifies JWT Access Token
 */
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Check for Bearer token in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token Payload
      const user = await User.findById(decoded.id).select('-password -refreshToken');

      if (!user) {
        res.status(401);
        throw new Error('Not authorized, user not found');
      }

      if (!user.isActive || user.isBlocked) {
        res.status(403);
        throw new Error('Not authorized, account is deactivated or blocked');
      }

      // Attach user to request
      req.user = user;
      next();
    } catch (error) {
      res.status(401);
      throw new Error('Not authorized, token failed or expired');
    }
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token provided');
  }
});

/**
 * Authorize Roles - Checks if the logged-in user has the required roles
 * Can be used exactly: authorizeRoles(ROLES.SUPER_ADMIN, ROLES.MANAGER)
 */
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      res.status(401);
      throw new Error('Not authorized, role missing');
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403);
      throw new Error(`Role (${req.user.role}) is not allowed to access this resource`);
    }

    next();
  };
};

/**
 * Authorize Hierarchy - Checks if user meets the minimum hierarchy level
 * Example: authorizeMinimumRole(ROLES.TEAM_LEAD) will allow TEAM_LEAD, DATA_ANALYST, SUPER_ADMIN
 */
export const authorizeMinimumRole = (minimumRole) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      res.status(401);
      throw new Error('Not authorized, role missing');
    }

    const userRoleIndex = roleHierarchy.indexOf(req.user.role);
    const requiredRoleIndex = roleHierarchy.indexOf(minimumRole);

    if (userRoleIndex === -1 || requiredRoleIndex === -1) {
      res.status(403);
      throw new Error('Role not recognized in hierarchy');
    }

    if (userRoleIndex < requiredRoleIndex) {
      res.status(403);
      throw new Error('Insufficient permissions to access this resource');
    }

    next();
  };
};
