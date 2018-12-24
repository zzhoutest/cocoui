require('log-timestamp');
var request = require('request');
var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');
var backoff = require('backoff');
var log = require('loglevel').getLogger("ssbotbuilder");
var configuration;
var Botwebserver;
var events={};
var authtoken;
var tokenState = false;
var BotServiceAgent;
var listeners = {};

/*Module Declaration*/
var ssBotBuilder = function() {

};

/*Interface API to create WebServer*/
ssBotBuilder.prototype.createService = function(config, callback, customAuthImpl) {
  configuration = config;
  // To Allow app to close server
  var server;
  log.debug('configuration: ', configuration);

  // process client config, and this is used for bot to communicate to bot platform
  if(config.hasOwnProperty("clientconfig")) {    
    configuration.clientconfig = config.clientconfig;
  } else {
    configuration.clientconfig = {};    
  }

  if (!configuration.clientconfig.scheme) {
    configuration.clientconfig.scheme = 'http';
  }

  if(configuration.clientconfig.connpoolsize != null) {
    if(configuration.clientconfig.scheme == 'https') {
      BotServiceAgent = new require('https').Agent({ keepAlive: true,maxSockets: configuration.clientconfig.connpoolsize });
    } else {
      BotServiceAgent = new require('http').Agent({ keepAlive: true,maxSockets: configuration.clientconfig.connpoolsize });
    }
  }

  log.debug('clientconfig: ', configuration.clientconfig);

  // process server config, and this is used of bot platform to communicate to bot
  if(config.hasOwnProperty("serverconfig")) {    
    configuration.serverconfig = config.serverconfig;     
  } else {
    configuration.serverconfig = {};            
  }
  
  if (!configuration.serverconfig.scheme) {
    configuration.serverconfig.scheme = 'http';
  }

  if (!configuration.serverconfig.port) {
    if (configuration.serverconfig.scheme == 'http') {
      configuration.serverconfig.port = 3000;
    } else {
      configuration.serverconfig.port = 443;
    }
  }

  if (!configuration.serverconfig.webhook) {
    configuration.serverconfig.webhook = '/bot/message'; 
  }

  log.debug('serverconfig: ', configuration.serverconfig);

  Botwebserver = express();
  Botwebserver.use(bodyParser.json());
  Botwebserver.use(bodyParser.urlencoded({
    extended: true
  }));

  if (configuration.serverconfig.scheme == 'https') {
    //Server setup https
    const https = require('https');
    const fs = require('fs');
    if (!fs.existsSync(configuration.serverconfig.key) || !fs.existsSync(configuration.serverconfig.cert)) {
      log.error('certificate or key is not present at the specified path');
      process.exit(1);
    }
    const options = {
      key: fs.readFileSync(configuration.serverconfig.key),
      cert: fs.readFileSync(configuration.serverconfig.cert)
    };
    server = https.createServer(options, Botwebserver);
    server.listen(configuration.serverconfig.port, function() {
      log.debug('Bot is listening on port: ' + configuration.serverconfig.port);
      if (callback) {
        callback(null, server);
      }
    }).on('error',
      function(err) {
        if (err.errno === 'EADDRINUSE') {
          log.error('port is already in use');
          process.exit(1);
        } else if (err.errno === 'EACCES') {
          log.error('requires elevated privileges');
          process.exit(1);
        } else {
          log.error(err);
        }
      });
  } else {
    const http = require('http');
    server = http.createServer(Botwebserver);
	  server.listen(configuration.serverconfig.port, function() {
    log.debug('Bot is listening on port: ' + configuration.serverconfig.port);
    if (callback) {
      callback(null, server);
    }
  }).on('error',
    function(err) {
      if (err.errno === 'EADDRINUSE') {
        log.error('port is already in use');
        process.exit(1);
      } else if (err.errno === 'EACCES') {
        log.error('requires elevated privileges');
        process.exit(1);
      } else {
        log.error(err);
      }
    });
  }

  configureServiceRoute(Botwebserver);
  if(undefined == customAuthImpl){
    authtoken = require('./authtoken')(configuration.botID, configuration.accesstoken, configuration.botservice, configuration.clientconfig, tokenManager);
  }else{
    // For custom Auth impl. Ready/Not Ready needs to be handled by app. No need to maintain tokenstate
    tokenState = true;
    authtoken = customAuthImpl;
  }
  authtoken.fetchAccessToken();
}

