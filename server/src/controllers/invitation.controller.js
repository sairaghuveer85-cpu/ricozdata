import invitationService from '../services/invitation.service.js';

/**
 * Controller handling team invitations, token generation, single-use acceptance, and revocation.
 */

/**
 * POST /api/users/invitations
 * Generates a team invitation with a cryptographically hashed token.
 */
export async function createInvitation(req, res, next) {
  try {
    const inviterId = req.user?._id || req.headers['x-caller-id'] || null;
    const caller = req.user || (req.callerRole ? { role: req.callerRole } : null);

    const { invitation, rawToken } = await invitationService.createInvitation(
      req.organizationId,
      inviterId,
      req.body,
      caller
    );

    res.status(201).json({
      success: true,
      message: 'Invitation generated successfully',
      data: {
        ...invitation.toJSON(),
        // Raw token returned only on generation for email delivery / response
        token: rawToken
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/users/invitations
 * Lists all invitations for current organization.
 */
export async function listInvitations(req, res, next) {
  try {
    const invitations = await invitationService.getInvitations(req.organizationId, req.query);
    res.status(200).json({
      success: true,
      data: invitations
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/users/invitations/:token/accept
 * Public / token-scoped endpoint to accept an invitation and activate user account.
 */
export async function acceptInvitation(req, res, next) {
  try {
    const user = await invitationService.acceptInvitation(req.params.token, req.body);

    res.status(200).json({
      success: true,
      message: 'Invitation accepted successfully. Account activated.',
      data: user
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/users/invitations/:id
 * Revokes a pending invitation within current organization.
 */
export async function revokeInvitation(req, res, next) {
  try {
    const revoked = await invitationService.revokeInvitation(req.organizationId, req.params.id);

    res.status(200).json({
      success: true,
      message: 'Invitation has been revoked',
      data: revoked
    });
  } catch (error) {
    next(error);
  }
}

export default {
  createInvitation,
  listInvitations,
  acceptInvitation,
  revokeInvitation
};
