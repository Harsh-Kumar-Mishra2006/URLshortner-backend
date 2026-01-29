// utils/validators.js - UPDATED
const Joi = require('joi');
const validator = require('validator');

// utils/validators.js - Make fields truly optional
const urlSchema = Joi.object({
  originalUrl: Joi.string()
    .required()
    .custom((value, helpers) => {
      if (!validator.isURL(value, { require_protocol: true })) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.invalid': 'Please provide a valid URL with protocol (http/https)',
      'any.required': 'URL is required'
    }),
  customId: Joi.string()
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .min(3)
    .max(20)
    .optional()
    .allow(''),  // ADD THIS: Allow empty string
  expiresIn: Joi.number()
    .integer()
    .min(300)
    .max(2592000)
    .optional()
    .allow(null)  // ADD THIS: Allow null
});

const analyticsSchema = Joi.object({
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

module.exports = {
  urlSchema,
  analyticsSchema
};