/*Interface API to register Callback Listener in App for receiving messages*/
ssBotBuilder.prototype.listen = function(event, listener) {
  if (typeof(listener) != 'function') {
    throw new Error('Listener must be a function');
  }
  listeners[event] = listener;
}

/* Interface API to upload file to MAAP cloud storage
  bot can upload local file or file url
*/
ssBotBuilder.prototype.upload = function(fileObject, cb) {
  if (!tokenState) {
    log.error("Bot Server is not in ready State");
    cb && cb("Bot Server is not in ready State");
    return;
  }
  
  var message = {};
  //log.debug('fileType: ' + fileObject.fileType + ' until: ' + fileObject.until + ' fileLocalPath: ' + fileObject.fileLocalPath + ' fileUrl: ' + fileObject.fileUrl);
  
  if (!fileObject.fileType || (!fileObject.fileLocalPath && !fileObject.fileUrl)) {
    cb && cb("missing mandatory values");
    return;
  }

  if (fileObject.fileLocalPath && fileObject.fileUrl) {
    cb && cb("only either fileLocalPath or fileUrl allowed and cannot be both");
    return;
  }

  // if bot does not provide "until", set it as 30 days
  if (!fileObject.until) {
    var ms = new Date().getTime() + (86400000 * 30);
    fileObject.until = new Date(ms).toISOString();
  }

  var uploadUrl = configuration.clientconfig.scheme + '://' + configuration.botservice + configuration.apipath + configuration.botID + '/files';

  var clientOptions;
  if (fileObject.fileLocalPath) {
    var file = require('fs').createReadStream(fileObject.fileLocalPath);
    clientOptions = {
      url: uploadUrl,
      method: "POST",
      formData: {
        "fileType": fileObject.fileType,
        "fileContent": file,
        "until":fileObject.until
      },
      headers: {
        "Authorization": "Bearer " + authtoken.getAccessToken(),
        "Content-Type": "multipart/form-data"
      }
    };
  } else {
    clientOptions = {
      url: uploadUrl,
      method: "POST",
      formData: {
        "fileType": fileObject.fileType,
        "fileUrl": fileObject.fileUrl,
        "until":fileObject.until
      },
      headers: {
        "Authorization": "Bearer " + authtoken.getAccessToken(),
        "Content-Type": "multipart/form-data"
      }
    };
  }

  if(BotServiceAgent){
    clientOptions.agent = BotServiceAgent;
  }

  if (configuration.clientconfig.scheme == 'https' && configuration.clientconfig.ca != null) {
    clientOptions.agentOptions = {};
    clientOptions.agentOptions.ca = configuration.clientconfig.ca && require('fs').readFileSync(configuration.clientconfig.ca);
  }
  attemptrequest(clientOptions, cb);
}


/*Interface API to send Message in existing Chat
  the msg should be wrapped in a "RCSMessage" object
  */
ssBotBuilder.prototype.reply = function(src, msg, cb) {
  if (!tokenState) {
    log.error("Bot Server is not in ready State");
    cb && cb("Bot Server is not in ready State");
    return ;
  }
  msg.messageContact = src.messageContact;
  var requesturl = configuration.clientconfig.scheme + '://' + configuration.botservice + configuration.apipath + configuration.botID + '/messages';
  send(msg, requesturl, "POST", cb);
};

/*Interface API to send Unsolicited Message  to User*/
ssBotBuilder.prototype.say = function(dest, msg, cb) {
  if (!tokenState) {
    log.error("Bot Server is not in ready State");
    cb && cb("Bot Server is not in ready State");
    return ;
  }
  var message = JSON.parse(JSON.stringify(msg));
  message.messageContact = dest;
  var requesturl = configuration.clientconfig.scheme + '://' + configuration.botservice + configuration.apipath + configuration.botID + '/messages';
  send(message, requesturl, "POST", cb);
};

