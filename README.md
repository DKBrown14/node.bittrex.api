!Important! Note
----

This is a seriously modified fork of the original library.
* The REST api functions have been changed from callbacks to returning promises.
* The Websocket implementation is completely changed.
  * Callbacks are removed and replaced with an event like system.
  * Now uses V2 websocket interface. (c2 hub instead of CoreHub)
    * Bittrex's compressed and minified data is decompressed and un-minified. All data is returned as objects.
* Automatic rate limiting is implemented across all api calls.
* inverse_callback_arguments has been removed since callbacks are removed.
* hmac_sha512.js is no longer necessary and has been replaced by the crypto library.

Most of the rest of the text following is unchanged from the upstream source. The documentation will change as I get the time to update it.

----
Also, the **websocket code has changed** after Bittrex switched to using Cloudflare
so please see the new ``Websockets`` documentation and updated unit tests and
examples in the ``examples/`` folder.


Node Bittrex API
=========

Node Bittrex API is an asynchronous node.js library for the Bittrex API - https://bittrex.com/.
The Bittrex API data can be received either as a GET request or via Websockets API.

Documentation for the Bittrex API: https://bittrex.com/Home/Api

This Library is licensed under the [MIT license](https://github.com/DKBrown14/node.bittrex.api/blob/master/LICENSE).


Contributors
----
Thanks go to the people who have contributed code to this Library.
* [n0mad01](https://github.com/n0mad01) Special kudos - the original creator of the library. Thanks for the hard work.
* [dparlevliet](https://github.com/dparlevliet) Special kudos - thanks for keeping the project alive.
* [cyberwlf](https://github.com/armandohg) & [armandohg](https://github.com/armandohg) - Special thanks to them for the cloudflare websocket research and fix but also thanks to everyone else in [issue #67](https://github.com/n0mad01/node.bittrex.api/issues/67)
* [samuelhei](https://github.com/samuelhei) Special kudos - thanks to him all missing calls are complemented as also structural improvements have been made.
* [mhuggins](https://github.com/mhuggins)
* [192-sean](https://github.com/192-sean)
* [caffeinewriter](https://github.com/caffeinewriter)
* [apense](https://github.com/apense)
* [TheRealest](https://github.com/TheRealest)
* [Alexsey](https://github.com/Alexsey)


Before you start
----
This is just a quick reminder that you are handling coins with this library (and thus real money), so, understand the situation as much as possible and make everything to prevent losing them.

Here is a small checklist you should go through before you start:

- Make sure you don't give your api key more rights as absolutely necessary - for first testing READ INFO alone should be enough! (bittrex.com under: Settings/API Keys)

![bittrex_ap_keys_control](https://user-images.githubusercontent.com/260321/29748739-a6c2c00e-8b1c-11e7-95ec-1b0221348235.png)

- make sure to understand the API Key permissions
    1. READ INFO - Allows you to read private details such as open orders, order history, balances, etc
    2. TRADE LIMIT - Allows you to create/cancel trade limit buy/sell orders
    3. TRADE MARKET - allows you to create/cancel market buy/sell orders
    4. WITHDRAW - Allows you to withdraw to another address
- Make use of the Bittrex IP Whitelist as also the Withdrawal Whitelist features
- Do not ever commit your API Keys to GitHub or expose them under any circumstances!


Quick start
----
Don't do this as the NPM repository is the wrong version. -- See the advanced Start below.
```sh
$ npm install node-bittrex-api
```

```javascript
var bittrex = require('node-bittrex-api');
bittrex.options({
  'apikey' : API_KEY,
  'apisecret' : API_SECRET,
});
bittrex.getmarketsummaries( function( data, err ) {
  if (err) {
    return console.error(err);
  }
  for( var i in data.result ) {
    bittrex.getticker( { market : data.result[i].MarketName }, function( ticker ) {
      console.log( ticker );
    });
  }
});
```


Advanced start
----

fetch the project via git:
```sh
$ git clone https://github.com/DKBrown14/node.bittrex.api.git
```

then meet the package dependencies:
```sh
$ cd node.bittrex.api/
$ npm install
```

Include ``node.bittrex.api.js`` into your project:
```javascript
var bittrex = require('./node.bittrex.api.js');
```

##### Configuration
```javascript
bittrex.options({
  'apikey' : API_KEY,
  'apisecret' : API_SECRET,
  'verbose' : true,
});
```

The baseUrl itself can also be set via options
```javascript
'baseUrl' : 'https://bittrex.com/api/v1',
'baseUrlv2' : 'https://bittrex.com/Api/v2.0',
```

Websockets
--

#### Basic example
```javascript
bittrex.websockets.client(function() {
  console.log('Websocket connected');
  bittrex.websockets.subscribe(['BTC-ETH'], function(data) {
    if (data.M === 'updateExchangeState') {
      data.A.forEach(function(data_for) {
        console.log('Market Update for '+ data_for.MarketName, data_for);
      });
    }
  });
});
```

#### Basic example with event emitters
```javascript
bittrex.options({
  websockets: {
    onConnect: function() {
      console.log('Websocket connected');
      bittrex.websockets.subscribe(['BTC-ETH'], function(data) {
        if (data.M === 'updateExchangeState') {
          data.A.forEach(function(data_for) {
            console.log('Market Update for '+ data_for.MarketName, data_for);
          });
        }
      });
    },
    onDisconnect: function() {
      console.log('Websocket disconnected');
    }
  }
});

var websocketClient;
bittrex.websockets.client(function(client) {
  websocketClient = client;
});
```


#### Available methods
All of these methods will build a websocket client and attempt a connection if
you have not run ``websockets.client`` yourself. See ``examples/`` for a better
understanding.


#### websockets.listen, websockets.subscribe
This will subscribe to the global ticker updates and subscribe to several markets.

Note: It is recommended to use this in ``onConnect()`` -

```javascript
const bittrex = require('node-bittrex-api');

bittrex.options({
  websockets: {
    onConnect: function() {
    bittrex.websockets.listen();
    bittrex.websockets.subscribe(['BTC-ETH','BTC-SC','BTC-ZEN']);
  }
});

bittrex.websockets.client(function(client) {
  // connected - you can do any one-off connection events here
  //
  // Note: Reoccuring events like listen() and subscribe() should be done
  // in onConnect so that they are fired during a reconnection event.
  (verbose ? console.log('Connected') : '');
});
```
#### These event handlers are called whenever a websocket message is received from bittrex. You can duplicate these if needed, multiple handlers will be called.

```javascript
bittrex.on('summary delta', function(msg) {
  console.log('Summary Delta', JSON.stringify(msg, null, 1));
});
bittrex.on('exchange delta', function(msg, orderbook) {
  console.log('Exchange Delta:', JSON.stringify(msg,null,1));
  console.log('Orderbook:', JSON.stringify(orderbook,null,1));
});
```

#### Websocket serviceHandlers example
You can override the libraries logic for the following events. Note, this will
replace the libraries logic.
```javascript
bittrex.websockets.client(function(client) {
  client.serviceHandlers.reconnecting = function (message) {
    return true; // set to true stops reconnect/retrying
  }

  client.serviceHandlers.messageReceived = function (message) {
    console.log(message); // the messages received must be parsed as json first e.g. via jsonic(message.utf8Data)
  }
});
```

all possible serviceHandlers
```javascript
bound: function() { console.log("Websocket bound"); },
connectFailed: function(error) { console.log("Websocket connectFailed: ", error); },
connected: function(connection) { console.log("Websocket connected"); },
disconnected: function() { console.log("Websocket disconnected"); },
onerror: function (error) { console.log("Websocket onerror: ", error); },
messageReceived: function (message) { console.log("Websocket messageReceived: ", message); return false; },
bindingError: function (error) { console.log("Websocket bindingError: ", error); },
connectionLost: function (error) { console.log("Connection Lost: ", error); },
reconnecting: function (retry { inital: true/false, count: 0} ) {
  console.log("Websocket Retrying: ", retry);
  //return retry.count >= 3; // cancel retry true
  return true;
}
```

Examples
--
After configuration you can use the object right away:
example #1
```javascript
var data = await bittrex.getmarketsummaries(  );
for( var i in data.result ) {
  bittrex.getticker( { market : data.result[i].MarketName }).then( ticker=> {
    console.log( ticker );
  });
}
```

Libraries
--

Websockets depends on the following npm packages:
- signalR websockets client https://www.npmjs.com/package/signalrjs
- jsonic JSON parser https://www.npmjs.com/package/jsonic
- cloudscraper https://www.npmjs.com/package/cloudscraper
- simple-rate-limiter https://www.npmjs.com/package/simple-rate-limiter


Other libraries utilized:
- request https://www.npmjs.org/package/request

Error examples
---

Example of request/domain based errors (not Bittrex API error)
```javascript
var url = 'http://fake.bittrex.com/api/v1.1/public/getticker?market=USDT-BTCXXX';
bittrex.sendCustomRequest( url, function( data, err ) {
  if (err) {
    /**
      {
        success: false,
        message: 'URL request error',
        error:
         { Error: getaddrinfo ENOTFOUND fake.bittrex.com fake.bittrex.com:80
             at errnoException (dns.js:28:10)
             at GetAddrInfoReqWrap.onlookup [as oncomplete] (dns.js:76:26)
           code: 'ENOTFOUND',
           errno: 'ENOTFOUND',
           syscall: 'getaddrinfo',
           hostname: 'fake.bittrex.com',
           host: 'fake.bittrex.com',
           port: 80 },
        result: undefined
      }
    */
    return console.error(err);
  }
  console.log(data);
});
```

Example of request/url based errors (not Bittrex API error)
```javascript
var url = 'http://bittrex.com/api/v1.1/public/getfakeendpoint';
bittrex.sendCustomRequest( url, function( data, err ) {
  if (err) {
    /**
      {
        success: false,
        message: 'URL request error',
        error: undefined,
        result: {
          statusCode: 404,
          statusMessage: 'Not Found',
          body: '<!DOCTYPE html>\r\n<html > ...'
        }
      }
    */
    return console.error(err);
  }
  console.log(data);
});
```

Example of Bittrex API error
```javascript
bittrex.getcandles({
  marketName: 'USDT-BTC',
  tickInterval: 300
}, function(data, err) {
  if (err) {
    /**
      {
        success: false,
        message: 'INVALID_TICK_INTERVAL',
        result: null
      }
    */
    return console.error(err);
  }
  console.log(data);
});
```


Methods
----

Optional parameters may have to be looked up at https://bittrex.com/Home/Api.

> It may happen that some Bittrex API methods are missing, also they could have been forgotten in the documentation. In this case, if this strikes you, feel free to open a issue or send me a pull request.

> Also: the method **sendCustomRequest** enables completely custom requests, regardless the specific API methods.

##### sendCustomRequest
- url           String
- callback      Function
- credentials   Boolean     optional    whether the credentials should be applied to the request/stream or not, default is set to false.

example #1
```javascript
var url = 'https://bittrex.com/api/v1.1/public/getticker?market=BTC-LTC';
bittrex.sendCustomRequest( url, function( data, err ) {
  console.log( data );
});
```

example #2 (credentials applied to request/stream)
```javascript
bittrex.sendCustomRequest( 'https://bittrex.com/api/v1.1/account/getbalances?currency=BTC', function( data, err ) {
  console.log( data );
}, true );

will result in (the Header is being set too):
https://bittrex.com/api/v1.1/account/getbalances?currency=BTC&apikey=API_KEY&nonce=4456490600
```

##### getticker
```javascript
bittrex.getticker( { market : 'BTC-LTC' }, function( data, err ) {
  console.log( data );
});
```

##### getbalances
```javascript
bittrex.getbalances( function( data, err ) {
  console.log( data );
});
```

##### getmarkethistory
```javascript
bittrex.getmarkethistory({ market : 'BTC-LTC' }, function( data, err ) {
  console.log( data );
});
```

##### getmarketsummaries
```javascript
bittrex.getmarketsummaries( function( data, err ) {
  console.log( data );
});
```

##### getmarketsummary
```javascript
bittrex.getmarketsummary( { market : 'BTC-LTC'}, function( data, err ) {
  console.log( data );
});
```

##### getorderbook
```javascript
bittrex.getorderbook({ market : 'BTC-LTC', type : 'both' }, function( data, err ) {
  console.log( data );
});
```

##### getwithdrawalhistory
```javascript
bittrex.getwithdrawalhistory({ currency : 'BTC' }, function( data, err ) {
  console.log( data );
});
```

##### getdepositaddress
```javascript
bittrex.getdepositaddress({ currency : 'BTC' }, function( data, err ) {
  console.log( data );
});
```

##### getdeposithistory
```javascript
bittrex.getdeposithistory({ currency : 'BTC' }, function( data, err ) {
  console.log( data );
});
```

##### getbalance
```javascript
bittrex.getbalance({ currency : 'BTC' }, function( data, err ) {
  console.log( data );
});
```

##### withdraw
```javascript
bittrex.withdraw({ currency : 'BTC', quantity : '1.5112', address : 'THE_ADDRESS' }, function( data, err ) {
  console.log( data );
});
```


Supported v2 API methods
------

Little is known about the v2 api at present. We have support for only a few methods
with very little documentation. Given that the v2 api is still in development by
Bittrex it is possible these methods will change or become invalid without notice.

##### getcandles
```javascript
bittrex.getcandles({
  marketName: 'USDT-BTC',
  tickInterval: 'fiveMin', // intervals are keywords:  'oneMin', 'fiveMin', 'thirtyMin', 'hour', 'day'
}, function( data, err ) {
  console.log( data );
});
```

##### tradesell
```javascript
bittrex.tradesell({
  MarketName: 'BTC-ZEC',
  OrderType: 'LIMIT',
  Quantity: 1.00000000,
  Rate: 0.04423432,
  TimeInEffect: 'IMMEDIATE_OR_CANCEL', // supported options are 'IMMEDIATE_OR_CANCEL', 'GOOD_TIL_CANCELLED', 'FILL_OR_KILL'
  ConditionType: 'NONE', // supported options are 'NONE', 'GREATER_THAN', 'LESS_THAN'
  Target: 0, // used in conjunction with ConditionType
}, function( data, err ) {
  console.log( data );
});
```

##### tradebuy
```javascript
bittrex.tradebuy({
  MarketName: 'BTC-ZEC',
  OrderType: 'LIMIT',
  Quantity: 1.00000000,
  Rate: 0.04423432,
  TimeInEffect: 'IMMEDIATE_OR_CANCEL', // supported options are 'IMMEDIATE_OR_CANCEL', 'GOOD_TIL_CANCELLED', 'FILL_OR_KILL'
  ConditionType: 'NONE', // supported options are 'NONE', 'GREATER_THAN', 'LESS_THAN'
  Target: 0, // used in conjunction with ConditionType
}, function( data, err ) {
  console.log( data );
});
```


Testing
----

Installing test gear
```bash
npm install --only=dev
```

Running all tests
```bash
npm test tests
```

or individually
```bash
npm test tests/public.js
npm test tests/private.js
```

##### Testing private methods

Testing private method endpoints requires an api key/secret which should be
installed in to ``tests/config.json`` - you will find an example file in
``tests/config_example.json``.

```bash
cp tests/tests_example.json tests/config.json
vim tests/config.json
```
