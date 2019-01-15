require('log-timestamp');
var log = require('loglevel');
var ssbot = require('./ssbotbuilder.js');
var fs = require("fs");
var simpletext = require('./res/json/textlist.json');
var options = require('./options.json');
var crypto = require("crypto");
var chips = require('./res/json/chips.json');
var postbacks = require('./res/json/postbacks.json');
var files = require('./res/json/files.json');
var layouts = require('./res/json/layouts.json');
var cardmedias = require('./res/json/cardmedias.json');
var defaults = require('./res/json/default.json');
var sessions = {};

// Set custom logging level for sdk modules ("TRACE", "DEBUG", "INFO", "WARN", "ERROR")
log.getLogger("authtoken").setLevel("DEBUG");
log.getLogger("ssbotbuilder").setLevel("DEBUG");

// Set logging level for app
log.setLevel("DEBUG");

ssbot.createService(options, function (err, webserver) {
  if (!err) {
    ssbot.listen('state', onStateListener);
    ssbot.listen('webhook', onWebhookMessage);
  }
});

var onWebhookMessage = function (message) {
  var reply;  
  
  if (!message) {
    log.warn("!!!empty message!!!");
    return;
  }

  if (message.event == "newUser") {
    reply = ssbot.newTextMessage(simpletext.hello);
    ssbot.say(message.messageContact, reply, onResponse);
  } else if (message.event == "message") {
      handle_event_message(message);
  } else if (message.event == "response") {
    if (message.RCSMessage.sharedData) {
      handle_response_device_specifics(message);
    } else if (message.RCSMessage.suggestedResponse.response.action) {
      log.debug("Don't reply for suggested action response");
    } else {
      handle_reply_start_over(message);
    }
  } else if (message.event == "isTyping") {
  } else if (message.event == "messageStatus") {
  } else if (message.event == "fileStatus") {
  } else if (message.event == "alias") {
  } else if (message.RCSMessage && message.RCSMessage.msgId){
    handle_reply_start_over(message);
  } else if (message.messageContact && message.messageContact.userContact) {
    reply = ssbot.newTextMessage(simpletext.hello);
    ssbot.say(message.messageContact, reply, onResponse);
  }
}

var setSession = function(contact, cards) {
  sessions[contact] = cards;
}

var getSession = function(contact) {
  if (contact) {
    var session = sessions[contact];
    if (session)
      return session;
    else {
      setSession(contact, defaults);
      return null;
    }
  } else {
    return null;
  }
}

var handle_event_message = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);
  var reply;
  if (getSession(message.messageContact.userContact)) {
    reply = ssbot.newTextMessage(simpletext.hello_old);  
  } else {
    reply = ssbot.newTextMessage(simpletext.hello_new);
  }
  var r1 = ssbot.newReply(simpletext.view_cards, postbacks.view_cards);
  var r2 = ssbot.newReply(simpletext.edit_cards, postbacks.edit_cards);
  var r3 = ssbot.newReply(simpletext.start_over, postbacks.start_over);
  var suggestions = ssbot.newSuggestions(r1, r2, r3);
  reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  ssbot.reply(message, reply, onResponse);
}

var debugCards = function(cards) {
  log.debug("********************************");
  log.debug("Cards: " + JSON.stringify(cards));
  log.debug("********************************");
}

var handle_reply_view_cards = function (message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);
  var contact = message.messageContact.userContact;

  var pb = message.RCSMessage.suggestedResponse.response.reply.postback.data;
  var reply, suggestions, r1, r2;

  if (pb == postbacks.view_cards) {
    reply = ssbot.newTextMessage(simpletext.what_to_view);
    r1 = ssbot.newReply(simpletext.view_richcard, postbacks.view_richcard);
    r2 = ssbot.newReply(simpletext.view_carousel, postbacks.view_carousel);
    suggestions = ssbot.newSuggestions(r1, r2);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
    ssbot.reply(message, reply, onResponse);
  } else if (pb == postbacks.view_richcard) {
    var cards = getSession(contact);
    if (!cards) cards = defaults;
    reply = cards.richcard;
    ssbot.reply(message, reply, onResponse);
  } else if (pb == postbacks.view_carousel) {
    var cards = getSession(contact);
    if (!cards) cards = defaults;
    reply = cards.carousel;
    ssbot.reply(message, reply, onResponse);
  }
}

var handle_reply_edit_cards = function (message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);
  var contact = message.messageContact.userContact;

  var pb = message.RCSMessage.suggestedResponse.response.reply.postback.data;
  var reply, suggestions, r1, r2;

  var cards = getSession(contact);
  if (pb == postbacks.edit_cards) {
    reply = ssbot.newTextMessage(simpletext.select_card_type);
    r1 = ssbot.newReply(simpletext.build_richcard, postbacks.build_richcard);
    r2 = ssbot.newReply(simpletext.build_carousel, postbacks.build_carousel);
    suggestions = ssbot.newSuggestions(r1, r2);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
    ssbot.reply(message, reply, onResponse);
  } else if (pb == postbacks.build_richcard) {
    reply = ssbot.newTextMessage(simpletext.select_richcard_topic);
    r1 = ssbot.newReply(simpletext.richcard_layout, postbacks.richcard_layout);
    r2 = ssbot.newReply(simpletext.richCard_content, postbacks.richCard_content);
    suggestions = ssbot.newSuggestions(r1, r2);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
    ssbot.reply(message, reply, onResponse);
  } else if (pb == postbacks.build_carousel) {
  }
}

var handle_reply_start_over = function (message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);
  var contact = message.messageContact.userContact;

  var pb = message.RCSMessage.suggestedResponse.response.reply.postback.data;   
  var reply, suggestions, r1, r2, r3;

  if (pb == postbacks.start_over) {
    reply = ssbot.newTextMessage(simpletext.start_over_confirm);
    r1 = ssbot.newReply(simpletext.start_over_yes, postbacks.start_over_yes);
    r2 = ssbot.newReply(simpletext.start_over_no, postbacks.start_over_no);
    suggestions = ssbot.newSuggestions(r1, r2);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
    ssbot.reply(message, reply, onResponse);

  } else if (pb == postbacks.start_over_yes) {
    setSession(contact, defaults);
  } else if (pb == postbacks.start_over_no) {
    handle_event_message(message);    
  }
}

var handle_reply_richcard_layout = function (message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);
  var contact = message.messageContact.userContact;

  var pb = message.RCSMessage.suggestedResponse.response.reply.postback.data;
  var reply, suggestions, r1, r2, r3;

  var cards = getSession(contact);
  var richcard = cards.richcard;
  var layout = richcard.RCSMessage.richcardMessage.message.generalPurposeCard.layout;
  var cardOrientation, imageAlignment;
  if (layout) {
    cardOrientation = layout.cardOrientation;
    imageAlignment = layout.imageAlignment;
  }
   

  if (pb == postbacks.richcard_layout) {
    reply = ssbot.newTextMessage(simpletext.richcard_layout_current + simpletext.richcard_layout_card_orientation + ": " + cardOrientation + " / " + simpletext.richcard_layout_image_alignment + ": " + imageAlignment + ".\r\n\n" + simpletext.richcard_layout_what_orientation);
    r1 = ssbot.newReply(simpletext.richard_layout_orientation_vertical, postbacks.richard_layout_orientation_vertical);
    r2 = ssbot.newReply(simpletext.richard_layout_orientation_horizontal_left, postbacks.richard_layout_orientation_horizontal_left);
    r3 = ssbot.newReply(simpletext.richard_layout_orientation_horizontal_right, postbacks.richard_layout_orientation_horizontal_right);
    suggestions = ssbot.newSuggestions(r1, r2, r3);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
    ssbot.reply(message, reply, onResponse);
  } else if (pb == postbacks.richard_layout_orientation_vertical) { 
    cards.richcard.RCSMessage.richcardMessage.message.generalPurposeCard.layout = layouts.general_vertical;
    debugCards(cards);
    setSession(contact, cards);
    handle_event_message(message);
  } else if (pb == postbacks.richard_layout_orientation_horizontal_left) { 
    cards.richcard.RCSMessage.richcardMessage.message.generalPurposeCard.layout = layouts.general_horizontal_left;
    debugCards(cards);
    setSession(contact, cards);
    handle_event_message(message);
  } else if (pb == postbacks.richard_layout_orientation_horizontal_right) { 
    cards.richcard.RCSMessage.richcardMessage.message.generalPurposeCard.layout = layouts.general_horizontal_right;
    debugCards(cards);
    setSession(contact, cards);
    handle_event_message(message);
  }
}


var handle_reply_richcard_content = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);

  var contact = message.messageContact.userContact;

  var pb = message.RCSMessage.suggestedResponse.response.reply.postback.data;
  var reply, suggestions, r1, r2, r3, r4;

  var cards = getSession(contact);
  var richcard = cards.richcard;
  var content = richcard.RCSMessage.richcardMessage.message.generalPurposeCard.content;
  var media, title, description, suggestions_card;
  if (content) {
    media = content.media;
    title = content.title;
    description = content.description;
    suggestions_card = content.suggestions;
  }
  
  if (pb == postbacks.richCard_content) {
    reply = ssbot.newTextMessage(simpletext.richCard_content_task);
    r1 = ssbot.newReply(simpletext.richcard_content_media, postbacks.richcard_content_media);
    r2 = ssbot.newReply(simpletext.richcard_content_title, postbacks.richcard_content_title);
    r3 = ssbot.newReply(simpletext.richcard_content_description, postbacks.richcard_content_description);
    r4 = ssbot.newReply(simpletext.richcard_content_suggestions, postbacks.richcard_content_suggestions);

    suggestions = ssbot.newSuggestions(r1, r2, r3, r4);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
    ssbot.reply(message, reply, onResponse);
  }
}







var handle_reply_advanced = function (message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);
  ssbot.typing(message.messageContact, "active", onResponse);
  
  var reply = ssbot.newTextMessage(simpletext.what_to_test);  
  var r1 = ssbot.newReply(simpletext.test_richcard_adv, postbacks.test_richcard_adv);
  var r2 = ssbot.newReply(simpletext.test_carousel_adv, postbacks.test_carousel_adv);
  var r3 = ssbot.newReply(simpletext.test_api, postbacks.test_api);
  var suggestions = ssbot.newSuggestions(r1, r2, r3);
  reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  
  ssbot.reply(message, reply, onResponse);
}