/*Interface API to send typing indication*/
ssBotBuilder.prototype.typing = function(dest, value, cb) {
  if (!tokenState) {
    log.error("Bot Server is not in ready State");
    cb && cb("Bot Server is not in ready State");
    return ;
  }
  var message = {
    "RCSMessage" : {
      "isTyping": value
    }
  };
  message.messageContact = dest;
  var requesturl = configuration.clientconfig.scheme + '://' + configuration.botservice + configuration.apipath + configuration.botID + '/messages';
  send(message, requesturl, "POST", cb);
};

/*Interface API to send read report*/
ssBotBuilder.prototype.read = function (msgId, cb) {
  if (!tokenState) {
    log.error("Bot Server is not in ready State");
    cb && cb("Bot Server is not in ready State");
    return;
  }
  var message = {
    "RCSMessage" : {
      "status": "displayed"
    }
  };
  var requesturl = configuration.clientconfig.scheme + '://' + configuration.botservice + configuration.apipath + configuration.botID + '/messages/' +
    msgId + '/status';
  send(message, requesturl, "PUT", cb);
};

/*Interface API to send revoke*/
ssBotBuilder.prototype.revoke = function (msgId, cb) {
  if (!tokenState) {
    log.error("Bot Server is not in ready State");
    cb && cb("Bot Server is not in ready State");
    return;
  }
  var message = {
    "RCSMessage" : {
      "status": "canceled",
    }
  };
  var requesturl = configuration.clientconfig.scheme + '://' + configuration.botservice + configuration.apipath + configuration.botID + '/messages/' +
    msgId + '/status';
  send(message, requesturl, "PUT", cb);
};

/*Interface API to get message status*/
ssBotBuilder.prototype.msgstatus = function (msgId, cb) {
  if (!tokenState) {
    log.error("Bot Server is not in ready State");
    cb && cb("Bot Server is not in ready State");
    return;
  }

  var requesturl = configuration.clientconfig.scheme + '://' + configuration.botservice + configuration.apipath + configuration.botID + '/messages/' +
    msgId + '/status';
  send(null, requesturl, "GET", cb);
};

/*Interface API to get uploaded file information*/
ssBotBuilder.prototype.fileinfo = function (fileId, cb) {
  if (!tokenState) {
    log.error("Bot Server is not in ready State");
    cb && cb("Bot Server is not in ready State");
    return;
  }

  var requesturl = configuration.clientconfig.scheme + '://' + configuration.botservice + configuration.apipath + configuration.botID + '/files/' +
    fileId;
  send(null, requesturl, "GET", cb);
};

/*Interface API to delete uploaded file*/
ssBotBuilder.prototype.deleteFile = function (fileId, cb) {
  if (!tokenState) {
    log.error("Bot Server is not in ready State");
    cb && cb("Bot Server is not in ready State");
    return;
  }

  var requesturl = configuration.clientconfig.scheme + '://' + configuration.botservice + configuration.apipath + configuration.botID + '/files/' +
    fileId;
  send(null, requesturl, "DELETE", cb);
};

/*Interface API to query remote contact capability*/
ssBotBuilder.prototype.capability = function (userContact, chatId, cb) {
  if (!tokenState) {
    log.error("Bot Server is not in ready State");
    cb && cb("Bot Server is not in ready State");
    return;
  }
  if (!userContact && !chatId) {
    log.error("no contact");
    cb && cb("no contact");
    return;
  }
  if (userContact && chatId) {
    log.error("only one contact allowed");
    cb && cb("only one contact allowed");
    return;
  }
  var requesturl;
  if (userContact) {
    requesturl = configuration.clientconfig.scheme + '://' + configuration.botservice + configuration.apipath + configuration.botID + '/contactCapabilities?userContact=' + encodeURIComponent(userContact);
  } else {
    requesturl = configuration.clientconfig.scheme + '://' + configuration.botservice + configuration.apipath + configuration.botID + '/contactCapabilities?chatId=' + chatId;
  }
  send(null, requesturl, "GET", cb);
};

