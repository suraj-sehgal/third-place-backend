'use strict';

/**
 * customer controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

const unparsed = require('koa-body/unparsed.js');


module.exports = createCoreController('api::customer.customer', ({ strapi }) => ({
    async custom_route(ctx) {
        try {
            const unparsedBody = ctx.request.body[unparsed];

            console.log(JSON.parse(unparsedBody).msg)           
            ctx.send(ctx)
        } catch (error) {
            ctx.send(error)
        }
    },
}));
