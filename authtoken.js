require('log-timestamp');
const machina = require('machina');
const request = require('request');
var log = require('loglevel').getLogger("authtoken");
var backoff = require('backoff');

var attemptrequest = function (opts, cb) {
  var expBackoff = backoff.exponential({
    initialDelay: 1,
    maxDelay: 1000
  });

  expBackoff.on('ready', function (number, delay) {
    log.debug('On backoff : ' + number + ' ' + delay + 'ms');
    request(opts, function (err, res, body) {
      if (res && (res.statusCode == 500 || res.statusCode == 502) && number < 10) {
        log.debug('Response: ' + res.statusCode);
        expBackoff.backoff();
      } else {
        log.debug('Status: ' + res.statusCode);
        cb(err, res, body);
      }
    })
  });

  expBackoff.backoff();
}

function authtoken(botid, botsecret, botservice, authclientconfig, tokenmngr) {
  log.debug('clientconfig:' + authclientconfig);
  var self;
  var scheme = authclientconfig.scheme;
  var ca_path = authclientconfig.ca;
  var accesstoken;
  var basictoken = new Buffer(botid + ":" + botsecret).toString('base64');
  var expirationtime;
  var refreshtoken;
  var timer = false;
  var BotServiceAgent;
  if(authclientconfig.connpoolsize != null) {
    if(scheme == 'https') {
      BotServiceAgent = new require('https').Agent({ keepAlive: true,maxSockets: authclientconfig.connpoolsize });
    } else {
      BotServiceAgent = new require('http').Agent({ keepAlive: true,maxSockets: authclientconfig.connpoolsize });
    }
  }
  var authtoken = new machina.Fsm( {
    initialize : function(options) {
        self = this;
    },

    namespace: "authtoken",

    initialState: "initialized",

    states: {
      initialized: {
        "*": function() {
          accesstoken = '';
          refreshtoken = '';
          expiration_time = '';
          log.debug(this.state);
          this.transition("fetching");
        },
      },
      fetching: {
        _onEnter: function() {
          log.debug(this.state + " _onEnter");
          this.handle("event_fetch_access_token")
        },
        event_fetch_access_token: function() {
          var url = scheme + ':\/\/' + botservice + "\/oauth2\/v1\/token"
          var clientOptions = {
            url: url,
            method: 'POST',
            headers: {
              "Content-type": "application/x-www-form-urlencoded",
              "Authorization": "Basic " + basictoken
            },
            form: {
              grant_type: 'client_credentials',
              scope: 'botmessage'
            }
          };
          log.debug('scheme' + scheme);
          if(BotServiceAgent){
            clientOptions.agent = BotServiceAgent;
          }
          if (scheme == 'https' && ca_path != null) {
            clientOptions.agentOptions = {};
            clientOptions.agentOptions.ca = require('fs').readFileSync(ca_path);
          }
          log.debug("botid: " + botid + ", secret: " + botsecret);
          log.debug("basictoken: " + basictoken + ", url: " + url);

          attemptrequest(clientOptions,function(err,httpResponse,body){
              if(err || (httpResponse && httpResponse.statusCode != 200)){
                log.error('error happened:' + err + " respcode :" + (httpResponse ? httpResponse.statusCode : ""));
                self.transition("tokenFetchFailed");
              } else {
	              log.debug("response code: " + (httpResponse ? httpResponse.statusCode : ""));
                log.debug("body: " + body);
                self.transition("tokenFetchSucceeded", body);
	            }
            }
          );

        },
        _onExit: function() {
          log.debug(this.state + " _onExit");
        }
      },
      refreshing: {
        _onEnter: function() {
          log.debug(this.state + " _onEnter");
          expiration_time = '';
          this.handle("event_fetch_refresh_token")
        },
        event_fetch_refresh_token: function() {
          var url = scheme + ':\/\/' + botservice + "\/oauth2\/v1\/token"
          var clientOptions = {
            url: url,
            method: 'POST',
            headers: {
              "Content-type": "application/x-www-form-urlencoded",
              "Authorization": "Basic " + basictoken
            },
            form: {
              grant_type: 'refresh_token',
              refresh_token: refreshtoken,
              scope: 'botmessage'
            }
          };
            if(BotServiceAgent){
              clientOptions.agent = BotServiceAgent;
            }
          if (scheme == 'https'  && ca_path != null) {
            clientOptions.agentOptions = {};
            clientOptions.agentOptions.ca = require('fs').readFileSync(ca_path);
          }
          log.debug("botid: " + botid + ", secret: " + botsecret);
          log.debug("basictoken: " + basictoken + ", url: " + url);
          attemptrequest(clientOptions,
            function(err,httpResponse,body){
              if(err || (httpResponse && httpResponse.statusCode != 200)){
                log.error('error happened:' + err + " respcode :" + (httpResponse ? httpResponse.statusCode : ""));
                if (httpResponse && httpResponse.statusCode == 401) {
                  // If refresh fails with 401, retry with grant_type "client_credentials"
                  self.transition("fetching");
                } else {
                  self.transition("tokenFetchFailed");
                }
              } else {
                log.debug("response code: " + (httpResponse ? httpResponse.statusCode : ""));
              	log.debug("body: " + body);
              	self.transition("tokenFetchSucceeded", body);
	            }
            }
          );

        },
        _onExit: function() {
          log.debug(this.state + " _onExit");
        }
      },
      tokenFetchFailed: {
        _onEnter: function () {
          log.debug(this.state + " _onEnter");
          clearTimeout(timer);
          if (tokenmngr)
            tokenmngr.onNotReady();
          timer = false;
          log.debug('post the not ready indication to app');
        },
        _onExit: function () {
          log.debug(this.state + " _onExit");
        }
      },
      tokenFetchSucceeded: {
        _onEnter: function (body) {
          log.debug(this.state + " _onEnter");
          var jsonResp = JSON.parse(body);
          accesstoken = jsonResp.access_token;
          refreshtoken = jsonResp.refresh_token;
          expirationtime = jsonResp.expires_in;
          if (timer == false) {
            timer = setInterval(self.refresh, ((expirationtime * 1000) - 5000));
            log.debug('event has to be emitted on intial succeed');
            if (tokenmngr)
              tokenmngr.onReady();
          } else {
            log.debug('event has only to be sent once');
          }
          log.debug('token: ' + accesstoken);
          log.debug('expiry: ' + expirationtime);
          log.debug('refresh string : ' + refreshtoken);

        },
        _onExit: function () {
          log.debug(this.state + " _onExit");
        }
      }
    },

    start: function() {
      this.handle("initialized");
    },
    refresh: function () {
      authtoken.transition("refreshing");
    }
  });

  return {
    fetchAccessToken: function(){
      log.debug('fetchtoken');
      authtoken.start();
    },
    getAccessToken: function() {
      log.debug("accesstoken: "+ accesstoken);
      return accesstoken;
    },
  }
}

module.exports = authtoken;
