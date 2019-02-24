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

module.exports.expandKeys = expandKeys;
