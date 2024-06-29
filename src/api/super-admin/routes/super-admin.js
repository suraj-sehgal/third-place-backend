'use strict';

/**
 * super-admin router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::super-admin.super-admin');
