/* ============================================================
 * node.bittrex.api
 * https://github.com/dparlevliet/node.bittrex.api
 *
 * ============================================================
 * Copyright 2014-, Adrian Soluch, David Parlevliet
 * Released under the MIT License
 * ============================================================ */
var RATE = 1;
var INTERVAL = 1000;

var NodeBittrexApi = function(options) {
  'use strict';

  var limit = require('simple-rate-limiter'),
    request = limit(require('request')).to(RATE).per(INTERVAL),
    assign = require('object-assign'),
    StoL = require('./bittrexStoL.js'),
    crypto = require('crypto'),
    jsonic = require('jsonic'),
    signalR = require('signalr-client'),
    wsclient,
    cloudscraper = require('cloudscraper'),
    zlib = require('zlib');


  var default_request_options = {
    method: 'GET',
    agent: false,
    headers: {
      'User-Agent': 'Mozilla/4.0 (compatible; Node Bittrex API)',
      'Content-type': 'application/x-www-form-urlencoded'
    }
  };

  var opts = {
    baseUrl: 'https://bittrex.com/api/v1.1',
    baseUrlv2: 'https://bittrex.com/Api/v2.0',
    websockets_baseurl: 'wss://socket.bittrex.com/signalr',
    websockets_hubs: 'c2',
//    websockets_hubs: 'CoreHub',
    apikey: 'APIKEY',
    apisecret: 'APISECRET',
    verbose: false,
    cleartext: false,
    websockets: {
      autoReconnect: true,
    },
    requestTimeoutInSeconds: 15,
  };

  var lastNonces = [];

  var getNonce = function() {
    var nonce = new Date().getTime();

    while (lastNonces.indexOf(nonce) > -1) {
      nonce = new Date().getTime(); // Repetition of the above. This can probably done better :-)
    }

    // keep the last X to try ensure we don't have collisions even if the clock is adjusted
    lastNonces = lastNonces.slice(-50);

    lastNonces.push(nonce);

    return nonce;
  };

  var extractOptions = function(options) {
    var o = Object.keys(options),
      i;
    for (i = 0; i < o.length; i++) {
      opts[o[i]] = options[o[i]];
    }
  };

  if (options) {
    extractOptions(options);
  }

  var lastRequest = (new Date()).getTime();

// function to rate limit all websocket client.call function calls
  var wsCall = limit(function(...a) {
    var cb = a.splice(-1, 1)[0];
    return wsclient.call.apply(wsclient.call, a).done(cb);
  }).to(RATE).per(INTERVAL);

  var apiCredentials = function(uri) {
    var options = {
      apikey: opts.apikey,
      nonce: getNonce()
    };

    return setRequestUriGetParams(uri, options);
  };

  var setRequestUriGetParams = function(uri, options) {
    var op;
    if (typeof(uri) === 'object') {
      op = uri;
      uri = op.uri;
    } else {
      op = assign({}, default_request_options);
    }


    var o = Object.keys(options),
      i;
    for (i = 0; i < o.length; i++) {
      uri = updateQueryStringParameter(uri, o[i], options[o[i]]);
    }

//    op.headers.apisign = hmac_sha512.HmacSHA512(uri, opts.apisecret); // setting the HMAC hash `apisign` http header
    op.headers.apisign = crypto.createHmac('sha512', opts.apisecret).update(uri).digest('hex'); // setting the HMAC hash `apisign` http header
    op.uri = uri;
    op.timeout = opts.requestTimeoutInSeconds * 1000;

    return op;
  };

  var updateQueryStringParameter = function(uri, key, value) {
    var re = new RegExp("([?&])" + key + "=.*?(&|$)", "i");
    var separator = uri.indexOf('?') !== -1 ? "&" : "?";

    if (uri.match(re)) {
      uri = uri.replace(re, '$1' + key + "=" + value + '$2');
    } else {
      uri = uri + separator + key + "=" + value;
    }

    return uri;
  };

  var sendRequest = function(op) {
    var start = Date.now();
    return new Promise(function(resolve, reject) {
      request(op, function(error, result, body) {
        ((opts.verbose) ? console.log("requested from " + op.uri + " in: %ds", (Date.now() - start) / 1000) : '');
        if (!body || !result || result.statusCode != 200) {
          var errorObj = {
            success: false,
            message: 'URL request error',
            error: error,
            result: result,
          };
          reject(errorObj);
        } else {
          try {
            result = JSON.parse(body);
          } catch (err) {}
          if (!result || !result.success) {
            // error returned by bittrex API - forward the result as an error
            reject(result);
          }
          resolve(result);
        }
      });
    });
  };

  var publicApiCall = function(url, options) {
    var op = assign({}, default_request_options);
    if (!options) {
      op.uri = url;
    }
    return sendRequest((!options) ? op : setRequestUriGetParams(url, options));
  };

  var credentialApiCall = function(url, options) {
    if (options) {
      options = setRequestUriGetParams(apiCredentials(url), options);
    }
    return sendRequest(options);
  };

  var websocketGlobalTickers = false;
  var websocketGlobalTickerCallback;
  var websocketMarkets = {};
  var websocketMarketsStore = {};

  var websocketMarketsCallbacks = [];
  var websocketLastMessage = (new Date()).getTime();
  var websocketWatchDog = undefined;
  var websocketEvents = {};

  var resetWs = function() {
    websocketGlobalTickers = false;
    websocketGlobalTickerCallback = undefined;
//    websocketMarkets = {};
    websocketMarketsCallbacks = [];
  };

  var connectws = function(callback, force) {
    if (wsclient && !force && callback) {
      return callback(wsclient);
    }

    if (force) {
      try {
        wsclient.end();
        if (websocketWatchDog) {
          clearInterval(websocketWatchDog);
          websocketWatchDog = null;
        }
       } catch (e) {}
    }

    if (!websocketWatchDog) {
      websocketLastMessage = (new Date()).getTime();
      websocketWatchDog = setInterval(function() {
        if (!wsclient) {
          return;
        }

        if (
          opts.websockets &&
          (
            opts.websockets.autoReconnect === true ||
            typeof(opts.websockets.autoReconnect) === 'undefined'
          )
        ) {
          var now = (new Date()).getTime();
          var diff = now - websocketLastMessage;

          if (diff > 60 * 1000) {
            ((opts.verbose) ? console.log('Websocket Watch Dog: Websocket has not received communication for over 1 minute. Forcing reconnection. Ruff!') : '');
            connectws(callback, true);
          } else {
            ((opts.verbose) ? console.log('Websocket Watch Dog: Last message received '+diff+'ms ago. Ruff!') : '');
          }
        }
      }, 5 * 1000);
    }

    cloudscraper.get('https://bittrex.com/', function(error, response, body) {
      if (error) {
        console.error('Cloudscraper error occurred');
        console.error(error);
        return;
      }

      opts.headers = {
        cookie: (response.request.headers["cookie"] || ''),
        user_agent: (response.request.headers["User-Agent"] || '')
      };

      wsclient = new signalR.client(
        opts.websockets_baseurl,
        [opts.websockets_hubs],
       undefined,
       true
      );

      if (opts.headers) {
        wsclient.headers['User-Agent'] = opts.headers.user_agent;
        wsclient.headers['cookie'] = opts.headers.cookie;
      }

      wsclient.start();
      wsclient.serviceHandlers = {
        bound: function() {
          ((opts.verbose) ? console.log('Websocket bound') : '');
          if (opts.websockets && typeof(opts.websockets.onConnect) === 'function') {
            resetWs();
            opts.websockets.onConnect();
          }
        },
        connectFailed: function(error) {
          ((opts.verbose) ? console.log('Websocket connectFailed: ', error) : '');
        },
        disconnected: function() {
          ((opts.verbose) ? console.log('Websocket disconnected') : '');
          if (opts.websockets && typeof(opts.websockets.onDisconnect) === 'function') {
            opts.websockets.onDisconnect();
          }

          if (
            opts.websockets &&
            (
              opts.websockets.autoReconnect === true ||
              typeof(opts.websockets.autoReconnect) === 'undefined'
            )
          ) {
            ((opts.verbose) ? console.log('Websocket auto reconnecting.') : '');
//            setTimeout(function() {wsclient.start();},5000); // ensure we try reconnect -AFTER 5 seconds
          } else {
            // otherwise, clear the watchdog interval if necessary
            if (websocketWatchDog) {
              clearInterval(websocketWatchDog);
              websocketWatchDog = null;
            }
          }
        },
        onerror: function(error,e,data) {
          ((opts.verbose) ? console.log('Websocket onerror: ', error/* + '\n' + e + '\n' + data*/) : '');
        },
        bindingError: function(error) {
          ((opts.verbose) ? console.log('Websocket bindingError: ', error) : '');
        },
        connectionLost: function(error) {
          ((opts.verbose) ? console.log('Connection Lost: ', error) : '');
        },
        reconnecting: function(retry) {
          // Disabled in 0.8.3
          // Websocket reconnection is now handled by the library. Enabling this
          // can cause double connections.
          //
          // ((opts.verbose) ? console.log('Websocket Retrying: ', retry) : '');
          // change to true to stop retrying
          return true;
        },
        connected: function() {
/*
          if (websocketGlobalTickers) {
            wsclient.call(opts.websockets_hubs, 'SubscribeToSummaryDeltas').done(function(err, result) {
              if (err) {
                return console.error(err);
              }

              if (result === true) {
                ((opts.verbose) ? console.log('Subscribed to global tickers') : '');
              }
            });
          }

          if (websocketMarkets.length > 0) {
            websocketMarkets.forEach(function(market) {
              wsclient.call(opts.websockets_hubs, 'SubscribeToExchangeDeltas', market).done(function(err, result) {
                if (err) {
                  return console.error(err);
                }

                if (result === true) {
                  ((opts.verbose) ? console.log('Subscribed to ' + market) : '');
                }

              });
            });
          }
          ((opts.verbose) ? console.log('Websocket connected') : '');
*/
        }
      };

      if (callback) {
        callback(wsclient);
      }

    }, opts.cloudscraper_headers || {});

    return wsclient;
  };

  var setMessageReceivedWs = function() {
    wsclient.serviceHandlers.messageReceived = function(message) {
      websocketLastMessage = (new Date()).getTime();
      try {
        var data = jsonic(message.utf8Data);
        if (data && data.M) {
          data.M.forEach(function(M) {
            if (websocketGlobalTickerCallback) {
              websocketGlobalTickerCallback(M, wsclient);
            }
            if (websocketMarketsCallbacks.length > 0) {
              websocketMarketsCallbacks.forEach(function(callback) {
                callback(M, wsclient);
              });
            }
          });
        } else {
          // ((opts.verbose) ? console.log('Unhandled data', data) : '');
          if (websocketGlobalTickerCallback) {
            websocketGlobalTickerCallback({'unhandled_data' : data}, wsclient);
          }
          if (websocketMarketsCallbacks.length > 0) {
            websocketMarketsCallbacks.forEach(function(callback) {
              callback({'unhandled_data' : data}, wsclient);
            });
          }
        }
      } catch (e) {
        ((opts.verbose) ? console.error(e) : '');
      }
      return false;
    };
  };

  var mergeOrderbookDeltas = function(orderbook, deltas) {
    var idx;
    var ele;
    var i;
    var l;
    for (i = 0, l = deltas.length; i < l; i++) {
      ele = deltas[i];
      switch(ele.Type) {
        case 'Add':
          orderbook.push(
            {Rate: ele.Rate,
             Quantity: ele.Quantity}
          );
          break;
        case 'Remove':
          idx = orderbook.findIndex(e => e.Rate === ele.Rate);
          if (idx != -1) {
            orderbook.splice(idx, 1);
          }
          break;
        case 'Update':
          idx = orderbook.findIndex(e => e.Rate === ele.Rate);
          if (idx != -1) {
            orderbook[idx].Rate = ele.Rate;
            orderbook[idx].Quantity = ele.Quantity;
          }
          break;
        default:
          console.error('unknown Exchange update type of: ',ele.Type);
          break;
      }
    }
    return orderbook.sort((a, b) => (a.Rate > b.Rate) ? 1 : (b.Rate > a.Rate) ? -1 : 0);
  };

  var updateBalance = function(msg) {
    websocketLastMessage = (new Date()).getTime();
    var decomp = decompressMessage(msg);
    decomp = StoL.expandKeys(decomp, 'uB');
    emit('balance update',decomp);
    ((opts.debug) ? console.log('Balance Update\n' + JSON.stringify(decomp,null,2)) : '');
  }
  var updateOrder = function(msg) {
    websocketLastMessage = (new Date()).getTime();
    var decomp = decompressMessage(msg);
    decomp = StoL.expandKeys(decomp, 'uO');
    emit('order update',decomp);
    ((opts.debug) ? console.log('Order Update\n' + JSON.stringify(decomp,null,2)) : '');
  }
  var summaryDelta = function(msg) {
    websocketLastMessage = (new Date()).getTime();
    var decomp = decompressMessage(msg);
    decomp = StoL.expandKeys(decomp);
    emit('summary delta',decomp);
    ((opts.debug) ? console.log('Summary Delta\n' + JSON.stringify(decomp,null,2)) : '');

  }
  var exchangeDelta = function(msg) {
    websocketLastMessage = (new Date()).getTime();
    var decomp = decompressMessage(msg);
    decomp = StoL.expandKeys(decomp);
    var marketName = decomp.MarketName;
    if(!websocketMarketsStore[marketName]) {
       websocketMarketsStore[marketName] = [];
    }
    var m = websocketMarketsStore[marketName];
    m.push(decomp);
    var oB = websocketMarkets[marketName];
    if (oB) {
      var i;
      while( (i = m.shift()) !== undefined ) {
        if(oB.Nonce <= i.Nonce) {
          oB.Buys = mergeOrderbookDeltas(oB.Buys, i.Buys);
          oB.Sells = mergeOrderbookDeltas(oB.Sells, i.Sells);
        }
        Array.prototype.push.apply((oB.Fills || []), i.Fills);
//        console.log(oB.Fills.length + ' elements in ' + marketName);
      }
    }
    emit('exchange delta',decomp, oB);
    ((opts.debug) ? console.log('Exchange Delta\n' + JSON.stringify(decomp,null,2)) : '');

  }
  var decompressMessage = function(message) {
    let raw = new Buffer.from(message, 'base64')
    let inflated = zlib.inflateRawSync(raw);
    return jsonic(inflated.toString('utf8'));
  };
  var emit = function(event,...data) {
    var handlers = websocketEvents[event];
    if(handlers && handlers.length) {
      for(var i=0, l=handlers.length; i<l; i++) {
        handlers[i](...data);
      }
    }
  }

  return {
    options: function(options) {
      ((opts.debug) ? console.log('websockets.options') : '');
      extractOptions(options);
    },
    websockets: {
      client: function(callback, force) {
        ((opts.debug) ? console.log('websockets.client') : '');
        return connectws(callback, force);
      },
      listen: function(force) {
        ((opts.debug) ? console.log('websockets.listen') : '');
        connectws(function() {
          wsCall(opts.websockets_hubs, 'SubscribeToSummaryDeltas', function(err,result) {
            if (err) {
              return console.error(err);
            }
            ((opts.verbose) ? console.log('SubscribeToSummaryDeltas: ', result) : '');
            wsclient.on(opts.websockets_hubs, 'uS', summaryDelta);
          })
/*
          websocketGlobalTickers = true;
          websocketGlobalTickerCallback = callback;
          setMessageReceivedWs();
*/
        }, force);
      },
      subscribe: function(markets, force) {
        ((opts.debug) ? console.log('websockets.subscribe') : '');
        connectws(function() {
          markets.forEach(function (market) {
            wsCall(opts.websockets_hubs, 'SubscribeToExchangeDeltas', market, function(err,result) {
              if (err) {
                return console.error('SubscribeToExchangeDeltas Error :', err);
              }
              ((opts.verbose) ? console.log('SubscribeToExchangeDeltas: ', result) : '');
              wsclient.on(opts.websockets_hubs, 'uE', exchangeDelta);
              wsCall(opts.websockets_hubs, 'QueryExchangeState', market, function(err,result) {
                if(err) {
                  return console.error('QueryExchangeState Error:',err);
                }
                ((opts.verbose) ? console.log('QueryExchangeState: ', typeof result, result) : '');
                if(typeof result === 'string') {
                  var oB = StoL.expandKeys(decompressMessage(result));
//                  console.log(JSON.stringify(oB,null,1));
                  if (!websocketMarkets[oB.MarketName]) {
                    websocketMarkets[oB.MarketName] = {};
                  }
                  websocketMarkets[oB.MarketName] = oB;
                }
              });

            })
          });
        }, force);
      },
      authenticate: function(name, force) {
        ((opts.debug) ? console.log('websockets.authenticate') : '');
        connectws(function() {
          ((opts.debug) ? console.log('websockets.authenticate.GetAuthContext') : '');
          wsCall(opts.websockets_hubs, 'GetAuthContext', opts.apikey, function(err,challenge) {
            if(err) {
              return console.error(err);
            }
            // generate signature
            const signed_challenge = crypto.createHmac('sha512', opts.apisecret).update(challenge).digest('hex');

            // authenticate
            ((opts.debug) ? console.log('websockets.authenticate.Authenticate') : '');
            wsCall(opts.websockets_hubs,'Authenticate', opts.apikey, signed_challenge, function(err,result) {
              if (err) {
                return console.error(err);
              }
              ((opts.verbose) ? console.log('authorization result ',result) : '');
              wsclient.on(opts.websockets_hubs,'uB', updateBalance);
              wsclient.on(opts.websockets_hubs,'uO', updateOrder);
            });
          });
        }, force);

      }
    },
    on: function(event,callback) {
      if(websocketEvents[event] === undefined) {
        websocketEvents[event] = [];
      }
      websocketEvents[event].push(callback);
    },
    sendCustomRequest: function(request_string, credentials) {
      var op;

      if (credentials === true) {
        op = apiCredentials(request_string);
      } else {
        op = assign({}, default_request_options, { uri: request_string });
      }
      return sendRequest(op);
    },
    getmarkets: function() {
      return publicApiCall(opts.baseUrl + '/public/getmarkets', null);
    },
    getcurrencies: function() {
      return publicApiCall(opts.baseUrl + '/public/getcurrencies', null);
    },
    getticker: function(options) {
      return publicApiCall(opts.baseUrl + '/public/getticker', options);
    },
    getmarketsummaries: function() {
      return publicApiCall(opts.baseUrl + '/public/getmarketsummaries', null);
    },
    getmarketsummary: function(options) {
      return publicApiCall(opts.baseUrl + '/public/getmarketsummary', options);
    },
    getorderbook: function(options) {
      return publicApiCall(opts.baseUrl + '/public/getorderbook', options);
    },
    getmarkethistory: function(options) {
      return publicApiCall(opts.baseUrl + '/public/getmarkethistory', options);
    },
    getcandles: function(options) {
      return publicApiCall(opts.baseUrlv2 + '/pub/market/GetTicks', options);
    },
    getticks: function(options) {
      return publicApiCall(opts.baseUrlv2 + '/pub/market/GetTicks', options);
    },
    getlatesttick: function(options) {
      return publicApiCall(opts.baseUrlv2 + '/pub/market/GetLatestTick', options);
    },
    buylimit: function(options) {
      return credentialApiCall(opts.baseUrl + '/market/buylimit', options);
    },
    buymarket: function(options) {
      return credentialApiCall(opts.baseUrl + '/market/buymarket', options);
    },
    selllimit: function(options) {
      return credentialApiCall(opts.baseUrl + '/market/selllimit', options);
    },
    tradesell: function(options) {
      return credentialApiCall(opts.baseUrlv2 + '/key/market/TradeSell', options);
    },
    tradebuy: function(options) {
      return credentialApiCall(opts.baseUrlv2 + '/key/market/TradeBuy', options);
    },
    sellmarket: function(options) {
      return credentialApiCall(opts.baseUrl + '/market/sellmarket', options);
    },
    cancel: function(options) {
      return credentialApiCall(opts.baseUrl + '/market/cancel', options);
    },
    getopenorders: function(options) {
      return credentialApiCall(opts.baseUrl + '/market/getopenorders', options);
    },
    getbalances: function() {
      return credentialApiCall(opts.baseUrl + '/account/getbalances', {});
    },
    getbalance: function(options) {
      return credentialApiCall(opts.baseUrl + '/account/getbalance', options);
    },
    getwithdrawalhistory: function(options) {
      return credentialApiCall(opts.baseUrl + '/account/getwithdrawalhistory', options);
    },
    getdepositaddress: function(options) {
      return credentialApiCall(opts.baseUrl + '/account/getdepositaddress', options);
    },
    getdeposithistory: function(options) {
      return credentialApiCall(opts.baseUrl + '/account/getdeposithistory', options);
    },
    getorderhistory: function(options, callback) {
      credentialApiCall(opts.baseUrl + '/account/getorderhistory', callback, options || {});
    },
    getorder: function(options) {
      return credentialApiCall(opts.baseUrl + '/account/getorder', options);
    },
    withdraw: function(options) {
      return credentialApiCall(opts.baseUrl + '/account/withdraw', options);
    },
    getbtcprice: function(options) {
      return publicApiCall(opts.baseUrlv2 + '/pub/currencies/GetBTCPrice', options);
    },
  };
};

module.exports = NodeBittrexApi();

module.exports.createInstance = NodeBittrexApi;