var handle_reply_10776 = function (message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);
  ssbot.typing(message.messageContact, "active", onResponse);
  
  var reply = ssbot.newTextMessage(simpletext.what_to_test);
  var r1 = ssbot.newReply(simpletext.test_bot_interaction, postbacks.test_bot_interaction);
  var r2 = ssbot.newReply(simpletext.test_richcard_10776, postbacks.test_richcard_10776);
  var r3 = ssbot.newReply(simpletext.test_chiplist_10776, postbacks.test_chiplist_10776);
  var r4 = ssbot.newReply(simpletext.test_carousel_10776, postbacks.test_carousel_10776);
  
  var suggestions = ssbot.newSuggestions(r1, r2, r3, r4);
  reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);

  ssbot.reply(message, reply, onResponse);
}

var handle_reply_bot_interaction = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);
  ssbot.typing(message.messageContact, "active", onResponse);

  var reply = ssbot.newTextMessage(simpletext.what_to_test);
  var r1 = ssbot.newReply(simpletext.test_send_msg_to_coco, postbacks.test_send_msg_to_coco);
  var r2 = ssbot.newReply(simpletext.test_receive_msg_from_coco, postbacks.test_receive_msg_from_coco);
  var suggestions = ssbot.newSuggestions(r1, r2);
  reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);

  ssbot.reply(message, reply, onResponse);
}

var handle_reply_send_msg_to_coco = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);
  ssbot.typing(message.messageContact, "active", onResponse);

  var reply = ssbot.newTextMessage(simpletext.what_msg_to_send);
  var r1 = ssbot.newReply(simpletext.test_send_text_to_coco, postbacks.test_send_text_to_coco);
  var r2 = ssbot.newReply(simpletext.test_send_file_to_coco, postbacks.test_send_file_to_coco);
  var suggestions = ssbot.newSuggestions(r1, r2);
  reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);

  ssbot.reply(message, reply, onResponse);
}

var handle_reply_receive_msg_from_coco = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);
  ssbot.typing(message.messageContact, "active", onResponse);

  var reply = ssbot.newTextMessage(simpletext.what_msg_to_receive);
  var r1 = ssbot.newReply(simpletext.test_receive_short_text_from_coco, postbacks.test_receive_short_text_from_coco);
  var r2 = ssbot.newReply(simpletext.test_receive_long_text_from_coco, postbacks.test_receive_long_text_from_coco);
  var r3 = ssbot.newReply(simpletext.test_receive_image_from_coco, postbacks.test_receive_image_from_coco);
  var r4 = ssbot.newReply(simpletext.test_receive_audio_from_coco, postbacks.test_receive_audio_from_coco);
  var r5 = ssbot.newReply(simpletext.test_receive_video_from_coco, postbacks.test_receive_video_from_coco);
  var suggestions = ssbot.newSuggestions(r1, r2, r3, r4, r5);
  reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  
  ssbot.reply(message, reply, onResponse);
}

var handle_reply_send_text_to_coco = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);
  ssbot.typing(message.messageContact, "active", onResponse);
  var reply = ssbot.newTextMessage(simpletext.send_text_to_coco);
  ssbot.reply(message, reply, onResponse);
}

var handle_test_read_receipt = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);  
  var reply;
  if (message.RCSMessage.textMessage.length < 1024) {
    reply = ssbot.newTextMessage(simpletext.test_read_receipt);
  } else {
    reply = ssbot.newTextMessage(simpletext.send_text_to_coco_too_long);
  }
  var r1 = ssbot.newReply(simpletext.test_send_text_to_coco, postbacks.test_send_text_to_coco);
  var r2 = ssbot.newReply(simpletext.test_send_file_to_coco, postbacks.test_send_file_to_coco);
  var r3 = chips.start_over;
  var suggestions = ssbot.newSuggestions(r1, r2, r3);
  reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  ssbot.reply(message, reply, onResponse);
}

var handle_test_no_read_receipt = function(message) {  
  var reply;
  if (message.RCSMessage.textMessage.length >= 1024) {
    reply = ssbot.newTextMessage(simpletext.test_no_read_receipt);    
  } else {
    reply = ssbot.newTextMessage(simpletext.send_text_to_coco_not_long_enough);
  }
  var r1 = ssbot.newReply(simpletext.test_send_text_to_coco, postbacks.test_send_text_to_coco);
  var r2 = ssbot.newReply(simpletext.test_send_file_to_coco, postbacks.test_send_file_to_coco);
  var r3 = chips.start_over;
  var suggestions = ssbot.newSuggestions(r1, r2, r3);
  reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  ssbot.reply(message, reply, onResponse);
}

var handle_reply_send_file_to_coco = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);
  ssbot.typing(message.messageContact, "active", onResponse);
  var reply = ssbot.newTextMessage(simpletext.select_file);
  ssbot.reply(message, reply, onResponse);
}

var handle_test_send_file_to_coco = function(message) {
  var isImage = message.RCSMessage.fileMessage.fileMIMEType.includes("image");
  if (isImage) {
    ssbot.read(message.RCSMessage.msgId, onResponse);
  }
  ssbot.typing(message.messageContact, "active", onResponse);
  var reply = ssbot.newTextMessage(simpletext.received_file);
  ssbot.reply(message, reply, onResponse);
  
  reply = {
    "RCSMessage": {
      "fileMessage": "",      
    }
  };
  reply.RCSMessage.fileMessage = message.RCSMessage.fileMessage;    

  var r1 = ssbot.newReply(simpletext.test_send_text_to_coco, postbacks.test_send_text_to_coco);
  var r2 = ssbot.newReply(simpletext.test_send_file_to_coco, postbacks.test_send_file_to_coco);
  var r3 = chips.start_over;
  var suggestions = ssbot.newSuggestions(r1, r2, r3);
  reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  
  ssbot.reply(message, reply, onResponse);
}

var handle_reply_receive_text_from_coco = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);
  ssbot.typing(message.messageContact, "active", onResponse);
  var pb = message.RCSMessage.suggestedResponse.response.reply.postback.data;  
  var ran;
  var str;
  if (pb == postbacks.test_receive_short_text_from_coco) {    
    str = generateRandomString(1, 512);        
  } else if (pb == postbacks.test_receive_long_text_from_coco) {        
    str = generateRandomString(512, 1024);
  }
  var reply = ssbot.newTextMessage("I am sending " + str.length + " bytes text to you. \r\n\u26D4Please report the issue if you don't receive it.");
  ssbot.reply(message, reply, onResponse);

  reply = ssbot.newTextMessage(str);
  var r1 = ssbot.newReply(simpletext.test_receive_short_text_from_coco, postbacks.test_receive_short_text_from_coco);
  var r2 = ssbot.newReply(simpletext.test_receive_long_text_from_coco, postbacks.test_receive_long_text_from_coco);
  var r3 = ssbot.newReply(simpletext.test_receive_image_from_coco, postbacks.test_receive_image_from_coco);
  var r4 = ssbot.newReply(simpletext.test_receive_audio_from_coco, postbacks.test_receive_audio_from_coco);
  var r5 = ssbot.newReply(simpletext.test_receive_video_from_coco, postbacks.test_receive_video_from_coco);
  var r6 = chips.start_over;
  var suggestions = ssbot.newSuggestions(r1, r2, r3, r4, r5, r6);
  reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);

  ssbot.reply(message, reply, onResponse);
}

var handle_reply_receive_file_from_coco = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);
  ssbot.typing(message.messageContact, "active", onResponse);
  var pb = message.RCSMessage.suggestedResponse.response.reply.postback.data;  
  
  var reply; 
  if (pb == postbacks.test_receive_image_from_coco) {
    reply = ssbot.newTextMessage(simpletext.receive_image_file);
    ssbot.reply(message, reply, onResponse);
    reply = ssbot.newFileMessageByObject(files.image_coco); 
    //reply = JSON.parse(fs.readFileSync("res/json/file_image.json"));         
  } else if (pb == postbacks.test_receive_audio_from_coco) {
    reply = ssbot.newTextMessage(simpletext.receive_audio_file);
    ssbot.reply(message, reply, onResponse);
    reply = ssbot.newFileMessageByObject(files.audio_coco);          
  } else if (pb == postbacks.test_receive_video_from_coco) {
    reply = ssbot.newTextMessage(simpletext.receive_video_file);
    ssbot.reply(message, reply, onResponse);
    reply = ssbot.newFileMessageByObject(files.video_coco);          
  }
  ssbot.typing(message.messageContact, "active", onResponse);

  var r1 = ssbot.newReply(simpletext.test_receive_short_text_from_coco, postbacks.test_receive_short_text_from_coco);
  var r2 = ssbot.newReply(simpletext.test_receive_long_text_from_coco, postbacks.test_receive_long_text_from_coco);
  var r3 = ssbot.newReply(simpletext.test_receive_image_from_coco, postbacks.test_receive_image_from_coco);
  var r4 = ssbot.newReply(simpletext.test_receive_audio_from_coco, postbacks.test_receive_audio_from_coco);
  var r5 = ssbot.newReply(simpletext.test_receive_video_from_coco, postbacks.test_receive_video_from_coco);
  var r6 = chips.start_over;
  var suggestions = ssbot.newSuggestions(r1, r2, r3, r4, r5, r6);
  reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  
  ssbot.reply(message, reply, onResponse);
}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               

var handle_reply_richcard_10776 = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);
  ssbot.typing(message.messageContact, "active", onResponse);

  var reply = ssbot.newTextMessage(simpletext.what_media_type_richcard);
  var r1 = ssbot.newReply(simpletext.test_receive_image_richcard, postbacks.test_receive_image_richcard);
  var r2 = ssbot.newReply(simpletext.test_receive_audio_richcard, postbacks.test_receive_audio_richcard);
  var r3 = ssbot.newReply(simpletext.test_receive_video_richcard, postbacks.test_receive_video_richcard);
  var r4 = ssbot.newReply(simpletext.test_receive_gif_richcard, postbacks.test_receive_gif_richcard);
  var r5 = ssbot.newReply(simpletext.test_richcard_learn, postbacks.test_richcard_learn);
  var suggestions = ssbot.newSuggestions(r1, r2, r3, r4, r5);
  reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);

  ssbot.reply(message, reply, onResponse);
}

var handle_reply_select_richcard_media_type = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);
  ssbot.typing(message.messageContact, "active", onResponse);

  var pb = message.RCSMessage.suggestedResponse.response.reply.postback.data;
  var type = "?type="+ message.RCSMessage.suggestedResponse.response.reply.displayText;
  
  var reply, suggestions;
   
  if (pb == postbacks.test_richcard_learn) {
    reply = ssbot.newTextMessage(simpletext.richcard_basic);
    var r1 = ssbot.newReply(simpletext.test_richcard_back, postbacks.test_richcard_back);
    suggestions = ssbot.newSuggestions(r1);
  } else {
    reply = ssbot.newTextMessage(simpletext.what_to_test);
    var r1 = ssbot.newReply(simpletext.test_receive_normal_richcard, postbacks.test_receive_normal_richcard+type);
    var r2 = ssbot.newReply(simpletext.test_receive_no_thumbnail_richcard, postbacks.test_receive_no_thumbnail_richcard+type);
    var r3 = ssbot.newReply(simpletext.test_receive_broken_thumbnail_richcard, postbacks.test_receive_broken_thumbnail_richcard+type);
    var r4 = ssbot.newReply(simpletext.test_receive_broken_file_richcard, postbacks.test_receive_broken_file_richcard+type);
    var r5 = ssbot.newReply(simpletext.test_receive_all_broken_richcard, postbacks.test_receive_all_broken_richcard+type);
    suggestions = ssbot.newSuggestions(r1, r2, r3, r4, r5);
  }
  reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  ssbot.reply(message, reply, onResponse);
}

