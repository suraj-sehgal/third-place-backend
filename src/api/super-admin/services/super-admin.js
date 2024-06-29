'use strict';

/**
 * super-admin service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::super-admin.super-admin');
