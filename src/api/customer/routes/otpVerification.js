module.exports = {
    routes: [
      {
        method: 'POST',
        path: '/otpVerification',
        handler: 'customer.custom_route', // or 'plugin::plugin-name.controllerName.functionName' for a plugin-specific controller
        config: {
            auth: false,
          },
      },
    ],
  };