/*Interface API to read Messages for Specific Keywords of type 'textMessage'(plain text message),
'displayText'(displayText from suggested reply/action) and
'postback' (postback.data from suggested response*/
ssBotBuilder.prototype.handle = function(keywords, event, cb) {
  if (!cb) {
    log.error('Callback is null');
    process.exit(1);
  }
  if (typeof(keywords) == 'string') {
    keywords = [keywords];
  }
  var regkeywords = [];
  if (!store_regexp(keywords, regkeywords)) {
    log.error('Contains Invalid expression');
    process.exit(1);
  }
  var matches_pair = {
    keywords: regkeywords,
    cb: cb
  };
  events[event] = events[event] || [];
  events[event].push(matches_pair);
}

/* Interface API to create new RCSMessage object with text */
ssBotBuilder.prototype.newTextMessage = function(text) {
  var msg = {
    "RCSMessage": {}
  };
  msg.RCSMessage.textMessage = text;
  return msg;
}

/* Interface API to create new RCSMessage object with file url */
ssBotBuilder.prototype.newFileMessageByUrl = function(fileUrl) {
  var msg = {
    "RCSMessage": {}
  };
  var fm = {};
  fm.fileUrl = fileUrl;
  msg.RCSMessage.fileMessage = fm;
  return msg;
}

/* Interface API to create new RCSMessage object with fileMessage */
ssBotBuilder.prototype.newFileMessageByObject = function(fileMessage) {
  var msg = {
    "RCSMessage": {}
  };
  msg.RCSMessage.fileMessage = fileMessage;
  return msg;
}

/* Interface API to create new RCSMessage object with file info */
ssBotBuilder.prototype.newFileMessage = function(thumbnailFileName, thumbnailUrl, thumbnailMIMEType, thumbnailFileSize, fileName, fileUrl, fileMIMEType, fileSize) {
  var msg = {
    "RCSMessage": {}
  };
  var fm = {};
  fm.thumbnailFileName = thumbnailFileName;
  fm.thumbnailUrl = thumbnailUrl;
  fm.thumbnailMIMEType = thumbnailMIMEType;
  fm.thumbnailFileSize = thumbnailFileSize;
  fm.fileName = fileName;
  fm.fileUrl = fileUrl;
  fm.fileMIMEType = fileMIMEType;
  fm.fileSize = fileSize;
  msg.RCSMessage.fileMessage = fm;
  return msg;
}

/* Interface API to create new RCSMessage object with audio file info */
ssBotBuilder.prototype.newAudioMessage = function(fileUrl, fileName, fileMIMEType, fileSize, playingLength) {
  var msg = {
    "RCSMessage": {}
  };
  var audioMessage = {};
  audioMessage.fileUrl = fileUrl;
  audioMessage.fileName = fileName;
  audioMessage.fileMIMEType = fileMIMEType;
  audioMessage.fileSize = fileSize;
  audioMessage.playingLength = playingLength;
  msg.RCSMessage.audioMessage = audioMessage;
  return msg;
}

/* Interface API to create new suggested reply with displaytext and postback info*/
ssBotBuilder.prototype.newReply = function(displayText, postback) {
  var re = {
    "reply": {}  
  };
  re.reply.displayText = displayText.substring(0,25);
  if (postback) {
    re.reply.postback = {};
    re.reply.postback.data = postback.substring(0, 2048);
  }
  return re;
}

/* Interface API to create new suggestions object with suggested replies and actions */
ssBotBuilder.prototype.newSuggestions = function() {
  var i, suggestions = [];
  var len = arguments.length;
  if (len > 11) {
    len = 11;
  }
  for (i = 0; i < len; i++) {
    suggestions.push(arguments[i]);
  }
  return suggestions;
}

/* Interface API to create new chiplist object with suggested replies and actions */
ssBotBuilder.prototype.newSuggestedChipList = function(suggestions) {
  var cl = {
    "suggestions": {}
  }
  cl.suggestions = suggestions;
  return cl;
}

ssBotBuilder.prototype.LAYOUT_ORIENTATION_VERTICAL = "VERTICAL";
ssBotBuilder.prototype.LAYOUT_ORIENTATION_HORIZONTAL = "HORIZONTAL";
ssBotBuilder.prototype.IMAGE_ALIGNMENT_LEFT = "LEFT";
ssBotBuilder.prototype.IMAGE_ALIGNMENT_RIGHT = "RIGHT";

