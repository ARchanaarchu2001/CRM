import { ROLES } from './roles.js';

/**
 * Checks if the current user has permission to create an account with the target role.
 * 
 * Rules:
 * - Super Admin and Manager can create all users (roles)
 * - Team Lead can only create 'agent' role
 * - Team Lead cannot create manager, data_analyst, team_lead, or super_admin
 * - Other roles cannot create users
 * 
 * @param {string} currentUserRole - Role of the logged-in user making the request
 * @param {string} targetRole - Role they are trying to assign to the new user
 * @returns {boolean}
 */
export const canCreateUser = (currentUserRole, targetRole) => {
  if ([ROLES.SUPER_ADMIN, ROLES.MANAGER].includes(currentUserRole)) {
    return true; // Super Admin and Manager can create any role
  }

  if (currentUserRole === ROLES.DATA_ANALYST) {
    return [ROLES.TEAM_LEAD, ROLES.AGENT].includes(targetRole);
  }

  if (currentUserRole === ROLES.TEAM_LEAD) {
    return targetRole === ROLES.AGENT; // Team Lead can strictly only create agents
  }

  return false; // All other roles are denied
};

/**
 * Checks if the current user has permission to delete or deactivate a specific user.
 * 
 * Rules:
 * - Super Admin and Manager can deactivate/remove any user as needed
 * - Team Lead can delete/deactivate ONLY their own agents
 * - Team Lead cannot delete users outside their own team
 * - Other roles cannot delete any users
 * 
 * @param {Object} currentUser - The logged-in user object (must contain _id and role)
 * @param {Object} targetUser - The user document being deleted/deactivated (must contain _id, role, teamLead)
 * @returns {boolean}
 */
export const canModifyOrDeleteUser = (currentUser, targetUser) => {
  // Super Admin and Manager have full authority
  if ([ROLES.SUPER_ADMIN, ROLES.MANAGER].includes(currentUser.role)) {
    return true; 
  }

  if (currentUser.role === ROLES.DATA_ANALYST) {
    return [ROLES.AGENT, ROLES.TEAM_LEAD].includes(targetUser.role);
  }

  // Team Lead constraints
  if (currentUser.role === ROLES.TEAM_LEAD) {
    // Cannot delete heavily privileged roles, can only delete agents
    if (targetUser.role !== ROLES.AGENT) {
      return false;
    }

    // Must belong to their own team
    const currentUserIdStr = currentUser._id.toString();
    const targetTeamLeadIdStr = targetUser.teamLead ? targetUser.teamLead.toString() : null;

    return targetTeamLeadIdStr === currentUserIdStr;
  }

  return false; // Anyone else explicitly block
};

/**
 * Determines the database query filter scope so a user only sees what they are allowed to see
 * when retrieving lists of users.
 * 
 * @param {Object} currentUser - Logged in user
 * @returns {Object|null} Mongoose query matching criteria, or null if denied
 */
export const getSafeUserFetchScope = (currentUser) => {
  if (currentUser.role === ROLES.SUPER_ADMIN) {
    return { isDeleted: false }; // See all active/non-deleted users globally
  }

  if (currentUser.role === ROLES.MANAGER) {
    return { isDeleted: false };
  }

  if (currentUser.role === ROLES.DATA_ANALYST) {
    return {
      role: { $in: [ROLES.AGENT, ROLES.TEAM_LEAD] },
      isDeleted: false,
    };
  }

  if (currentUser.role === ROLES.TEAM_LEAD) {
    return { 
      role: ROLES.AGENT, 
      teamLead: currentUser._id, 
      isDeleted: false 
    }; // See only their own team's agents
  }

  return null;
};
