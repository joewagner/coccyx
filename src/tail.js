
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var matcher = require('./selector');


var opMap = {
    "i": "insert",
    "u": "update",
    "d": "delete"
};

// ---------- Tail Class ---------

var Tail = function (namespace, query, idArray) {
    if (!namespace) { throw new Error('Must instantiate Tail with a namespace'); }

    this.namespace = namespace;
    this.query = query;
    this.idArray = idArray || [];

    if (this.query) {
        this.insertMatcher = matcher.compileDocumentSelector(this.query);
    }
    if (this.idArray && this.idArray.length) {
        this.buildIdMatcher();
    }
        
    this.on('_operation', this.onOperation);
    this.on('removeListener', function (type) {
        if (type === '_operation') {
            this._cursor.removeAllListeners();
        }
    })
};

// Tail inherits from EventEmitter
util.inherits(Tail, EventEmitter);

Tail.prototype.onOperation = function (op) {
    var action;
    if (!(action = opMap[op.op])) { return; }

    var opDoc = getDocFromOp(op);

    if (this.namespace === op.ns && this.matchQuery(opDoc)) {
        this.emit('wag', {
            action: action,
            doc: opDoc,
            raw: op
        });
    }
};

Tail.prototype.matchQuery = function (mongoDoc) {
    var val;
    // if we have an insert matcher, check it
    if (this.insertMatcher) {
        if ((val = this.insertMatcher(mongoDoc)) && mongoDoc._id) {
            this.chaseId(mongoDoc._id);
        }
    }
    // if we have an update or remove matcher, and val is not true, check it
    if (this.updateRemoveMatcher && !val) {
        val = this.updateRemoveMatcher(mongoDoc);
    }
    // if the tail has no querys val will be undefined, which means all docs match
    if (typeof val === 'undefined') {
        return true;
    }
    return val;
};

Tail.prototype.buildIdMatcher = function() {
    // if array of "_id"s is supplied map it to an $or query
    this.updateRemoveMatcher = matcher.compileDocumentSelector({
        $or: this.idArray.map(function (id) { return {_id: id}; })
    });
};

Tail.prototype.chaseId = function (id) {
    this.idArray.push(id);
    this.buildIdMatcher(this.idArray);
};

// ---- private methods ----

var getDocFromOp = function (op) {
    if (op.o2) {
        return op.o2;
    }
    return op.o;
};

module.exports = Tail;