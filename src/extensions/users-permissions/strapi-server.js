"use strict";
const _ = require("lodash");
const jwt = require("jsonwebtoken");
const utils = require("@strapi/utils");
const { concat, compact, isArray } = require('lodash/fp');
const {contentTypes: { getNonWritableAttributes }, } = require('@strapi/utils');
const UserSchema = require("../users-permissions/content-types/user/schema.json"); // Importing UserSchema
const { sanitize } = utils;
const bycrypt = require("bcryptjs");
const { ApplicationError, ValidationError } = utils.errors; //Importing Error Handler
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require("twilio")(accountSid, authToken);


const sanitizeUser = (user, ctx) => {
  // Sanitizing user
  const { auth } = ctx.state;
  const userSchema = strapi.getModel("plugin::users-permissions.user");
  return sanitize.contentAPI.output(user, userSchema, { auth });
};

const issue = (payload, jwtOptions = {}) => {
    _.defaults(jwtOptions, strapi.config.get("plugin.users-permissions.jwt"));
    return jwt.sign(
      _.clone(payload.toJSON ? payload.toJSON() : payload),
      strapi.config.get("plugin.users-permissions.jwtSecret"),
      jwtOptions
    );
  };

const register = async (ctx) => {
  // Validate user
  const pluginStore = await strapi.store({ type: 'plugin', name: 'users-permissions' });

  const settings = await pluginStore.get({ key: 'advanced' });

  const { register } = strapi.config.get('plugin.users-permissions');
    const alwaysAllowedKeys = ['countryDialCode', 'contactNumber',];
    const userModel = strapi.contentTypes['plugin::users-permissions.user'];
    const { attributes } = userModel;

    const nonWritable = getNonWritableAttributes(userModel);

    const allowedKeys = compact(
      concat(
        alwaysAllowedKeys,
        isArray(register?.allowedFields)
          ? // Note that we do not filter allowedFields in case a user explicitly chooses to allow a private or otherwise omitted field on registration
            register.allowedFields // if null or undefined, compact will remove it
          : // to prevent breaking changes, if allowedFields is not set in config, we only remove private and known dangerous user schema fields
            // TODO V5: allowedFields defaults to [] when undefined and remove this case
            Object.keys(attributes).filter(
              (key) =>
                !nonWritable.includes(key) &&
                !attributes[key].private &&
                ![
                  // many of these are included in nonWritable, but we'll list them again to be safe and since we're removing this code in v5 anyway
                  // Strapi user schema fields
                  'confirmed',
                  'blocked',
                  'confirmationToken',
                  'resetPasswordToken',
                  'provider',
                  'id',
                  'role',
                  // other Strapi fields that might be added
                  'createdAt',
                  'updatedAt',
                  'createdBy',
                  'updatedBy',
                  'publishedAt', // d&p
                  'strapi_reviewWorkflows_stage', // review workflows
                ].includes(key)
            )
      )
    );

    const params = {
      ..._.pick(ctx.request.body, allowedKeys),
      provider: 'local',
    };

  try {

    const { countryDialCode, contactNumber, otp } = params // Validating the request body against UserSchema
    const userContactNumber = `${countryDialCode}${contactNumber}`
    console.log(params, "params")

    if(!countryDialCode || !contactNumber){
        throw new ApplicationError("Validation Error: countryDialCode/contactNumber missing")
    }

    const role = await strapi.query('plugin::users-permissions.role').findOne({ where: { type: settings.default_role } });

    if (!settings.allow_register) {
        throw new ApplicationError('Register action is currently disabled');
      }

    console.log(ctx.request,role,settings, "if user not found");

    

    // Checking if username already exists
    const userCheck = await strapi.query("plugin::users-permissions.user").findOne({where: { $and:[{countryDialCode}, {contactNumber}]},});

    if (userCheck)
    throw new ApplicationError( `"User already exists",Username with ${userContactNumber} already exists in the database`);

    const newUser = {
        ...params,
        role: role.id,
      };
  
    //   const user = await strapi.getService('user').add(newUser);
  
    //   const sanitizedUser = await sanitizeUser(user, ctx);
    //   const jwt = strapi.getService('jwt').issue(_.pick(user, ['id']));

    // return ctx.send({
    //   jwt,
    //   user: sanitizedUser,
    // });
    
    let sanitizedUser;
    let jwt;
    await strapi.query("plugin::users-permissions.user").create({
        // Creating user
        data: {
          countryDialCode,
          contactNumber,
          role: 1,
        },
      }).then(async (/** @type {any} */ user) => {
        sanitizedUser = await sanitizeUser(user, ctx); // Sanitizing user
        jwt = issue(_.pick(user, ["id"]));
      });


    return ctx.send({
      status: "success",
      jwt,
      user: _.omit(sanitizedUser, [
        // Returning user without password and other fields
        "email",
        "provider",
        "confirmed",
        "blocked",
      ]),
    });
  } catch (error) {
    // Handling error
    if (error.name === "ValidationError")
      throw new ValidationError("An Error occured", error.errors); // Throwing validation error
    throw error; // Throwing error
  }
};