/* Interface API to create new RichCard Layout object with layout info */
ssBotBuilder.prototype.newRichCardLayout = function(orientation, imageAlignment) {
  var layout = {};
  if (orientation == this.LAYOUT_ORIENTATION_VERTICAL || orientation == this.LAYOUT_ORIENTATION_HORIZONTAL) {
    this.cardOrientation = orientation;
  } else {
    this.cardOrientation = this.LAYOUT_ORIENTATION_VERTICAL;
  }

  if (orientation == this.LAYOUT_ORIENTATION_HORIZONTAL && (imageAlignment == this.IMAGE_ALIGNMENT_LEFT || imageAlignment == this.IMAGE_ALIGNMENT_RIGHT)) {
    this.imageAlignment = imageAlignment;
  }
  return layout;
}

ssBotBuilder.prototype.MEDIA_HEIGHT_SHORT_HEIGHT = "SHORT_HEIGHT";
ssBotBuilder.prototype.MEDIA_HEIGHT_MEDIUM_HEIGHT = "MEDIUM_HEIGHT";
ssBotBuilder.prototype.MEDIA_HEIGHT_TALL_HEIGHT = "TALL_HEIGHT";

/* Interface API to create new RichCard Media object with media info */
ssBotBuilder.prototype.newRichCardMedia = function(mediaUrl, mediaContentType, mediaFileSize, height, thumbnailUrl, thumbnailContentType, thumbnailFileSize, contentDescription) {
  var media = {};
  media.mediaUrl = mediaUrl;
  media.mediaContentType = mediaContentType;
  media.mediaFileSize = mediaFileSize;
  if (height == this.MEDIA_HEIGHT_SHORT_HEIGHT || this.MEDIA_HEIGHT_MEDIUM_HEIGHT || this.MEDIA_HEIGHT_TALL_HEIGHT) {
    media.height = height;
  } else {
    media.height = this.MEDIA_HEIGHT_MEDIUM_HEIGHT;
  }
  if (thumbnailUrl) {
    media.thumbnailUrl = thumbnailUrl;
  }
  if (thumbnailContentType) {
    media.thumbnailContentType = thumbnailContentType;
  }
  if (thumbnailFileSize) {
    media.thumbnailFileSize = thumbnailFileSize;
  }
  if (contentDescription) {
    media.contentDescription = contentDescription.substring(0,200);
  }
  return media;
}

/* Interface API to create new RichCard Content object with media, title, descriptions and suggestions info */
ssBotBuilder.prototype.newGeneralRichCardContent = function(media, title, description, suggestions) {
  var content = {};
  if (media) {
    content.media = media;
  }
  if (title) {
    content.title = title.substring(0,200);
  }
  if (description) {
    content.description = description.substring(0, 2000);
  }
  if (suggestions) {
    content.suggestions = suggestions;
  }
  return content;
}

/* Interface API to create new generalPurposeCard object with layout and card content */
ssBotBuilder.prototype.newGeneralRichCard = function(layout, content) {
  var card = {
    "message": {
      "generalPurposeCard": {}
    }
  }
  card.message.generalPurposeCard.layout = layout;
  card.message.generalPurposeCard.content = content;
  var msg = {
    "RCSMessage": {}
  };
  msg.RCSMessage.richcardMessage = card;
  return msg;
}

ssBotBuilder.prototype.CARD_WIDTH_SMALL_WIDTH = "SMALL_WIDTH";
ssBotBuilder.prototype.CARD_WIDTH_MEDIUM_WIDTH = "MEDIUM_WIDTH";

/* Interface API to create new carousel content */
ssBotBuilder.prototype.newGeneralCarouselContent = function() {
  var i, content = [];
  var len = arguments.length;
  
  for (i = 0; i < len; i++) {
    content.push(arguments[i]);
  }
  return content;
}

/* Interface API to create new generalPurposeCardCarousel object */
ssBotBuilder.prototype.newGeneralCarousel = function(layout, content) {
  var card = {
    "message": {
      "generalPurposeCardCarousel": {}
    }
  }
  card.message.generalPurposeCardCarousel.layout = layout;
  card.message.generalPurposeCardCarousel.content = content;
  var msg = {
    "RCSMessage": {}
  };
  msg.RCSMessage.richcardMessage = card;
  return msg;
}

