const _ = require('lodash');
var mapShortToLong = {
	"A"  : "Ask",
	"a"  : "Available",
	"B"  : "Bid",
	"b"  : "Balance",
	"C"  : "Closed",
	"c"  : "Currency",
	"CI" : "CancelInitiated",
	"D"  : "Deltas",
	"d"  : "Delta",
	"DT" : "OrderDeltaType",
	"E"  : "Exchange",
	"e"  : "ExchangeDeltaType",
	"F"  : "FillType",
	"FI" : "FillId",
	"f"  : "Fills",
	"G"  : "OpenBuyOrders",
	"g"  : "OpenSellOrders",
	"H"  : "High",
	"h"  : "AutoSell",
	"I"  : "Id",
	"i"  : "IsOpen",
	"J"  : "Condition",
	"j"  : "ConditionTarget",
	"K"  : "ImmediateOrCancel",
	"k"  : "IsConditional",
	"L"  : "Low",
	"l"  : "Last",
	"M"  : "MarketName",
	"m"  : "BaseVolume",
	"N"  : "Nonce",
	"n"  : "CommissionPaid",
	"O"  : "Orders",
	"o"  : "Order",
	"OT" : "OrderType",
	"OU" : "OrderUuid",
	"P"  : "Price",
	"p"  : "CryptoAddress",
	"PD" : "PrevDay",
	"PU" : "PricePerUnit",
	"Q"  : "Quantity",
	"q"  : "QuantityRemaining",
	"R"  : "Rate",
	"r"  : "Requested",
	"S"  : "Sells",
	"s"  : "Summaries",
	"T"  : "TimeStamp",
	"t"  : "Total",
	"TY" : "Type",
	"U"  : "Uuid",
	"u"  : "Updated",
	"V"  : "Volume",
	"W"  : "AccountId",
	"w"  : "AccountUuid",
	"X"  : "Limit",
	"x"  : "Created",
	"Y"  : "Opened",
	"y"  : "State",
	"Z"  : "Buys",
	"z"  : "Pending"
};

function expandKeys(o, responseType){
    var build, key, destKey, ix, value;

    if(Array.isArray(o))
    {
		build = [];
		for(ix = 0; ix < o.length; ix++) {
			build.push(expandKeys(o[ix], responseType));
		}
	} else {
	    build = {};
		for (key in o) {
			// Get the destination key
			destKey = mapShortToLong[key] || key;

			// Get the value
			value = o[key];

			// If this is an object, recurse
			if (typeof value === "object") {
				value = expandKeys(value, responseType);
			}

			// Set it on the result using the destination key
				build[destKey] = ((destKey == "Type") ? upType(value, responseType) : value);
		}
	}
    return build;
};

function upType(__id, responseType) {
  const upTypes = [
	  {id: 0, upType: 'Add'		, stType: 'open'},
	  {id: 1, upType: 'Remove', stType: 'partial'},
	  {id: 2, upType: 'Update', stType: 'fill'},
		{id: 3, upType: ''			, stType: 'cancel'}
  ]
//  let filter = upTypes.filter(function(__obj) {
//    return __obj.id === __id
//  })
  return ((responseType === 'uO') ? upTypes[__id].stType : upTypes[__id].upType);
}

function updated_order(__order) {
  const map = _.map([__order], function(__obj) {
    const order = __obj.o
    const info = _.mapKeys(order, function(__val, __key) {
      let key_long = map_keys(__key)
      return key_long
    })

    return {
      status: status(__obj.TY),
      amount: __obj.o.Q,
      remaining: __obj.o.q,
      price: __obj.o.X,
      average: __obj.o.PU,
      uuid: __obj.o.U,
      id: __obj.o.OU,
      market_name: __obj.o.E,
      symbol: symbol(__obj.o.E),
      side: side(__obj.o.OT),
      info: info
    }
  })

  return map[0]

}

function updated_balance(__balance) {
  return _.mapKeys(__balance, function(__val, __key) {
    let key_long = map_keys(__key)
    return key_long
  })
}

function summary_current_market(__summary) {
  return _.mapKeys(__summary, function(__val, __key) {
    let key_long = map_keys(__key)
    return key_long
  })
}

function symbol (__market) {
  let split = __market.split('-')
  let base = split[0]
  let comp = split[1]
  return comp + '/' + base
}

function side(__order_type) {
  if (__order_type === 'LIMIT_BUY') {
    return 'buy'
  } else if (__order_type === 'LIMIT_SELL') {
    return 'sell'
  }
}

