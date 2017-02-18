const extend = require('extend')
           _ = require('lodash');

module.exports = function(Note) {

  Note.createOptionsFromRemotingContext = function(ctx) {
    var base = this.base.createOptionsFromRemotingContext(ctx);
    console.log("Extending ", base);
    return extend(base, {
      userId: base.accessToken && base.accessToken.userId,
    });
  };

  Note.observe('access', function limitToTenant(ctx, next) {
    console.log("Options:", ctx.options);

    var userId = ctx.options.userId;
    if (!userId) {
      console.error("No user in context ", ctx.options);
      var error = new Error("Not authorized");
      error.statusCode = 401;
      next(error);
    }
    if (_.has(ctx,'query')) {
      if (_.has(ctx.query, 'where')) {
        var old = ctx.query.where;
        ctx.query.where = {and: [old, {userId: userId}]};
      }
      else {
        ctx.query.where = {userId: userId};
      }
    }
    
    next();
  });

  Note.observe('before save', function checkAndUpdateProperties(ctx, next) {
    var userId = ctx.options.userId;
    if (!userId) {
      var error = new Error("Not authorized");
      error.statusCode = 401;
      next(error);
    }
    
    if (_.has(ctx,'instance')) {
      if (ctx.isNewInstance === true) {
        ctx.instance.userId = userId;
        var now = new Date();
        ctx.instance.created = now;
      } else if (ctx.instance.userId !== userId) {
        var error = new Error("Trying to disown object");
        error.statusCode = 401;
        return next(error);
      }
      ctx.instance.lastUpdated = now;
    } else {
      if (_.has(ctx, 'data')) {
        if (_.has(ctx.data, 'userId') && ctx.data.userId !== ctx.currentInstance.userId) {
          var error = new Error("Trying to disown object");
          error.statusCode = 401;
          return next(error);
        }
        if (_.has(ctx.data, 'created') && ctx.data.created !== ctx.currentInstance.created) {
          var error = new Error("Cannot change the created date");
          error.statusCode = 401;
          return next(error);
        }
        ctx.data.lastUpdated = new Date();
      }
    }
    
    next();
  });
};
