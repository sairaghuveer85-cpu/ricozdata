import userService from '../services/user.service.js';
import { BadRequestError, UnauthorizedError } from '../utils/errors.js';

/**
 * Controller handling user profile management, team member listing, and status updates.
 */

/**
 * GET /api/users/me
 * Retrieves current caller's profile.
 */
export async function getMe(req, res, next) {
  try {
    const userId = req.user?._id || req.headers['x-caller-id'];

    if (!userId) {
      throw new UnauthorizedError('User session context not established');
    }

    const user = await userService.getUserById(req.organizationId, userId);
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/users/me
 * Updates current caller's profile and account settings.
 */
export async function updateMe(req, res, next) {
  try {
    const userId = req.user?._id || req.headers['x-caller-id'];

    if (!userId) {
      throw new UnauthorizedError('User session context not established');
    }

    const updatedUser = await userService.updateUserProfile(req.organizationId, userId, req.body);
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/users
 * Lists users within current organization.
 */
export async function listUsers(req, res, next) {
  try {
    const result = await userService.getUsers(req.organizationId, req.query);
    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/users/:id
 * Retrieves a single user by ID within current organization.
 */
export async function getUserById(req, res, next) {
  try {
    const user = await userService.getUserById(req.organizationId, req.params.id);
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/users/:id
 * Updates a member's profile/settings within current organization.
 */
export async function updateUser(req, res, next) {
  try {
    const updated = await userService.updateUserProfile(req.organizationId, req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/users/:id/status
 * Transitions a member's status (ACTIVE, SUSPENDED, DEACTIVATED).
 */
export async function updateUserStatus(req, res, next) {
  try {
    if (!req.body || !req.body.status) {
      throw new BadRequestError('Target status is required in request body');
    }

    const updated = await userService.updateUserStatus(
      req.organizationId,
      req.params.id,
      req.body.status,
      req.user
    );

    res.status(200).json({
      success: true,
      message: `User status changed to ${updated.status}`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/users/:id/role
 * Updates a member's role within current organization.
 */
export async function updateUserRole(req, res, next) {
  try {
    if (!req.body || !req.body.role) {
      throw new BadRequestError('Target role is required in request body');
    }

    const caller = req.user || (req.callerRole ? { role: req.callerRole, _id: req.headers['x-caller-id'] } : null);

    const updated = await userService.updateUserRole(
      req.organizationId,
      req.params.id,
      req.body.role,
      caller
    );

    res.status(200).json({
      success: true,
      message: `User role updated to ${updated.role}`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/users/:id
 * Deactivates a member within current organization.
 */
export async function deleteUser(req, res, next) {
  try {
    const result = await userService.deleteUser(req.organizationId, req.params.id, req.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export default {
  getMe,
  updateMe,
  listUsers,
  getUserById,
  updateUser,
  updateUserStatus,
  updateUserRole,
  deleteUser
};
