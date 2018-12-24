var standalonecard = {
  "RCSMessage": {
    "richcardMessage": {
      "message": {
        "generalPurposeCard": {
          "layout": {
            "cardOrientation": "HORIZONTAL",
            "imageAlignment": "LEFT"
          },
          "content": {
            "title": "Hi",
            "description": "This is a sample rich card.",
            "media": {
              "mediaUrl": "https://s3-us-west-2.amazonaws.com/samsung-chatbot-store/public/mwc-att-demo/st_demo_16x10.jpg",
              "mediaContentType": "image/png",
              "mediaFileSize": 62329,
              "thumbnailUrl": "https://s3-us-west-2.amazonaws.com/samsung-chatbot-store/public/mwc-att-demo/st_demo_16x10.jpg",
              "thumbnailContentType": "image/png",
              "thumbnailFileSize": 62329,
              "height": "SHORT_HEIGHT",
              "contentDescription": "Textual description of media content"
            },
            "suggestions": [{
              "reply": {
                "displayText": "Yes",
                "postback": {
                  "data": "set_by_chatbot_reply_yes"
                }
              }
            },
            {
              "reply": {
                "displayText": "No",
                "postback": {
                  "data": "set_by_chatbot_reply_no"
                }
              }
            },
            {
              "action": {
                "urlAction": {
                  "openUrl": {
                    "url": "https://maap.rcscloudconnect.net"
                  }
                },
                "displayText": "Samsung MAAP",
                "postback": {
                  "data": "set_by_chatbot"
                }
              }
            },
            {
              "action": {
                "dialerAction": {
                  "dialPhoneNumber": {
                    "phoneNumber": "+1650253000"
                  }
                },
                "displayText": "Call a phone number",
                "postback": {
                  "data": "set_by_chatbot_dial_phone_number"
                }
              }
            },
            {
              "action": {
                "composeAction": {
                  "composeTextMessage": {
                    "phoneNumber": "+1650253000",
                    "text": "Draft to go into the send message text field."
                  }
                },
                "displayText": "Draft a text message",
                "postback": {
                  "data": "set_by_chatbot_compose_text_message"
                }
              }
            },
            {
              "action": {
                "mapAction": {
                  "showLocation": {
                    "location": {
                      "latitude": 37.4220041,
                      "longitude": -122.0862515,
                      "label": "GooglePlex"
                    },
                    "fallbackUrl": "https://www.google.com/maps/@37.4219162,-122.078063,15z"
                  }
                },
                "displayText": "Show location on a map",
                "postback": {
                  "data": "set_by_chatbot_show_location"
                }
              }
            },
            {
              "action": {
                "calendarAction": {
                  "createCalendarEvent": {
                    "title": "Meeting",
                    "startTime": "2017-03-14T00:00:00Z",
                    "endTime": "2017-03-14T23:59:59Z",
                    "description": "GSG review meeting"
                  }
                },
                "displayText": "Schedule Meeting",
                "postback": {
                  "data": "set_by_chatbot_create_calendar_event"
                }
              }
            },
            {
              "action": {
                "deviceAction": {
                  "requestDeviceSpecifics": {
                    "title": "Request specifics about the user's device."
                  }
                },
                "displayText": "Request device specifics",
                "postback": {
                  "data": "set_by_chatbot_request_device_specifics"
                }
              }
            },
            {
              "action": {
                "settingsAction": {
                  "disableAnonymization": {

                  }
                },
                "displayText": "Share your phone number",
                "postback": {
                  "data": "set_by_chatbot_disable_anonymization"
                }
              }
            },
            {
              "action": {
                "settingsAction": {
                  "enableDisplayedNotifications": {

                  }
                },
                "displayText": "Send read receipts",
                "postback": {
                  "data": "set_by_chatbot_enable_displayed_notifications"
                }
              }
            }]
          }
        }
      }
    }
  }
};

var carouselcontent = {
  "RCSMessage": {
    "richcardMessage": {
      "message": {
        "generalPurposeCardCarousel": {
          "layout": {
            "cardWidth": "SMALL_WIDTH"
          },
          "content": [{
            "title": "Hi",
            "description": "This is a rich card carousel.",
            "media": {
              "mediaUrl": "https://s3-us-west-2.amazonaws.com/samsung-chatbot-store/public/mwc-att-demo/st_demo_16x10.jpg",
              "mediaContentType": "image/png",
              "mediaFileSize": 62329,
              "thumbnailUrl": "https://s3-us-west-2.amazonaws.com/samsung-chatbot-store/public/mwc-att-demo/st_demo_16x10.jpg",
              "thumbnailContentType": "image/png",
              "thumbnailFileSize": 62329,
              "height": "SHORT_HEIGHT",
              "contentDescription": "Textual description of media content"
            },
            "suggestions": [{
              "reply": {
                "displayText": "Yes",
                "postback": {
                  "data": "set_by_chatbot_reply_yes"
                }
              }
            },
            {
              "reply": {
                "displayText": "No",
                "postback": {
                  "data": "set_by_chatbot_reply_no"
                }
              }
            }]
          },
          {
            "title": "Hi",
            "description": "This is a rich card carousel.",
            "media": {
              "mediaUrl": "https://s3-us-west-2.amazonaws.com/samsung-chatbot-store/public/mwc-att-demo/st_demo_16x10.jpg",
              "mediaContentType": "image/png",
              "mediaFileSize": 62329,
              "thumbnailUrl": "https://s3-us-west-2.amazonaws.com/samsung-chatbot-store/public/mwc-att-demo/st_demo_16x10.jpg",
              "thumbnailContentType": "image/png",
              "thumbnailFileSize": 62329,
              "height": "SHORT_HEIGHT",
              "contentDescription": "Textual description of media content"
            },
            "suggestions": [{
              "action": {
                "urlAction": {
                  "openUrl": {
                    "url": "https://maap.rcscloudconnect.net"
                  }
                },
                "displayText": "Samsung MAAP",
                "postback": {
                  "data": "https://maap.rcscloudconnect.net"
                }
              }
            },
            {
              "action": {
                "dialerAction": {
                  "dialPhoneNumber": {
                    "phoneNumber": "+1650253000"
                  }
                },
                "displayText": "Call a phone number",
                "postback": {
                  "data": "set_by_chatbot_dial_phone_number"
                }
              }
            }]
          }]
        }
      }
    }
  }
};

var chiplist = {
  "RCSMessage": {
    "textMessage": "sample text message",
    "suggestedChipList": {
      "suggestions": [{
        "reply": {
          "displayText": "Yes",
          "postback": {
            "data": "set_by_chatbot_reply_yes"
          }
        }
      },
      {
        "reply": {
          "displayText": "No",
          "postback": {
            "data": "set_by_chatbot_reply_no"
          }
        }
      }]
    }
  }
};
