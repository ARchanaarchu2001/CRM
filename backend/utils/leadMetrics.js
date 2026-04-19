/**
 * Helper to determine if a Lead has been meaningfully updated/worked on.
 * Returns true if any of the trackable fields have changed.
 */
export const checkLeadWorkedActivity = (existingAssignment, incomingUpdates) => {
  const trackedFields = [
    'status',
    'contactabilityStatus',
    'callAttempt1Date',
    'callAttempt2Date',
    'callingRemark',
    'interestedRemark',
    'notInterestedRemark',
    'agentNotes',
    'followUpDate',
    'callbackDate'
  ];

  let hasMeaningfulChange = false;

  for (const field of trackedFields) {
    if (
      incomingUpdates[field] !== undefined && 
      incomingUpdates[field] !== existingAssignment[field]
    ) {
      hasMeaningfulChange = true;
      break;
    }
  }

  return hasMeaningfulChange;
};

/**
 * Checks if a Lead Assignment has been "cleared" back to a pristine unworked state.
 */
export const checkIsLeadCleared = (assignment) => {
  const isEmpty = (val) => !val || String(val).trim() === '';

  const isPristine = (
    (assignment.status === 'new' || isEmpty(assignment.status)) &&
    isEmpty(assignment.contactabilityStatus) &&
    isEmpty(assignment.callAttempt1Date) &&
    isEmpty(assignment.callAttempt2Date) &&
    isEmpty(assignment.callingRemark) &&
    isEmpty(assignment.interestedRemark) &&
    isEmpty(assignment.notInterestedRemark) &&
    isEmpty(assignment.agentNotes) &&
    isEmpty(assignment.followUpDate) &&
    isEmpty(assignment.callbackDate)
  );

  return isPristine;
};

/**
 * Helper to get the current date string (YYYY-MM-DD) natively in the local timezone if needed, 
 * but UTC is standard for scalable backend.
 */
export const getCurrentDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

import LeadAssignment from '../models/LeadAssignment.js';

/**
 * Calculates real-time metrics for a single agent to be emitted over WebSockets
 */
export const calculateSingleAgentMetrics = async (agentId) => {
  const today = getCurrentDateString();

  const metrics = await LeadAssignment.aggregate([
    {
      $match: { agent: agentId }
    },
    {
      $group: {
        _id: '$agent',
        dailyDialsCount: {
          $sum: {
            $cond: [{ $in: [today, { $ifNull: ['$workedDates', []] }] }, 1, 0]
          }
        },
        pendingLeadsCount: {
          $sum: {
            $cond: [
              { $eq: [{ $size: { $ifNull: ['$workedDates', []] } }, 0] },
              1, 
              0
            ]
          }
        }
      }
    }
  ]);

  if (metrics.length > 0) {
    return {
      dailyDialsCount: metrics[0].dailyDialsCount || 0,
      pendingLeadsCount: metrics[0].pendingLeadsCount || 0,
    };
  }

  return { dailyDialsCount: 0, pendingLeadsCount: 0 };
};