var handle_reply_receive_richcard_from_coco = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);
  ssbot.typing(message.messageContact, "active", onResponse);
  
  var pb = message.RCSMessage.suggestedResponse.response.reply.postback.data;  
  if (pb == postbacks.test_richcard_back) {
    handle_reply_richcard_10776(message);
    return;
  }

  var type = pb.substring(pb.indexOf("=") + 1);
  pb = pb.substring(0, pb.indexOf("?"));

  var reply, layout, content, media, title, description;
  layout = layouts.general_vertical;
  title = "Rich Card Test";  
  cardmedias = JSON.parse(fs.readFileSync("res/json/cardmedias.json"));

  if (type == simpletext.test_receive_image_richcard) {
    media = cardmedias.image_coco_medium;
  } else if (type == simpletext.test_receive_audio_richcard) {
    media = cardmedias.audio_coco_medium;
  } else if (type == simpletext.test_receive_video_richcard) {
    media = cardmedias.video_coco_medium;
  } else if (type == simpletext.test_receive_gif_richcard) {
    media = cardmedias.gif_coco_medium;
  }
  
  if (pb == postbacks.test_receive_normal_richcard) {
    reply = ssbot.newTextMessage(simpletext.normal_richcard);
    ssbot.reply(message, reply, onResponse);

    description = simpletext.normal_richcard;
  } else if (pb == postbacks.test_receive_no_thumbnail_richcard) {
    reply = ssbot.newTextMessage(simpletext.no_thumbnail_richcard);
    ssbot.reply(message, reply, onResponse);
    
    description = simpletext.no_thumbnail_richcard;    
    delete media.thumbnailUrl;
    delete media.thumbnailContentType;
    delete media.thumbnailFileSize;                   
  } else if (pb == postbacks.test_receive_broken_thumbnail_richcard) {
    reply = ssbot.newTextMessage(simpletext.broken_thumbnail_richcard);
    ssbot.reply(message, reply, onResponse);
    
    description = simpletext.broken_thumbnail_richcard;
    var str = media.thumbnailUrl;
    media.thumbnailUrl = str.substring(0,10);
  } else if (pb == postbacks.test_receive_broken_file_richcard) {
    reply = ssbot.newTextMessage(simpletext.broken_file_richcard);
    ssbot.reply(message, reply, onResponse);
    reply = ssbot.newFileMessageByObject(files.video_coco); 
    
    description = simpletext.broken_file_richcard;    
    var str = media.mediaUrl; 
    media.mediaUrl = str.substring(0,10);
  } else if (pb == postbacks.test_receive_all_broken_richcard) {
    reply = ssbot.newTextMessage(simpletext.all_broken_richcard);
    ssbot.reply(message, reply, onResponse);
    
    description = simpletext.all_broken_richcard;
    var str = media.thumbnailUrl;
    media.thumbnailUrl = str.substring(0,10);
    str = media.mediaUrl; 
    media.mediaUrl = str.substring(0,10);          
  }

  ssbot.typing(message.messageContact, "active", onResponse);
  content = ssbot.newGeneralRichCardContent(media, title, description);    
  reply = ssbot.newGeneralRichCard(layout, content);

  type = "?type=" + type;
  var r1 = ssbot.newReply(simpletext.test_receive_normal_richcard, postbacks.test_receive_normal_richcard+type);
  var r2 = ssbot.newReply(simpletext.test_receive_no_thumbnail_richcard, postbacks.test_receive_no_thumbnail_richcard+type);
  var r3 = ssbot.newReply(simpletext.test_receive_broken_thumbnail_richcard, postbacks.test_receive_broken_thumbnail_richcard+type);
  var r4 = ssbot.newReply(simpletext.test_receive_broken_file_richcard, postbacks.test_receive_broken_file_richcard+type);
  var r5 = ssbot.newReply(simpletext.test_receive_all_broken_richcard, postbacks.test_receive_all_broken_richcard+type);
  var r6 = chips.start_over;
  var suggestions = ssbot.newSuggestions(r1, r2, r3, r4, r5, r6);
  reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);

  ssbot.reply(message, reply, onResponse);
}

var handle_reply_chiplist_10776 = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);
  ssbot.typing(message.messageContact, "active", onResponse);

  var reply = ssbot.newTextMessage(simpletext.what_message_type_chiplist);
  var r1 = ssbot.newReply(simpletext.test_text_with_chiplist, postbacks.test_text_with_chiplist);
  var r2 = ssbot.newReply(simpletext.test_file_with_chiplist, postbacks.test_file_with_chiplist);
  var r3 = ssbot.newReply(simpletext.test_richcard_with_chiplist, postbacks.test_richcard_with_chiplist);
  var r4 = ssbot.newReply(simpletext.test_chiplist_learn, postbacks.test_chiplist_learn);
  
  var suggestions = ssbot.newSuggestions(r1, r2, r3, r4);
  reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);

  ssbot.reply(message, reply, onResponse);
}

var handle_reply_select_message_type_with_chiplist = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);
  ssbot.typing(message.messageContact, "active", onResponse);

  var pb = message.RCSMessage.suggestedResponse.response.reply.postback.data;
  var dt = message.RCSMessage.suggestedResponse.response.reply.displayText;
  var type = "?type=" + dt; 
  
  var reply, suggestions;
  if (pb == postbacks.test_chiplist_learn) {
    reply = ssbot.newTextMessage(simpletext.chip_list_basic);
    var r1 = ssbot.newReply(simpletext.test_chiplist_back, postbacks.test_chiplist_back);
    suggestions = ssbot.newSuggestions(r1);
  } else {
    if (dt == simpletext.test_text_with_chiplist) {
      reply = ssbot.newTextMessage(simpletext.what_action_type_chiplist);
    } else if (dt == simpletext.test_file_with_chiplist) {
      reply = ssbot.newFileMessageByObject(files.image_coco);
    } else if (dt == simpletext.test_richcard_with_chiplist) {
      var layout, content, media, title, description;
      layout = layouts.general_vertical;
      title = "Rich Card Test";  
      cardmedias = JSON.parse(fs.readFileSync("res/json/cardmedias.json"));
      description = simpletext.normal_richcard;
      media = cardmedias.image_coco_medium;
      content = ssbot.newGeneralRichCardContent(media, title, description);    
      reply = ssbot.newGeneralRichCard(layout, content);
    }
    var r1 = ssbot.newReply(simpletext.test_url_action, postbacks.test_url_action+type);
    var r2 = ssbot.newReply(simpletext.test_dialer_action, postbacks.test_dialer_action+type);
    var r3 = ssbot.newReply(simpletext.test_map_action, postbacks.test_map_action+type);
    var r4 = ssbot.newReply(simpletext.test_calendar_action, postbacks.test_calendar_action+type);
    var r5 = ssbot.newReply(simpletext.test_compose_action, postbacks.test_compose_action+type);
    var r6 = ssbot.newReply(simpletext.test_device_action, postbacks.test_device_action+type);
    var r7 = ssbot.newReply(simpletext.test_settings_action, postbacks.test_settings_action+type);
    suggestions = ssbot.newSuggestions(r1, r2, r3, r4, r5, r6, r7);
  }
  reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);

  ssbot.reply(message, reply, onResponse);
}

var handle_reply_select_action_type_chiplist = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);
  ssbot.typing(message.messageContact, "active", onResponse);
  
  var pb = message.RCSMessage.suggestedResponse.response.reply.postback.data;  
  if (pb == postbacks.test_chiplist_back) {
    handle_reply_chiplist_10776(message);
    return;
  }
  
  var type = pb.substring(pb.indexOf("=") + 1);
  pb = pb.substring(0, pb.indexOf("?"));

  var reply;
  if (type == simpletext.test_text_with_chiplist) {
    if (pb == postbacks.test_url_action) {
      reply = ssbot.newTextMessage(simpletext.test_text_with_url_action_in_chiplist);
    } else if (pb == postbacks.test_dialer_action) {
      reply = ssbot.newTextMessage(simpletext.test_text_with_dialer_action_in_chiplist);
    } else if (pb == postbacks.test_map_action) {
      reply = ssbot.newTextMessage(simpletext.test_text_with_map_action_in_chiplist);
    } else if (pb == postbacks.test_calendar_action) {
      reply = ssbot.newTextMessage(simpletext.test_text_with_calendar_action_in_chiplist);
    } else if (pb == postbacks.test_compose_action) {
      reply = ssbot.newTextMessage(simpletext.test_text_with_compose_action_in_chiplist);
    } else if (pb == postbacks.test_device_action) {
      reply = ssbot.newTextMessage(simpletext.test_text_with_device_action_in_chiplist);
    } else if (pb == postbacks.test_settings_action) {
      reply = ssbot.newTextMessage(simpletext.test_text_with_settings_action_in_chiplist);
    } else {
      reply = ssbot.newTextMessage(simpletext.test_chiplist_10776_with_text);
    }
  } else if (type == simpletext.test_file_with_chiplist) {
    reply = ssbot.newFileMessageByObject(files.image_coco);
  } else if (type == simpletext.test_richcard_with_chiplist) {
    var layout, content, media, title, description;
    layout = layouts.general_vertical;
    title = "Suggested Chip List Test";  
    cardmedias = JSON.parse(fs.readFileSync("res/json/cardmedias.json"));
    description = simpletext.normal_richcard;
    media = cardmedias.image_coco_medium;
    content = ssbot.newGeneralRichCardContent(media, title, description);    
    reply = ssbot.newGeneralRichCard(layout, content);
  }

  if (pb == postbacks.test_url_action) {    
    var r1 = chips.open_url;
    var suggestions = ssbot.newSuggestions(r1);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  } else if (pb == postbacks.test_dialer_action) {
    var r1 = chips.dial_PhoneNumber;
    var r2 = chips.dial_EnrichedCall;
    var r3 = chips.dial_VideoCall;
    var suggestions = ssbot.newSuggestions(r1, r2, r3);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  } else if (pb == postbacks.test_map_action) {
    var r1 = chips.show_Location;
    var r2 = chips.show_Location_with_Query;
    var r3 = chips.request_Location_Push;
    var suggestions = ssbot.newSuggestions(r1, r2, r3);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  } else if (pb == postbacks.test_calendar_action) {
    var r1 = chips.create_Calendar_Event;
    var suggestions = ssbot.newSuggestions(r1);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  } else if (pb == postbacks.test_compose_action) {
    var r1 = chips.compose_Text_Message;
    var r2 = chips.compose_Recording_Video_Message;
    var r3 = chips.compose_Recording_Audio_Message;
    var suggestions = ssbot.newSuggestions(r1, r2, r3);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  } else if (pb == postbacks.test_device_action) {
    var r1 = chips.request_Device_Specifics;
    var suggestions = ssbot.newSuggestions(r1);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  } else if (pb == postbacks.test_settings_action) {
    var r1 = chips.disable_Anonymization;
    var r2 = chips.enable_Displayed_Notifications;
    var suggestions = ssbot.newSuggestions(r1, r2);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  } 

  ssbot.reply(message, reply, onResponse);
  
}

