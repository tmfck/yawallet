const clientId = require('app/clientId.js');

const Koa = require("koa");
const app = new Koa();

const request = require('request');

const URLS = {
  auth: "https://money.yandex.ru/oauth/authorize",
  token: "https://money.yandex.ru/oauth/token",
  info: "https://money.yandex.ru/api/account-info"
};

function sendUnauthenticatedRequest(params, callback) {
  var headers = params.headers || {};
  var data = params.data || {};
  var url = params.url;

  headers['User-Agent'] = "Yandex.Money.SDK/NodeJS";

  request.post({
    url: url,
    headers: headers,
    form: data,
  }, processResponse(callback));
}

function Wallet(accessToken) {
  this.sendAuthenticatedRequest = function (params, callback) {
    params.headers = {
      "Authorization": "Bearer " + accessToken
    };
    sendUnauthenticatedRequest(params, callback);
  };


  this.accountInfo = function (callback) {
    this.sendAuthenticatedRequest({
      url: URLS.info
    }, callback);
  };
}

Wallet.obtainCode = function (clientId, redirectURI, scope, instance_name, callback) {
  sendUnauthenticatedRequest({
    url: URLS.auth,
    data: {
      client_id: clientId,
      instance_name: instance_name,
      redirect_uri: redirectURI,
      scope: scope.join(' '),
      response_type: "code"
    }
  }, callback);
};

Wallet.getAccessToken = function (clientId, code, redirectURI, clientSecret, callback) {
  sendUnauthenticatedRequest({
    url: URLS.token,
    data: {
      code: code,
      client_id: clientId,
      grant_type: "authorization_code",
      redirect_uri: redirectURI,
      client_secret: clientSecret
    }
  }, callback);
};

Wallet.revokeToken = function(token, revoke_all, callback) {
  sendUnauthenticatedRequest({
    url: "/api/revoke",
    data: {
      "revoke_all": revoke_all
    },
    headers: {
      "Authorization": "Bearer " + token
    }
  }, callback);
};

function processResponse(callback) {
  return function httpCallback(error, response, body) {
    if (error) {
      callback(error);
      return;
    }
    switch(response.statusCode) {
      case 400:
        callback(new Error("Format error"), null, response);
        break;
      case 401:
        callback(new Error("Token error"), null, response);
        break;
      case 403:
        callback(new Error("Scope error"), null, response);
        break;
      default:
        try {
          body = JSON.parse(body)
        } catch (e) {
          //
        }
        callback(null, body, response);
    }
  };
}



var Router = require("koa-router");
var router = new Router();

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  // x-response-time
  ctx.set("X-Response-Time", `${ms}ms`);
  // logger
  console.log(`${ctx.method} ${ctx.url} - ${ms}`);
});

router.all("/api/token.get", async (ctx, next) => {
  return new Promise((resolve, reject) => {
    Wallet.obtainCode(
      clientId,
      "http://yawallet.tk/api/code",
      ["account-info"],
      ctx.request.query.instance_name,
      (err, result, response) => {
        ctx.status = response.statusCode;
        if (err) {
          return resolve(ctx.body = {error: err.message});
        }
        if (response.statusCode === 302) {
          ctx.redirect(response.headers.location);
        }
        resolve(ctx.body = result);
      }
    );
  });
});

router.all("/api/code", (ctx, next) => {
  let redirect = "http://yawallet.tk";
  return new Promise((resolve, reject) => {
    Wallet.getAccessToken(
        clientId,
        ctx.request.query.code,
        redirect,
        null,
        (err, result, response) => {
          ctx.status = response.statusCode;
          if (err) {
            return resolve(ctx.body = {error: err.message});
          }
          if (result.access_token && result.access_token !== '') {
            ctx.redirect(redirect + "?token=" + result.access_token);
          } else {
            ctx.redirect('/api/token.get');
          }
          resolve(ctx.body = result);
        }
    );
  });
});

router.all("/api/account-info", (ctx, next) => {
  return new Promise((resolve, reject) => {
    let token = ctx.headers.authentification.split(' ')[1];
    let wallet = new Wallet(token);
    wallet.accountInfo((err, result, response) => {
      ctx.status = response.statusCode;
      if (err) {
        return resolve(ctx.body = {error: err.message});
      }
      resolve(ctx.body = result);
    });
  });
});

app.use(router.routes())
   .use(router.allowedMethods());

app.listen(3000);
