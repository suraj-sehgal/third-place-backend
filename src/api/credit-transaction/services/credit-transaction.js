'use strict';

/**
 * credit-transaction service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::credit-transaction.credit-transaction');