var handle_reply_carousel_10776 = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);
  ssbot.typing(message.messageContact, "active", onResponse);

  var reply = ssbot.newTextMessage(simpletext.what_to_test);
  var r1 = ssbot.newReply(simpletext.test_carousel_full, postbacks.test_carousel_full);
  var r2 = ssbot.newReply(simpletext.test_carousel_learn, postbacks.test_carousel_learn);
  
  var suggestions = ssbot.newSuggestions(r1, r2);
  reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);

  ssbot.reply(message, reply, onResponse);
}

var handle_reply_select_test_full_carousel = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);
  ssbot.typing(message.messageContact, "active", onResponse);

  var pb = message.RCSMessage.suggestedResponse.response.reply.postback.data;
  var dt = message.RCSMessage.suggestedResponse.response.reply.displayText;  
  
  var reply, suggestions;
  if (pb == postbacks.test_carousel_learn) {
    reply = ssbot.newTextMessage(simpletext.carousel_basic);
    var r1 = ssbot.newReply(simpletext.test_carousel_back, postbacks.test_carousel_back);
    suggestions = ssbot.newSuggestions(r1);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  } else if (pb == postbacks.test_carousel_back) {
    handle_reply_carousel_10776(message);
    return;
  } else if (pb == postbacks.test_carousel_full) {        
    reply = ssbot.newTextMessage(simpletext.test_carousel_send_full);
    ssbot.reply(message, reply, onResponse);

    cardmedias = JSON.parse(fs.readFileSync("res/json/cardmedias.json"));  
    
    var m1 = cardmedias.image_coco_medium;  
    var m2 = cardmedias.audio_coco_medium;
    var m3 = cardmedias.video_coco_medium;      
    var m4 = cardmedias.gif_coco_medium;

    var t1 = simpletext.test_url_action;
    var t2 = simpletext.test_dialer_action;
    var t3 = simpletext.test_map_action;
    var t4 = simpletext.test_calendar_action;
    var t5 = simpletext.test_compose_action;
    var t6 = simpletext.test_device_action;
    var t7 = simpletext.test_settings_action;
    var t8 = "Carousel Test";
    
    var d1 = simpletext.test_carousel_card_url;
    var d2 = simpletext.test_carousel_card_dialer;
    var d3 = simpletext.test_carousel_card_map;
    var d4 = simpletext.test_carousel_card_calendar;
    var d5 = simpletext.test_carousel_card_compose;
    var d6 = simpletext.test_carousel_card_device;
    var d7 = simpletext.test_carousel_card_settings;
    var d8 = simpletext.test_carousel_card_none;
    
    var r1 = chips.start_over;
    var r2 = ssbot.newReply(simpletext.test_carousel_learn, postbacks.test_carousel_learn);

    var a11 = chips.open_url;
    
    var a21 = chips.dial_PhoneNumber;
    var a22 = chips.dial_EnrichedCall;
    var a23 = chips.dial_VideoCall;
    
    var a31 = chips.show_Location;
    var a32 = chips.show_Location_with_Query;
    var a33 = chips.request_Location_Push;
    
    var a41 = chips.create_Calendar_Event;
    
    var a51 = chips.compose_Text_Message;
    var a52 = chips.compose_Recording_Video_Message;
    var a53 = chips.compose_Recording_Audio_Message;
    
    var a61 = chips.request_Device_Specifics;
    
    var a71 = chips.disable_Anonymization;
    var a72 = chips.enable_Displayed_Notifications;

    var s1 = ssbot.newSuggestions(r1, r2, a11);
    var s2 = ssbot.newSuggestions(r1, r2, a21, a22, a23);
    var s3 = ssbot.newSuggestions(r1, r2, a31, a32, a33);
    var s4 = ssbot.newSuggestions(r1, r2, a41);
    var s5 = ssbot.newSuggestions(r1, r2, a51, a52, a53);
    var s6 = ssbot.newSuggestions(r1, r2, a61);
    var s7 = ssbot.newSuggestions(r1, r2, a71, a72);
    var s8 = ssbot.newSuggestions(r1, r2);

    var c1 = ssbot.newGeneralRichCardContent(m1, t1, d1, s1);    
    var c2 = ssbot.newGeneralRichCardContent(m2, t2, d2, s2);
    var c3 = ssbot.newGeneralRichCardContent(m3, t3, d3, s3);
    var c4 = ssbot.newGeneralRichCardContent(m4, t4, d4, s4);
    var c5 = ssbot.newGeneralRichCardContent(m1, t5, d5, s5);
    var c6 = ssbot.newGeneralRichCardContent(m2, t6, d6, s6);
    var c7 = ssbot.newGeneralRichCardContent(m3, t7, d7, s7);
    var c8 = ssbot.newGeneralRichCardContent(m4, t8, d8, s8);

    var content = ssbot.newGeneralCarouselContent(c1, c2, c3, c4, c5, c6, c7, c8);
    var layout = layouts.general_medium_width;
    reply = ssbot.newGeneralCarousel(layout, content);

    var suggestions = ssbot.newSuggestions(r1, r2, a11, a21, a31, a33, a41, a51, a52, a61, a72);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  }

  ssbot.reply(message, reply, onResponse);

}

var handle_response_device_specifics = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);
  ssbot.typing(message.messageContact, "active", onResponse);

  var reply = ssbot.newTextMessage("I received this: " + JSON.stringify(message.RCSMessage.sharedData));

  ssbot.reply(message, reply, onResponse);
}

var handle_reply_richcard_adv = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);  

  var reply = ssbot.newTextMessage(simpletext.what_feature_richcard);
  
  var r1 = ssbot.newReply(simpletext.test_richcard_content, postbacks.test_richcard_content);
  var r2 = ssbot.newReply(simpletext.test_richcard_layout, postbacks.test_richcard_layout);
  var r3 = ssbot.newReply(simpletext.test_richcard_media, postbacks.test_richcard_media);
  var r4 = ssbot.newReply(simpletext.test_richcard_wrap, postbacks.test_richcard_wrap);
  var r5 = ssbot.newReply(simpletext.test_richcard_reply_action, postbacks.test_richcard_reply_action);
  var r6 = ssbot.newReply(simpletext.test_richcard_orientation, postbacks.test_richcard_orientation);
  
  var suggestions = ssbot.newSuggestions(r1, r2, r3, r4, r5, r6);
  reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);

  ssbot.reply(message, reply, onResponse);
}

var handle_reply_richcard_reply_action = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);  
  
  var r0 = ssbot.newReply(simpletext.test_richcard_adv, postbacks.test_richcard_adv);
  var r1 = ssbot.newReply(simpletext.test_richcard_reply_action, postbacks.test_richcard_reply_action);
  var r2 = ssbot.newReply(simpletext.test_richcard_reply_action_order, postbacks.test_richcard_reply_action_order);  
  var r3 = ssbot.newReply(simpletext.test_richcard_reply_action_char, postbacks.test_richcard_reply_action_char); 
  var r4 = ssbot.newReply(simpletext.test_richcard_reply_action_11, postbacks.test_richcard_reply_action_11);  
  var r5 = ssbot.newReply(simpletext.reply_action_char_26, postbacks.test_richcard_reply_action);

  var a1 = chips.open_url;

  var reply, layout, content, media, title, description, suggestions;
  var pb = message.RCSMessage.suggestedResponse.response.reply.postback.data;

  if (pb == postbacks.test_richcard_reply_action) {
    reply = ssbot.newTextMessage(simpletext.what_to_test);
        
    suggestions = ssbot.newSuggestions(r2, r3, r4, r1);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);    
  } else {
      if (pb == postbacks.test_richcard_reply_action_order) {
        reply = ssbot.newTextMessage(simpletext.reply_action_order);
        ssbot.reply(message, reply, onResponse);

        cardmedias = JSON.parse(fs.readFileSync("res/json/cardmedias.json"));
        media = cardmedias.image_coco_medium;
        title = simpletext.test_richcard_reply_action_order;  
        description = simpletext.reply_action_order_issue;    
        suggestions = ssbot.newSuggestions(a1, r1);
        
        layout = layouts.general_vertical;

        content = ssbot.newGeneralRichCardContent(media, title, description, suggestions);    
        reply = ssbot.newGeneralRichCard(layout, content);
        
        reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
      } else if (pb == postbacks.test_richcard_reply_action_char) {
        reply = ssbot.newTextMessage(simpletext.reply_action_char);
        ssbot.reply(message, reply, onResponse);

        cardmedias = JSON.parse(fs.readFileSync("res/json/cardmedias.json"));
        media = cardmedias.image_coco_medium;
        title = simpletext.test_richcard_reply_action_char;  
        description = simpletext.reply_action_char_issue;    
        suggestions = ssbot.newSuggestions(r5, r1);
        
        layout = layouts.general_vertical;

        content = ssbot.newGeneralRichCardContent(media, title, description, suggestions);    
        reply = ssbot.newGeneralRichCard(layout, content);
        
        reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
      } else if (pb == postbacks.test_richcard_reply_action_11) {
        reply = ssbot.newTextMessage(simpletext.reply_action_11);
        ssbot.reply(message, reply, onResponse);

        title = simpletext.test_richcard_reply_action_11;  
        var s1 = ssbot.newReply("1", postbacks.test_richcard_reply_action);
        var s2 = ssbot.newReply("2", postbacks.test_richcard_reply_action);
        var s3 = ssbot.newReply("3", postbacks.test_richcard_reply_action);
        var s4 = ssbot.newReply("4", postbacks.test_richcard_reply_action);
        var s5 = ssbot.newReply("5", postbacks.test_richcard_reply_action);
        var s6 = ssbot.newReply("6", postbacks.test_richcard_reply_action);
        var s7 = ssbot.newReply("7", postbacks.test_richcard_reply_action);
        var s8 = ssbot.newReply("8", postbacks.test_richcard_reply_action);
        var s9 = ssbot.newReply("9", postbacks.test_richcard_reply_action);
        var s10 = ssbot.newReply("10", postbacks.test_richcard_reply_action);
        var s11 = ssbot.newReply("11", postbacks.test_richcard_reply_action);
        var s12 = ssbot.newReply("12", postbacks.test_richcard_reply_action);

        suggestions = ssbot.newSuggestions(s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12);
        
        layout = layouts.general_vertical;

        content = ssbot.newGeneralRichCardContent(media, title, description, suggestions);    
        reply = ssbot.newGeneralRichCard(layout, content);

        reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
      } 
  }  
  

  ssbot.reply(message, reply, onResponse);
}