/*Private API to routeMessages*/
var configureServiceRoute = function(webserver) {
  // Handle CORS
  webserver.options(configuration.serverconfig.webhook, cors());

  // Handle webhook validation request from portal
  webserver.get(configuration.serverconfig.webhook, cors(), function(req, res) {
    log.debug('Test webhook');
    var verificationToken = req.get('Authorization');
    if (!verificationToken || verificationToken != configuration.verificationtoken) {
      log.debug("verification token is not valid");
      res.status(401).send("unauthorized");
      return;
    }
    res.send('ok');
  });

  // logic to handle webhook POST
  webserver.post(configuration.serverconfig.webhook, cors(), function(req, res) {
    var obj = req.body;
    log.debug("\r\n\n");
    log.debug("+++++++++++++++++++++++++++++++++++++++++++++");
    log.debug('receive from webhook: ' + JSON.stringify(obj));
    log.debug("+++++++++++++++++++++++++++++++++++++++++++++");
    log.debug("\r\n\n");

    var verificationToken = req.get('Authorization');
    if (!verificationToken || verificationToken != configuration.verificationtoken) {
      log.debug("verification token is not valid, unauthorized message");
      res.status(401).send("unauthorized");
      return;
    }

    // TODO: Remove follow handling
    if (obj && obj.messageType && (obj.messageType.toLowerCase() == 'follow' || obj.messageType.toLowerCase() == 'unfollow')) {
      log.debug('got a follow message');
      var followMessage = {
        botID: obj.botID,
        botNumber: obj.botNumber
      };
      followMessage.message = obj.message;
      followMessage.contacts = obj.contacts;
      listeners['follow'] && listeners['follow'](followMessage);
    }

    // send everything to webhook
    if (obj) {
      set_event_type(obj);
      if (obj.RCSMessage && obj.RCSMessage.textMessage) {
        var text = obj.RCSMessage.textMessage;
        if (!(match_regexp(text, obj, 'textMessage'))) {
          listeners['webhook'] && listeners['webhook'](obj);
        }
      } else if (obj.RCSMessage && obj.RCSMessage.suggestedResponse) {
        var suggestionResponse = obj.RCSMessage.suggestedResponse.response;
        var reply;
        if (suggestionResponse.hasOwnProperty('reply')) {
          reply = suggestionResponse.reply;
        } else if (suggestionResponse.hasOwnProperty('action')) {
          reply = suggestionResponse.action;
        }
        if (!(match_regexp(reply.displayText, obj, 'displayText'))) {
          if (!reply.postback || !(match_regexp(reply.postback.data, obj, 'postback'))) {
            listeners['webhook'] && listeners['webhook'](obj);
          }
        }
      } else {
        listeners['webhook'] && listeners['webhook'](obj);
      }
    }
    res.send('ok');
  });
}

/*Private API to set event type*/
set_event_type = function(message) {
  if (message && !message.event) {
    if (message.RCSMessage) {
      if (message.RCSMessage.textMessage || message.RCSMessage.fileMessage || message.RCSMessage.audioMessage || message.RCSMessage.geolocationPushMessage) {
        message.event = "message";
      } else if (message.RCSMessage.suggestedResponse || message.RCSMessage.sharedData) {
        message.event = "response";
        if (message.RCSMessage.suggestedResponse && message.RCSMessage.suggestedResponse.response.reply && message.RCSMessage.suggestedResponse.response.reply.postback && message.RCSMessage.suggestedResponse.response.reply.postback.data == "new_bot_user_initiation") {
          message.event = "newUser";
        }
      } else if (message.RCSMessage.isTyping) {
        message.event = "isTyping";
      } else if (message.RCSMessage.status) {
        message.event = "messageStatus";
      } else {
        message.event = "unknown";
      }
    } else if (message.file) {
      message.event = "fileStatus";
    } else if (message.messageContact && message.messageContact.userContact && message.messageContact.chatId) {
      message.event = "alias";
    } else {
      message.event = "unknown";
    }
  }
}

