'use strict';

/**
 * super-admin controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::super-admin.super-admin');