var handle_reply_richcard_orientation = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);  
  
  var r1 = ssbot.newReply(simpletext.test_richcard_orientation_left, postbacks.test_richcard_orientation_left); 
  var r2 = ssbot.newReply(simpletext.test_richcard_orientation_right, postbacks.test_richcard_orientation_right); 
  var r3 = ssbot.newReply(simpletext.test_richcard_orientation_vertical, postbacks.test_richcard_orientation_vertical); 
  var r4 = ssbot.newReply(simpletext.test_richcard_orientation, postbacks.test_richcard_orientation); 

  var reply, layout, content, media, title, description, suggestions;
  var pb = message.RCSMessage.suggestedResponse.response.reply.postback.data;
  if (pb == postbacks.test_richcard_orientation) {
    reply = ssbot.newTextMessage(simpletext.richcard_orientation);
        
    suggestions = ssbot.newSuggestions(r1, r2, r3);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);    
  } else {
    if (pb == postbacks.test_richcard_orientation_vertical) {
      title = simpletext.test_richcard_orientation_vertical;
      layout = layouts.general_vertical;
    } else if (pb == postbacks.test_richcard_orientation_left) {
      title = simpletext.test_richcard_orientation_left;
      layout = layouts.general_horizontal_left;
    } else if (pb == postbacks.test_richcard_orientation_right) {
      title = simpletext.test_richcard_orientation_right;
      layout = layouts.general_horizontal_right;
    } 

      
    cardmedias = JSON.parse(fs.readFileSync("res/json/cardmedias.json"));
    media = cardmedias.image_coco_medium;
    description = simpletext.richcard_orientation_issue;  
    
    suggestions = ssbot.newSuggestions(r4);
  
    content = ssbot.newGeneralRichCardContent(media, title, description, suggestions);    
    reply = ssbot.newGeneralRichCard(layout, content);
    
    suggestions = ssbot.newSuggestions(r1, r2, r3, r4);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  }  

  ssbot.reply(message, reply, onResponse);  
}
/*
var handle_reply_richcard_content = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);  
  
  var r1 = ssbot.newReply(simpletext.test_richcard_content_title, postbacks.test_richcard_content_title); 
  var r2 = ssbot.newReply(simpletext.test_richcard_content_description, postbacks.test_richcard_content_description); 
  var r3 = ssbot.newReply(simpletext.test_richcard_content_image, postbacks.test_richcard_content_image);  
  var r4 = ssbot.newReply(simpletext.test_richcard_content_video, postbacks.test_richcard_content_video); 
  var r5 = ssbot.newReply(simpletext.test_richcard_content_audio, postbacks.test_richcard_content_audio); 
  var r6 = ssbot.newReply(simpletext.test_richcard_content_reply_action, postbacks.test_richcard_content_reply_action); 
  var r7 = ssbot.newReply(simpletext.test_richcard_content_title_description, postbacks.test_richcard_content_title_description); 
  var r8 = ssbot.newReply(simpletext.test_richcard_content_media_title, postbacks.test_richcard_content_media_title); 
  var r9 = ssbot.newReply(simpletext.test_richcard_content_media_description, postbacks.test_richcard_content_media_description); 
  var r10 = ssbot.newReply(simpletext.test_richcard_content_title_reply, postbacks.test_richcard_content_title_reply); 
  var r11 = ssbot.newReply(simpletext.test_richcard_content_description_reply, postbacks.test_richcard_content_description_reply); 
  
  var r0 = ssbot.newReply(simpletext.test_richcard_content, postbacks.test_richcard_content); 
  //var c = ssbot.newReply(simpletext.test_richcard_content_gif, postbacks.test_richcard_content_gif);

  var reply, layout, content, media, title, description, suggestions;
  var pb = message.RCSMessage.suggestedResponse.response.reply.postback.data;
  if (pb == postbacks.test_richcard_content) {
    reply = ssbot.newTextMessage(simpletext.richcard_content);
        
    suggestions = ssbot.newSuggestions(r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);    
  } else {
    if (pb == postbacks.test_richcard_content_title) {
      title = simpletext.test_richcard_content_title;
    } else if (pb == postbacks.test_richcard_content_description) {
      description = simpletext.richcard_content_issue;
    } else if (pb == postbacks.test_richcard_content_image) {
      cardmedias = JSON.parse(fs.readFileSync("res/json/cardmedias.json"));
      media = cardmedias.image_coco_medium;      
    } else if (pb == postbacks.test_richcard_content_gif) {
      cardmedias = JSON.parse(fs.readFileSync("res/json/cardmedias.json"));
      media = cardmedias.gif_coco_medium;      
    } else if (pb == postbacks.test_richcard_content_video) {
      cardmedias = JSON.parse(fs.readFileSync("res/json/cardmedias.json"));
      media = cardmedias.video_coco_medium;      
    } else if (pb == postbacks.test_richcard_content_audio) {
      cardmedias = JSON.parse(fs.readFileSync("res/json/cardmedias.json"));
      media = cardmedias.audio_coco_medium;      
    } else if (pb == postbacks.test_richcard_content_reply_action) {
      reply = ssbot.newTextMessage(simpletext.richcard_content_issue_reply_action);
      ssbot.reply(message, reply, onResponse);
      suggestions = ssbot.newSuggestions(r0);      
    } else if (pb == postbacks.test_richcard_content_title_description) {
      title = simpletext.test_richcard_content_title_description;
      description = simpletext.richcard_content_issue;      
    } else if (pb == postbacks.test_richcard_content_media_title) {
      title = simpletext.test_richcard_content_title_description;
      cardmedias = JSON.parse(fs.readFileSync("res/json/cardmedias.json"));
      media = cardmedias.image_coco_medium;      
    } else if (pb == postbacks.test_richcard_content_media_description) {
      description = simpletext.richcard_content_issue;
      cardmedias = JSON.parse(fs.readFileSync("res/json/cardmedias.json"));
      media = cardmedias.image_coco_medium;      
    } else if (pb == postbacks.test_richcard_content_title_reply) {
      title = simpletext.test_richcard_content_title_description;
      suggestions = ssbot.newSuggestions(r0);      
    } else if (pb == postbacks.test_richcard_content_description_reply) {
      description = simpletext.richcard_content_issue;
      suggestions = ssbot.newSuggestions(r0);      
    } 


    layout = layouts.general_vertical;      
    content = ssbot.newGeneralRichCardContent(media, title, description, suggestions);    
    reply = ssbot.newGeneralRichCard(layout, content);
    
    suggestions = ssbot.newSuggestions(r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  }  

  ssbot.reply(message, reply, onResponse);  
}
*/
/*
var handle_reply_richcard_layout = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);  
  
  var r0 = ssbot.newReply(simpletext.test_richcard_adv, postbacks.test_richcard_adv);
  var r1 = ssbot.newReply(simpletext.test_richcard_layout_width, postbacks.test_richcard_layout_width);  
  var r2 = ssbot.newReply(simpletext.test_richcard_layout_height_min, postbacks.test_richcard_layout_height_min);
  var r3 = ssbot.newReply(simpletext.test_richcard_layout_height_max, postbacks.test_richcard_layout_height_max);
  var r4 = ssbot.newReply(simpletext.test_richcard_layout_height_description, postbacks.test_richcard_layout_height_description);
  var r5 = ssbot.newReply(simpletext.test_richcard_layout_height_title, postbacks.test_richcard_layout_height_title);
  var r6 = ssbot.newReply(simpletext.test_richcard_layout_height_action, postbacks.test_richcard_layout_height_action);
  var r7 = ssbot.newReply(simpletext.test_richcard_layout_height_reply, postbacks.test_richcard_layout_height_reply);
  var r8 = ssbot.newReply(simpletext.test_richcard_layout_height, postbacks.test_richcard_layout_height);  

  var reply, layout, content, media, title, description, suggestions;
  cardmedias = JSON.parse(fs.readFileSync("res/json/cardmedias.json"));

  var pb = message.RCSMessage.suggestedResponse.response.reply.postback.data;
  if (pb == postbacks.test_richcard_layout) {
    reply = ssbot.newTextMessage(simpletext.what_to_test);
        
    suggestions = ssbot.newSuggestions(r1, r8);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);    
  } else if (pb == postbacks.test_richcard_layout_height) {
    reply = ssbot.newTextMessage(simpletext.what_height_richcard);
        
    suggestions = ssbot.newSuggestions(r2, r3);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);    
  } else if (pb == postbacks.test_richcard_layout_height_max) {
    reply = ssbot.newTextMessage(simpletext.what_height_case_richcard);
        
    suggestions = ssbot.newSuggestions(r4, r5, r6, r7);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);    
  } else {
    if (pb == postbacks.test_richcard_layout_width) {
      reply = ssbot.newTextMessage(simpletext.test_richcard_layout_width_issue);
      ssbot.reply(message, reply, onResponse);

      title = simpletext.test_richcard_layout_width;
      description = simpletext.test_richcard_layout_width_issue;
      media = cardmedias.video_coco_medium;
      suggestions = ssbot.newSuggestions(chips.keyline);
    } else if (pb == postbacks.test_richcard_layout_height_min) {
      reply = ssbot.newTextMessage(simpletext.test_richcard_layout_height_min_issue);
      ssbot.reply(message, reply, onResponse);

      title = simpletext.test_richcard_layout_height_min;
      description = simpletext.short_description_richcard;            
    } else if (pb == postbacks.test_richcard_layout_height_description) {
      reply = ssbot.newTextMessage(simpletext.test_richcard_layout_height_max_issue + simpletext.sending_long_description);
      ssbot.reply(message, reply, onResponse);

      title = simpletext.test_richcard_layout_height_description;
      description = simpletext.test_richcard_layout_height_max_issue;
      media = cardmedias.video_coco_medium;
      suggestions = ssbot.newSuggestions(r4, r5, r6, r7);
    } else if (pb == postbacks.test_richcard_layout_height_title) {
      reply = ssbot.newTextMessage(simpletext.test_richcard_layout_height_max_issue + simpletext.sending_long_title);
      ssbot.reply(message, reply, onResponse);

      title = simpletext.long_title_richcard;
      description = simpletext.test_richcard_layout_height_title;
      media = cardmedias.video_coco_medium;
      suggestions = ssbot.newSuggestions(r4, r5, r6, r7);
    } else if (pb == postbacks.test_richcard_layout_height_action) {
      reply = ssbot.newTextMessage(simpletext.test_richcard_layout_height_max_issue + simpletext.sending_long_action);
      ssbot.reply(message, reply, onResponse);

      title = simpletext.test_richcard_layout_height_action;
      description = simpletext.test_richcard_layout_height_action;
      media = cardmedias.video_coco_medium;
      suggestions = ssbot.newSuggestions(r8, chips.keyline, chips.keyline, chips.keyline, chips.keyline, chips.keyline, chips.keyline, chips.keyline, chips.keyline, chips.keyline, chips.keyline);
    } else if (pb == postbacks.test_richcard_layout_height_reply) {
      reply = ssbot.newTextMessage(simpletext.test_richcard_layout_height_max_issue + simpletext.sending_long_reply);
      ssbot.reply(message, reply, onResponse);

      title = simpletext.test_richcard_layout_height_reply;
      description = simpletext.test_richcard_layout_height_reply;
      media = cardmedias.video_coco_medium;
      suggestions = ssbot.newSuggestions(r0, r1, r2, r3, r4, r5, r6, r7, r8, r0, chips.keyline);
    } 


    layout = layouts.general_vertical;      
    content = ssbot.newGeneralRichCardContent(media, title, description, suggestions);    
    reply = ssbot.newGeneralRichCard(layout, content);
    
    suggestions = ssbot.newSuggestions(r1, r8, r0);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  }  

  ssbot.reply(message, reply, onResponse);  
}
*/
var handle_reply_richcard_media = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);  
  
  var r0 = ssbot.newReply(simpletext.test_richcard_adv, postbacks.test_richcard_adv);
  var r10 = ssbot.newReply(simpletext.test_richcard_media, postbacks.test_richcard_media);
  var r1 = ssbot.newReply(simpletext.test_richcard_media_edge, postbacks.test_richcard_media_edge);
  var r2 = ssbot.newReply(simpletext.test_richcard_media_edge_image, postbacks.test_richcard_media_edge_image);
  var r3 = ssbot.newReply(simpletext.test_richcard_media_edge_gif, postbacks.test_richcard_media_edge_gif);
  var r4 = ssbot.newReply(simpletext.test_richcard_media_edge_video, postbacks.test_richcard_media_edge_video);
  var r5 = ssbot.newReply(simpletext.test_richcard_media_edge_audio, postbacks.test_richcard_media_edge_audio);
  var r6 = ssbot.newReply(simpletext.test_richcard_media_height, postbacks.test_richcard_media_height);
  var r7 = ssbot.newReply(simpletext.test_richcard_media_height_short, postbacks.test_richcard_media_height_short);
  var r8 = ssbot.newReply(simpletext.test_richcard_media_height_mid, postbacks.test_richcard_media_height_mid);
  var r9 = ssbot.newReply(simpletext.test_richcard_media_height_tall, postbacks.test_richcard_media_height_tall);
  
  var reply, layout, content, media, title, description, suggestions;
  cardmedias = JSON.parse(fs.readFileSync("res/json/cardmedias.json"));

  var pb = message.RCSMessage.suggestedResponse.response.reply.postback.data;
  if (pb == postbacks.test_richcard_media) {
    reply = ssbot.newTextMessage(simpletext.what_to_test);
        
    suggestions = ssbot.newSuggestions(r1, r6);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);    
  } else if (pb == postbacks.test_richcard_media_edge) {
    reply = ssbot.newTextMessage(simpletext.test_richcard_media_edge_issue);
    
    suggestions = ssbot.newSuggestions(r2, r3, r4, r5, r10, r0);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);    
  } else if (pb == postbacks.test_richcard_media_height) {
    reply = ssbot.newTextMessage(simpletext.test_richcard_media_height_issue);
    
    suggestions = ssbot.newSuggestions(r7, r8, r9, r1, r10, r0);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);    
  } else {
    if (pb == postbacks.test_richcard_media_edge_image) {
      media = cardmedias.image_coco_medium;
    } else if (pb == postbacks.test_richcard_media_edge_gif) {
      media = cardmedias.gif_coco_medium;
    } else if (pb == postbacks.test_richcard_media_edge_video) {
      media = cardmedias.video_coco_medium;
    } else if (pb == postbacks.test_richcard_media_edge_audio) {
      media = cardmedias.audio_coco_medium;
    } else if (pb == postbacks.test_richcard_media_height_short) {
      media = cardmedias.image_coco_medium;
      media.height = ssbot.MEDIA_HEIGHT_SHORT_HEIGHT;
    } else if (pb == postbacks.test_richcard_media_height_mid) {
      media = cardmedias.image_coco_medium;
      media.height = ssbot.MEDIA_HEIGHT_MEDIUM_HEIGHT;
    } else if (pb == postbacks.test_richcard_media_height_tall) {
      media = cardmedias.image_coco_medium;
      media.height = ssbot.MEDIA_HEIGHT_TALL_HEIGHT;
    }     
  
    layout = layouts.general_vertical;
    content = ssbot.newGeneralRichCardContent(media, title, description, suggestions);    
    reply = ssbot.newGeneralRichCard(layout, content);
    
    suggestions = ssbot.newSuggestions(r1, r6, r0);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  }  

  ssbot.reply(message, reply, onResponse);  
}