/*Private API to store Regexp Objects*/
store_regexp = function(tests, regarr) {
  for (var t = 0; t < tests.length; t++) {
    var test = null;
    if (typeof(tests[t]) == 'string') {
      try {
        test = new RegExp(tests[t], 'gi');
      } catch (err) {
        log.error('Error in Regular expression: ' + tests[t] + ': ' + err);
        return false;
      }
      if (!test) {
        return false;
      }
    } else {
      test = tests[t];
    }
    regarr.push(test);
  }
  return true;
};
/*Private API to check Pattern Matching */
match_regexp = function(text, message, evt) {
  if (events[evt]) {
    var matches_pairarr = events[evt];
    for (var i = 0; i < matches_pairarr.length; i++) {
      var matches_pair = matches_pairarr[i];
      var keywords = matches_pair.keywords || [];
      for (var t = 0; t < keywords.length; t++) {
        var test = keywords[t];
        if (match = text.match(test)) {
          var cb = matches_pair.cb;
          cb && cb(message);
      return true;
        }
      }
    }
  }
  return false;
};


var tokenManager = {
  onNotReady: function() {
    tokenState = false ;
    log.warn('not ready now');
    listeners['state'] && listeners['state'](false);
  },
  onReady: function() {
    tokenState = true;
    log.warn("ready indication: " + authtoken.getAccessToken());

    listeners['state'] && listeners['state'](true);
  }
}

var attemptrequest = function (opts, cb) {
  var expBackoff = backoff.exponential({
    initialDelay: 1,
    maxDelay: 1000
  });
  
  opts.callID = Math.floor(Math.random() * 1000);
  opts.timestamp = (new Date()).toISOString();
  opts.contact = "";
  if (opts.json && opts.json.messageContact) {
    if (opts.json.messageContact.userContact) {
      opts.contact = opts.json.messageContact.userContact;
    } else {
      opts.contact = opts.json.messageContact.chatId;
    }
  } 
  opts.contact = "[" + opts.contact + "] ";
  
  var sendRequest = function() {
    request(opts, function (err, res, body) {
      log.debug("\r\n\n");
      log.debug(opts.contact + ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
      log.debug(opts.contact + "callID: " + opts.callID);
      log.debug(opts.contact + "request: " + opts.timestamp);
      log.debug(opts.contact + "url: " + opts.url);
      log.debug(opts.contact + "method: " + opts.method);      
      log.debug(opts.contact + JSON.stringify(opts.json));
      log.debug(opts.contact + "\r\n");
      log.debug(opts.contact + "response: " + (new Date()).toISOString());
      if (err) {
        log.debug(opts.contact + "err: " + err.message);
      }
      if (res) {
        log.debug(opts.contact + "statusCode: " + res.statusCode);
        log.debug(opts.contact + "statusMessage: "+ res.statusMessage);
      }
      if (body) {
        log.debug(opts.contact + JSON.stringify(body));
      }
      log.debug(opts.contact + "<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<");
      log.debug("\r\n\n");
      
      if (res && (res.statusCode == 500 || res.statusCode == 502) && number < 10) {
        log.debug('Response: ' + res.statusCode);
        expBackoff.backoff();
      } else {
        cb(err, res, body);
      }
    })
  }

  expBackoff.on('ready', function (number, delay) {
    log.debug('On backoff : ' + number + ' ' + delay + 'ms');
    sendRequest();
  });

  sendRequest();
}

/*Private API to send Messages to Bot Service*/
var send = function(msg, requesturl, method, cb) {
  var clientOptions;
  
  if (msg) {
    clientOptions = {
      url: requesturl,
      method: method,
      headers: {
        'Content-type': 'application/json',
        'Authorization': ('Bearer ' + authtoken.getAccessToken())
      },
      json: msg
    };
  } else {
    clientOptions = {
      url: requesturl,
      method: method,
      headers: {
        'Authorization': ('Bearer ' + authtoken.getAccessToken())
      }
    };
  }
  if(BotServiceAgent){
    clientOptions.agent = BotServiceAgent;
  }
  if (configuration.clientconfig.scheme == 'https' && configuration.clientconfig.ca != null) {
    clientOptions.agentOptions = {};
    clientOptions.agentOptions.ca = configuration.clientconfig.ca && require('fs').readFileSync(configuration.clientconfig.ca);
  }

  attemptrequest(clientOptions,cb);
}

module.exports = new ssBotBuilder();