const login = async (ctx) => {

  let sanitizedUser;
  let jwt;
  try {
    const { username, password, countryDialCode, contactNumber, otp } = ctx.request.body // Validating the request body against UserSchema
    
    const userContactNumber = `${countryDialCode}${contactNumber}`

    if (!otp){
        const verification = await client.verify.v2
        .services("VA047f020134adbd2f0f192102268f377e")
        .verifications.create({
          channel: "sms",
          to: userContactNumber,
        });
      
      console.log(verification);
      return ctx.send({
        status: "success",
        message: verification
      });
    }

    if(otp){
      const verificationStatus = await client.verify.v2.services("VA047f020134adbd2f0f192102268f377e")
      .verificationChecks
      .create({to: userContactNumber, code: otp});
      console.log("verification status", verificationStatus)

      if(verificationStatus.status !=="approved"){
        throw new ApplicationError("Invalide OTP")
      }
        
    }

    const user = await strapi // Checking if username exists
      .query("plugin::users-permissions.user")
      .findOne({
        where: { $and:[{countryDialCode}, {contactNumber}]  },
      });
    //   console.log(user, "user details")
      
    if (!user){
        // const x = await register(ctx)

        // return
        throw new ApplicationError("User does not exists"); // Throwing error if usern contact doesn't exists
    }
      sanitizedUser = await sanitizeUser(user, ctx)
    // await bycrypt // Comparing password
    //   .compare(password, user.password)
    //   .then(async (res) => {
    //     if (res) return (sanitizedUser = await sanitizeUser(user, ctx)); // Sanitizing user
    //     throw new ApplicationError("Username or password does not exists"); // Throwing error if password doesn't match
    //   })
    //   .catch((e) => {
    //     throw e; // Throwing error
    //   });
    jwt = issue(_.pick(user, ["id"])); // Issuing JWT
    return ctx.send({
      status: "success",
      jwt,
      user: _.omit(sanitizedUser, [
        // Returning user without password and other fields
        "email",
        "provider",
        "confirmed",
        "blocked",
      ]),
    });
  } catch (error) {
    // Handling error
    if (error.name === "ValidationError")
      throw new ValidationError("An Error occured", error.errors); // Throwing validation error
    throw error; // Throwing error
  }
};

module.exports = (plugin) => {
  // JWT issuer
  const issue = (payload, jwtOptions = {}) => {
    _.defaults(jwtOptions, strapi.config.get("plugin.users-permissions.jwt"));
    return jwt.sign(
      _.clone(payload.toJSON ? payload.toJSON() : payload),
      strapi.config.get("plugin.users-permissions.jwtSecret"),
      jwtOptions
    );
  };
  //   Register controller override
  plugin.controllers.auth.register = async (ctx) => {
    await register(ctx);
  };

  plugin.controllers.auth.callback = async (ctx) => {
    await login(ctx);
  };

  plugin.controllers.user.newOneMethod = (ctx) => {
    console.log('test')
    return ctx.send({
        status:"success"
    })
}

  plugin.routes['content-api'].routes.push({
    method: "GET",
    path: "/bob",
    handler: "user.newOneMethod"
  })

  plugin.routes["content-api"].routes.unshift({
    // Adding route
    method: "POST",
    path: "/auth/local", // Login route
    handler: "auth.callback",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  });

  plugin.routes["content-api"].routes.unshift({
    // Adding route
    method: "POST",
    path: "/auth/local/register", // Register route
    handler: "auth.register",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  });

  return plugin;
};