var handle_reply_richcard_wrap = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);  
  
  var r0 = ssbot.newReply(simpletext.test_richcard_adv, postbacks.test_richcard_adv);
  var r1 = ssbot.newReply(simpletext.test_richcard_wrap, postbacks.test_richcard_wrap); 
  var r2 = ssbot.newReply(simpletext.test_richcard_wrap_title, postbacks.test_richcard_wrap_title); 
  var r3 = ssbot.newReply(simpletext.test_richcard_wrap_desc, postbacks.test_richcard_wrap_desc); 
  var r4 = ssbot.newReply(simpletext.test_richcard_wrap_title_desc, postbacks.test_richcard_wrap_title_desc); 

  var reply, layout, content, media, title, description, suggestions;
  var pb = message.RCSMessage.suggestedResponse.response.reply.postback.data;

  if (pb == postbacks.test_richcard_wrap) {
    reply = ssbot.newTextMessage(simpletext.what_to_test);
        
    suggestions = ssbot.newSuggestions(r2, r3, r4);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);    
  } else {
    if (pb == postbacks.test_richcard_wrap_title) {
      reply = ssbot.newTextMessage(simpletext.test_richcard_wrap_title_issue);
      ssbot.reply(message, reply, onResponse);

      title = simpletext.long_title_richcard;
    } else if (pb == postbacks.test_richcard_wrap_desc) {
      reply = ssbot.newTextMessage(simpletext.test_richcard_wrap_desc_issue);
      ssbot.reply(message, reply, onResponse);

      description = simpletext.long_desc_richcard;
    } else if (pb == postbacks.test_richcard_wrap_title_desc) {
      reply = ssbot.newTextMessage(simpletext.test_richcard_wrap_title_desc_issue );
      ssbot.reply(message, reply, onResponse);
      
      title = simpletext.long_title_richcard;
      description = simpletext.long_desc_richcard;
    } 

    layout = layouts.general_vertical;  
    cardmedias = JSON.parse(fs.readFileSync("res/json/cardmedias.json"));
  
    content = ssbot.newGeneralRichCardContent(media, title, description, suggestions);    
    reply = ssbot.newGeneralRichCard(layout, content);
    
    suggestions = ssbot.newSuggestions(r2, r3, r4, r0);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  }  

  ssbot.reply(message, reply, onResponse);  
}

var handle_reply_carousel_adv = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);  

  var reply = ssbot.newTextMessage(simpletext.what_feature_carousel);
  
  var r1 = ssbot.newReply(simpletext.test_carousel_layout, postbacks.test_carousel_layout);
  var r2 = ssbot.newReply(simpletext.test_carousel_media, postbacks.test_carousel_media);
  var r3 = ssbot.newReply(simpletext.test_carousel_display, postbacks.test_carousel_display);
  
  
  var suggestions = ssbot.newSuggestions(r1, r2, r3);
  reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);

  ssbot.reply(message, reply, onResponse);
}