function status(__id) {
  const types = [
  	{id: 0, status: 'open'},
  	{id: 1, status: 'partial'},
  	{id: 2, status: 'fill'},
  	{id: 3, status: 'cancel'}
  ]
  let filter = types.filter(function(__obj) {
    return __obj.id === __id
  })
  return filter[0].status
}

function map_keys(__key) {
  const min_keys = [
    {
      key: 'A',
      val: 'Ask'
    },
    {
      key: 'a',
      val: 'Available'
    },
    {
      key: 'B',
      val: 'Bid'
    },
    {
      key: 'b',
      val: 'Balance'
    },
    {
      key: 'C',
      val: 'Closed'
    },
    {
      key: 'c',
      val: 'Currency'
    },
    {
      key: 'D',
      val: 'Deltas'
    },
    {
      key: 'd',
      val: 'Delta'
    },
    {
      key: 'E',
      val: 'Exchange'
    },
    {
      key: 'e',
      val: 'ExchangeDeltaType'
    },
    {
      key: 'F',
      val: 'FillType'
    },
    {
      key: 'f',
      val: 'Fills'
    },
    {
      key: 'G',
      val: 'OpenBuyOrders'
    },
    {
      key: 'g',
      val: 'OpenSellOrders'
    },
    {
      key: 'H',
      val: 'High'
    },
    {
      key: 'h',
      val: 'AutoSell'
    },
    {
      key: 'I',
      val: 'Id'
    },
    {
      key: 'i',
      val: 'IsOpen'
    },
    {
      key: 'J',
      val: 'Condition'
    },
    {
      key: 'j',
      val: 'ConditionTarget'
    },
    {
      key: 'K',
      val: 'ImmediateOrCancel'
    },
    {
      key: 'k',
      val: 'IsConditional'
    },
    {
      key: 'L',
      val: 'Low'
    },
    {
      key: 'l',
      val: 'Last'
    },
    {
      key: 'M',
      val: 'MarketName'
    },
    {
      key: 'm',
      val: 'BaseVolume'
    },
    {
      key: 'N',
      val: 'Nonce'
    },
    {
      key: 'n',
      val: 'CommissionPaid'
    },
    {
      key: 'O',
      val: 'Orders'
    },
    {
      key: 'o',
      val: 'Order'
    },
    {
      key: 'P',
      val: 'Price'
    },
    {
      key: 'p',
      val: 'CryptoAddress'
    },
    {
      key: 'Q',
      val: 'Quantity'
    },
    {
      key: 'q',
      val: 'QuantityRemaining'
    },
    {
      key: 'R',
      val: 'Rate'
    },
    {
      key: 'r',
      val: 'Requested'
    },
    {
      key: 'S',
      val: 'Sells'
    },
    {
      key: 's',
      val: 'Summaries'
    },
    {
      key: 'T',
      val: 'TimeStamp'
    },
    {
      key: 't',
      val: 'Total'
    },
    {
      key: 'U',
      val: 'Uuid'
    },
    {
      key: 'u',
      val: 'Updated'
    },
    {
      key: 'V',
      val: 'Volume'
    },
    {
      key: 'W',
      val: 'AccountId'
    },
    {
      key: 'w',
      val: 'AccountUuid'
    },
    {
      key: 'X',
      val: 'Limit'
    },
    {
      key: 'x',
      val: 'Created'
    },
    {
      key: 'Y',
      val: 'Opened'
    },
    {
      key: 'y',
      val: 'State'
    },
    {
      key: 'Z',
      val: 'Buys'
    },
    {
      key: 'z',
      val: 'Pending'
    },
    {
      key: 'CI',
      val: 'CancelInitiated'
    },
    {
      key: 'FI',
      val: 'FillId'
    },
    {
      key: 'DT',
      val: 'OrderDeltaType'
    },
    {
      key: 'OT',
      val: 'OrderType'
    },
    {
      key: 'OU',
      val: 'OrderUuid'
    },
    {
      key: 'PD',
      val: 'PrevDay'
    },
    {
      key: 'TY',
      val: 'Type'
    },
    {
      key: 'PU',
      val: 'PricePerUnit'
    }
  ]
  return _.filter(min_keys, function(__obj) {
    return __obj.key === __key
  })[0].val
}

module.exports.expandKeys = expandKeys;
/*
module.exports.updated_order =updated_order;
module.exports.updated_balance =updated_balance;
module.exports.summary_current_market =summary_current_market;
*/
