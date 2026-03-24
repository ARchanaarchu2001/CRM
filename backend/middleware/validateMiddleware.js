import { validationResult } from 'express-validator';

/**
 * Middleware to handle express-validator errors centrally.
 * If errors exist, it returns a 400 Bad Request with mapped error messages.
 */
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Format errors to a clean array of object messages
    const extractedErrors = [];
    errors.array().map((err) => extractedErrors.push({ [err.path]: err.msg }));

    return res.status(400).json({
      message: 'Validation failed',
      errors: extractedErrors,
    });
  }
  next();
};