var handle_reply_carousel_layout = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);  
  var pb = message.RCSMessage.suggestedResponse.response.reply.postback.data;

  var reply, layout, content, media, title, description, suggestions, content;
  cardmedias = JSON.parse(fs.readFileSync("res/json/cardmedias.json"));

  var m1 = cardmedias.image_coco_medium;  
  var m2 = cardmedias.audio_coco_medium;
  var m3 = cardmedias.video_coco_medium;      

  var t1 = simpletext.test_url_action;
  var t2 = simpletext.test_dialer_action;
  var t3 = simpletext.test_map_action;
  var t4 = simpletext.long_title_richcard;

  var d1 = simpletext.test_carousel_card_url;
  var d2 = simpletext.test_carousel_card_dialer;
  var d3 = simpletext.test_carousel_card_map;
  var d4 = simpletext.test_carousel_layout_height_issue_max_small;

  var r0 = ssbot.newReply(simpletext.test_carousel_adv, postbacks.test_carousel_adv);
  var r1 = ssbot.newReply(simpletext.test_carousel_layout, postbacks.test_carousel_layout);
  var r2 = ssbot.newReply(simpletext.test_carousel_layout_width, postbacks.test_carousel_layout_width);
  var r3 = ssbot.newReply(simpletext.test_carousel_layout_width_small, postbacks.test_carousel_layout_width_small);
  var r4 = ssbot.newReply(simpletext.test_carousel_layout_width_mid, postbacks.test_carousel_layout_width_mid);
  var r5 = ssbot.newReply(simpletext.test_carousel_layout_height, postbacks.test_carousel_layout_height);
  var r6 = ssbot.newReply(simpletext.test_carousel_layout_height_min_small, postbacks.test_carousel_layout_height_min_small);
  var r7 = ssbot.newReply(simpletext.test_carousel_layout_height_min_mid, postbacks.test_carousel_layout_height_min_mid);
  var r8 = ssbot.newReply(simpletext.test_carousel_layout_height_max_small, postbacks.test_carousel_layout_height_max_small);
  var r9 = ssbot.newReply(simpletext.test_carousel_layout_height_max_mid, postbacks.test_carousel_layout_height_max_mid);
  
  var s1 = ssbot.newSuggestions(r1 , r3, r4);
  var s2 = ssbot.newSuggestions(r0 , r1, r2, r3, r4, r5, r6, r7, r8, r9);

  var c1 = ssbot.newGeneralRichCardContent(m1, t1, d1, s1);    
  var c2 = ssbot.newGeneralRichCardContent(m2, t2, d2, s1);
  var c3 = ssbot.newGeneralRichCardContent(m3, t3, d3, s1);
  var c4 = ssbot.newGeneralRichCardContent(null, simpletext.test_carousel_layout_height_min_small, simpletext.test_carousel_layout_height_min_small, null);
  var c5 = ssbot.newGeneralRichCardContent(m1, t4, d4, s2);

  var l1 = layouts.general_small_width;
  var l2 = layouts.general_medium_width;

  if (pb == postbacks.test_carousel_layout) {
    reply = ssbot.newTextMessage(simpletext.what_to_test);
        
    suggestions = ssbot.newSuggestions(r2, r5, r0);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);    
  } else if (pb == postbacks.test_carousel_layout_width) {
    reply = ssbot.newTextMessage(simpletext.what_width_carousel);
    
    suggestions = ssbot.newSuggestions(r3, r4);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);    
  } else if (pb == postbacks.test_carousel_layout_width_small) {
    reply = ssbot.newTextMessage(simpletext.test_carousel_layout_width_issue);
    ssbot.reply(message, reply, onResponse);  

    content = ssbot.newGeneralCarouselContent(c1, c2, c3);    
    reply = ssbot.newGeneralCarousel(l1, content);

    suggestions = ssbot.newSuggestions(r3, r4, r1);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  } else if (pb == postbacks.test_carousel_layout_width_mid) {
    reply = ssbot.newTextMessage(simpletext.test_carousel_layout_width_issue);
    ssbot.reply(message, reply, onResponse);  

    content = ssbot.newGeneralCarouselContent(c1, c2, c3);    
    reply = ssbot.newGeneralCarousel(l2, content);

    suggestions = ssbot.newSuggestions(r3, r4, r1);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  } else if (pb == postbacks.test_carousel_layout_height) {
    reply = ssbot.newTextMessage(simpletext.what_height_carousel);
    
    suggestions = ssbot.newSuggestions(r6, r7, r8, r9);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);    
  } else if (pb == postbacks.test_carousel_layout_height_min_small) {
    reply = ssbot.newTextMessage(simpletext.test_carousel_layout_height_issue_min);
    ssbot.reply(message, reply, onResponse);  

    content = ssbot.newGeneralCarouselContent(c4, c4, c4);    
    reply = ssbot.newGeneralCarousel(l1, content);

    suggestions = ssbot.newSuggestions(r6, r7, r8, r9, r1, r0);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  } else if (pb == postbacks.test_carousel_layout_height_min_mid) {
    reply = ssbot.newTextMessage(simpletext.test_carousel_layout_height_issue_min);
    ssbot.reply(message, reply, onResponse);  

    content = ssbot.newGeneralCarouselContent(c4, c4, c4);    
    reply = ssbot.newGeneralCarousel(l2, content);

    suggestions = ssbot.newSuggestions(r6, r7, r8, r9, r1, r0);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  } else if (pb == postbacks.test_carousel_layout_height_max_small) {
    reply = ssbot.newTextMessage(simpletext.test_carousel_layout_height_issue_max_small);
    ssbot.reply(message, reply, onResponse);  

    content = ssbot.newGeneralCarouselContent(c5, c5, c5);    
    reply = ssbot.newGeneralCarousel(l1, content);

    suggestions = ssbot.newSuggestions(r6, r7, r8, r9, r1, r0);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  } else if (pb == postbacks.test_carousel_layout_height_max_mid) {
    reply = ssbot.newTextMessage(simpletext.test_carousel_layout_height_issue_max_mid);
    ssbot.reply(message, reply, onResponse);  

    content = ssbot.newGeneralCarouselContent(c5, c5, c5);    
    reply = ssbot.newGeneralCarousel(l2, content);

    suggestions = ssbot.newSuggestions(r6, r7, r8, r9, r1, r0);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  } 

  ssbot.reply(message, reply, onResponse);  
}

var handle_reply_carousel_media = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);  
  
  var r0 = ssbot.newReply(simpletext.test_carousel_adv, postbacks.test_carousel_adv);
  var r10 = ssbot.newReply(simpletext.test_carousel_media, postbacks.test_carousel_media);
  var r1 = ssbot.newReply(simpletext.test_carousel_media_height_small, postbacks.test_carousel_media_height_small);
  var r2 = ssbot.newReply(simpletext.test_carousel_media_height_small_short, postbacks.test_carousel_media_height_small_short);
  var r3 = ssbot.newReply(simpletext.test_carousel_media_height_small_mid, postbacks.test_carousel_media_height_small_mid);
  var r4 = ssbot.newReply(simpletext.test_carousel_media_height_small_tall, postbacks.test_carousel_media_height_small_tall);
  var r5 = ssbot.newReply(simpletext.test_carousel_media_height_mid, postbacks.test_carousel_media_height_mid);
  var r6 = ssbot.newReply(simpletext.test_carousel_media_height_mid_short, postbacks.test_carousel_media_height_mid_short);
  var r7 = ssbot.newReply(simpletext.test_carousel_media_height_mid_mid, postbacks.test_carousel_media_height_mid_mid);
  var r8 = ssbot.newReply(simpletext.test_carousel_media_height_mid_tall, postbacks.test_carousel_media_height_mid_tall);
  
  
  var reply, layout, content, media, title, description, suggestions, card;
  cardmedias = JSON.parse(fs.readFileSync("res/json/cardmedias.json"));
  
  var m1 = cardmedias.image_coco_medium;  
  var m2 = cardmedias.audio_coco_medium;
  var m3 = cardmedias.video_coco_medium;
  var m4 = cardmedias.gif_coco_medium;
  
  var l1 = layouts.general_small_width;
  var l2 = layouts.general_medium_width;
   
  var pb = message.RCSMessage.suggestedResponse.response.reply.postback.data;
  if (pb == postbacks.test_carousel_media) {
    reply = ssbot.newTextMessage(simpletext.what_to_test);
        
    suggestions = ssbot.newSuggestions(r1, r5);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);    
  } else if (pb == postbacks.test_carousel_media_height_small) {
    reply = ssbot.newTextMessage(simpletext.test_carousel_media_height_small_issue);
    
    suggestions = ssbot.newSuggestions(r2, r3, r4, r10, r0);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);    
  } else if (pb == postbacks.test_carousel_media_height_mid) {
    reply = ssbot.newTextMessage(simpletext.test_richcard_media_height_issue);
    
    suggestions = ssbot.newSuggestions(r6, r7, r8, r10, r0);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);    
  } else {
    if (pb == postbacks.test_carousel_media_height_small_short) {      
      m1.height = ssbot.MEDIA_HEIGHT_SHORT_HEIGHT;
      m2.height = ssbot.MEDIA_HEIGHT_SHORT_HEIGHT;
      m3.height = ssbot.MEDIA_HEIGHT_SHORT_HEIGHT;
      m4.height = ssbot.MEDIA_HEIGHT_SHORT_HEIGHT;
      layout = l1;
    } else if (pb == postbacks.test_carousel_media_height_small_mid) {
      m1.height = ssbot.MEDIA_HEIGHT_MEDIUM_HEIGHT;
      m2.height = ssbot.MEDIA_HEIGHT_MEDIUM_HEIGHT;
      m3.height = ssbot.MEDIA_HEIGHT_MEDIUM_HEIGHT;
      m4.height = ssbot.MEDIA_HEIGHT_MEDIUM_HEIGHT;
      layout = l1;
    } else if (pb == postbacks.test_carousel_media_height_small_tall) {
      m1.height = ssbot.MEDIA_HEIGHT_TALL_HEIGHT;
      m2.height = ssbot.MEDIA_HEIGHT_TALL_HEIGHT;
      m3.height = ssbot.MEDIA_HEIGHT_TALL_HEIGHT;
      m4.height = ssbot.MEDIA_HEIGHT_TALL_HEIGHT;
      layout = l1;
    } else if (pb == postbacks.test_carousel_media_height_mid_short) {
      m1.height = ssbot.MEDIA_HEIGHT_SHORT_HEIGHT;
      m2.height = ssbot.MEDIA_HEIGHT_SHORT_HEIGHT;
      m3.height = ssbot.MEDIA_HEIGHT_SHORT_HEIGHT;
      m4.height = ssbot.MEDIA_HEIGHT_SHORT_HEIGHT;
      layout = l2;
    } else if (pb == postbacks.test_carousel_media_height_mid_mid) {
      m1.height = ssbot.MEDIA_HEIGHT_MEDIUM_HEIGHT;
      m2.height = ssbot.MEDIA_HEIGHT_MEDIUM_HEIGHT;
      m3.height = ssbot.MEDIA_HEIGHT_MEDIUM_HEIGHT;
      m4.height = ssbot.MEDIA_HEIGHT_MEDIUM_HEIGHT;
      layout = l2;
    } else if (pb == postbacks.test_carousel_media_height_mid_tall) {
      m1.height = ssbot.MEDIA_HEIGHT_TALL_HEIGHT;
      m2.height = ssbot.MEDIA_HEIGHT_TALL_HEIGHT;
      m3.height = ssbot.MEDIA_HEIGHT_TALL_HEIGHT;
      m4.height = ssbot.MEDIA_HEIGHT_TALL_HEIGHT;
      layout = l2;
    }     
  
    var c1 = ssbot.newGeneralRichCardContent(m1, title, description, suggestions);
    var c2 = ssbot.newGeneralRichCardContent(m2, title, description, suggestions);
    var c3 = ssbot.newGeneralRichCardContent(m3, title, description, suggestions);
    var c4 = ssbot.newGeneralRichCardContent(m4, title, description, suggestions);

    content = ssbot.newGeneralCarouselContent(c1, c2, c3, c4);    
    reply = ssbot.newGeneralCarousel(layout, content);
    
    suggestions = ssbot.newSuggestions(r1, r5, r10, r0);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);
  }  

  ssbot.reply(message, reply, onResponse);  
}

var handle_reply_carousel_display = function(message) {
  ssbot.read(message.RCSMessage.msgId, onResponse);  
  
  var r0 = ssbot.newReply(simpletext.test_carousel_adv, postbacks.test_carousel_adv);
  var r1 = ssbot.newReply(simpletext.test_carousel_display, postbacks.test_carousel_display);
  var r2 = ssbot.newReply(simpletext.test_carousel_display_align, postbacks.test_carousel_display_align);
  var r3 = ssbot.newReply(simpletext.test_carousel_display_number, postbacks.test_carousel_display_number);
    
  var reply, layout, content, media, title, description, suggestions, card;
  cardmedias = JSON.parse(fs.readFileSync("res/json/cardmedias.json"));
  
  var m1 = cardmedias.image_coco_medium;  
  var m2 = cardmedias.audio_coco_medium;
  var m3 = cardmedias.video_coco_medium;
  var m4 = cardmedias.gif_coco_medium;
  
  var t1 = "1 " + simpletext.test_receive_image_richcard;
  t1 = t1 + t1 + t1 + t1;
  var t2 = "2 " + simpletext.test_receive_audio_richcard;
  t2 = t2 + t2 + t2;
  var t3 = "3 " + simpletext.test_receive_video_richcard;
  t3 = t3 + t3;
  var t4 = "4 " + simpletext.test_receive_gif_richcard;

  var d1 = simpletext.test_receive_image_richcard;
  d1 = d1 + d1 + d1 + d1 + d1 + d1 + d1 + d1 + d1 + d1 + d1 + d1;
  var d2 = simpletext.test_receive_audio_richcard;
  d2 = d2 + d2 + d2 + d2 + d2 + d2 + d2 + d2;
  var d3 = simpletext.test_receive_video_richcard;
  d3 = d3 + d3 + d3 + d3;
  var d4 = simpletext.test_receive_gif_richcard;

  var s1 = ssbot.newSuggestions(r1, r2, r3);
  var s2 = ssbot.newSuggestions(r2, r3);
  var s3 = ssbot.newSuggestions(r1);
  var s4;

  var c1 = ssbot.newGeneralRichCardContent(m1, t1, d1, s1);
  var c2 = ssbot.newGeneralRichCardContent(m2, t2, d2, s2);
  var c3 = ssbot.newGeneralRichCardContent(m3, t3, d3, s3);
  var c4 = ssbot.newGeneralRichCardContent(m4, t4, d4, s4);

  layout = layouts.general_medium_width;
   
  var pb = message.RCSMessage.suggestedResponse.response.reply.postback.data;
  if (pb == postbacks.test_carousel_display) {
    reply = ssbot.newTextMessage(simpletext.what_to_test);
        
    suggestions = ssbot.newSuggestions(r2, r3);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);    
  } else if (pb == postbacks.test_carousel_display_align) {
    reply = ssbot.newTextMessage(simpletext.test_carousel_display_align_issue);
    ssbot.reply(message, reply, onResponse);

    content = ssbot.newGeneralCarouselContent(c1, c2, c3, c4);    
    reply = ssbot.newGeneralCarousel(layout, content);

    suggestions = ssbot.newSuggestions(r2, r3, r1, r0);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);    
  } else if (pb == postbacks.test_carousel_display_number) {
    reply = ssbot.newTextMessage(simpletext.test_carousel_display_number_issue);
    ssbot.reply(message, reply, onResponse);

    content = ssbot.newGeneralCarouselContent(c1, c2, c3, c4, c4, c3, c2, c1, c1, c2, c3, c4);    
    reply = ssbot.newGeneralCarousel(layout, content);

    suggestions = ssbot.newSuggestions(r2, r3, r1, r0);
    reply.RCSMessage.suggestedChipList = ssbot.newSuggestedChipList(suggestions);    
  } 

  ssbot.reply(message, reply, onResponse);  
}


ssbot.handle(['reply_start_over','reply_start_over_yes','reply_start_over_no'], 'postback', handle_reply_start_over);
ssbot.handle(['reply_view_cards', 'reply_view_richcard', 'reply_view_carousel'], 'postback', handle_reply_view_cards);
ssbot.handle(['reply_edit_cards', 'reply_build_richcard', 'reply_build_carousel'], 'postback', handle_reply_edit_cards);
ssbot.handle(['reply_richcard_layout', 'reply_richcard_layout_card_orientation', 'reply_richcard_layout_image_alignment', 'reply_richard_layout_orientation_vertical', 'reply_richard_layout_orientation_horizontal_left', 'reply_richard_layout_orientation_horizontal_right'], 'postback', handle_reply_richcard_layout);
ssbot.handle(['reply_richcard_content'], 'postback', handle_reply_richcard_content);


ssbot.handle(['reply_test_advanced'], 'postback', handle_reply_advanced);
ssbot.handle(['reply_test_10776'], 'postback', handle_reply_10776);
ssbot.handle(['reply_bot_interaction'], 'postback', handle_reply_bot_interaction);
ssbot.handle(['reply_send_msg_to_coco'], 'postback', handle_reply_send_msg_to_coco);
ssbot.handle(['reply_send_text_to_coco'], 'postback', handle_reply_send_text_to_coco);
ssbot.handle(['10776 read receipt'], 'textMessage', handle_test_read_receipt);
ssbot.handle(['10776 no read receipt'], 'textMessage', handle_test_no_read_receipt);
ssbot.handle(['reply_send_file_to_coco'], 'postback', handle_reply_send_file_to_coco);
ssbot.handle(['reply_receive_msg_from_coco'], 'postback', handle_reply_receive_msg_from_coco);
ssbot.handle(['reply_receive_short_text_from_coco', 'reply_receive_long_text_from_coco'], 'postback', handle_reply_receive_text_from_coco);
ssbot.handle(['reply_receive_image_from_coco', 'reply_receive_audio_from_coco', 'reply_receive_video_from_coco'], 'postback', handle_reply_receive_file_from_coco);
ssbot.handle(['reply_richcard_10776'], 'postback', handle_reply_richcard_10776);
ssbot.handle(['reply_receive_image_richcard','reply_receive_audio_richcard','reply_receive_video_richcard','reply_receive_gif_richcard', 'reply_learnmore_richcard'], 'postback', handle_reply_select_richcard_media_type);
ssbot.handle(['reply_receive_normal_richcard','reply_receive_no_thumbnail_richcard','reply_receive_broken_thumbnail_richcard','reply_receive_broken_file_richcard','reply_receive_all_broken_richcard', 'reply_back_to_chiplist_10776'], 'postback', handle_reply_receive_richcard_from_coco);
ssbot.handle(['reply_chiplist_10776'], 'postback', handle_reply_chiplist_10776);
ssbot.handle(['reply_text_with_chiplist','reply_file_with_chiplist','reply_richcard_with_chiplist','reply_learnmore_action'], 'postback', handle_reply_select_message_type_with_chiplist);
ssbot.handle(['reply_url_action','reply_dialer_action','reply_map_action','reply_calendar_action','reply_compose_action','reply_device_action', 'reply_settings_action', 'reply_back_to_chiplist_10776'], 'postback', handle_reply_select_action_type_chiplist);
ssbot.handle(['reply_carousel_10776'], 'postback', handle_reply_carousel_10776);
ssbot.handle(['reply_learnmore_carousel','reply_full_carousel','reply_back_to_carousel_10776'], 'postback', handle_reply_select_test_full_carousel);
ssbot.handle(['reply_richcard_adv'], 'postback', handle_reply_richcard_adv);
ssbot.handle(['reply_richcard_reply_action', 'reply_richcard_reply_action_order', 'reply_richcard_reply_action_char', 'reply_richcard_reply_action_11', 'reply_action_char_26'], 'postback', handle_reply_richcard_reply_action);
ssbot.handle(['reply_richcard_orientation', 'reply_richcard_orientation_left', 'reply_richcard_orientation_right', 'reply_richcard_orientation_vertical'], 'postback', handle_reply_richcard_orientation);
ssbot.handle(['reply_richcard_content', 'reply_richcard_content_title', 'reply_richcard_content_description', 'reply_richcard_content_image', 'reply_richcard_content_gif', 'reply_richcard_content_video', 'reply_richcard_content_audio', 'reply_richcard_content_reply_action', 'reply_richcard_content_title_description', 'reply_richcard_content_media_title', 'reply_richcard_content_media_description', 'reply_richcard_content_title_reply', 'reply_richcard_content_description_reply'], 'postback', handle_reply_richcard_content);
ssbot.handle(['reply_richcard_layout', 'reply_richcard_layout_width', 'reply_richcard_layout_height', 'reply_richcard_layout_height_min', 'reply_richcard_layout_height_max', 'reply_richcard_layout_height_description', 'reply_richcard_layout_height_title', 'reply_richcard_layout_height_action', 'reply_richcard_layout_height_reply'], 'postback', handle_reply_richcard_layout);
ssbot.handle(['reply_carousel_adv'], 'postback', handle_reply_carousel_adv);
ssbot.handle(['reply_carousel_layout', 'reply_carousel_layout_width', 'reply_carousel_layout_width_small', 'reply_carousel_layout_width_mid', 'reply_carousel_layout_height', 'reply_carousel_layout_height_min_small', 'reply_carousel_layout_height_min_mid', 'reply_carousel_layout_height_max_small', 'reply_carousel_layout_height_max_mid'], 'postback', handle_reply_carousel_layout);
ssbot.handle(['reply_richcard_media', 'reply_richcard_media_edge', 'reply_richcard_media_edge_image', 'reply_richcard_media_edge_gif', 'reply_richcard_media_edge_video', 'reply_richcard_media_edge_audio', 'reply_richcard_media_height', 'reply_richcard_media_height_short', 'reply_richcard_media_height_mid', 'reply_richcard_media_height_tall'], 'postback', handle_reply_richcard_media);
ssbot.handle(['reply_carousel_media', 'reply_carousel_media_height_small', 'reply_carousel_media_height_small_mid', 'reply_carousel_media_height_small_tall', 'reply_carousel_media_height_mid', 'reply_carousel_media_height_mid_short', 'reply_carousel_media_height_mid_mid', 'reply_carousel_media_height_mid_tall'], 'postback', handle_reply_carousel_media);
ssbot.handle(['reply_richcard_wrap', 'reply_richcard_wrap_title', 'reply_richcard_wrap_desc', 'reply_richcard_wrap_title_desc'], 'postback', handle_reply_richcard_wrap);
ssbot.handle(['reply_carousel_display', 'reply_carousel_display_align', 'reply_carousel_display_number'], 'postback', handle_reply_carousel_display);

var onResponse = function (err, res, body) {
  if (err) {
    //console.log("err:"+err.message);
  }
  if (res) {
    //console.log("statusCode:"+res.statusCode);
    //console.log("statusMessage:"+res.statusMessage);
  }
  if (body) {
    //console.log("body:"+JSON.stringify(body));
  }
}

var onStateListener = function (state, reason) {
  if (!state) {
    log.error('Cannot send any message all messages should be buffered now ' + reason);
  } else {
    log.info("Bot is working correctly");
  }
}

var generateRandomString = function (min, max) {
  var ran = Math.floor(Math.random() * (max - min)) + min;
  return crypto.randomBytes(ran).toString('hex');
}
