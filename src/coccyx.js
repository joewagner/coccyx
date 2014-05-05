
var muri = require('muri');
var MongoClient = require('mongodb').MongoClient;
var Server = require('mongodb').Server;
var Timestamp = require('mongodb').Timestamp;
var async = require('async');
var Tail = require('./tail');



// ------- Coccyx Class --------

var Coccyx = function () {
    this.connections = [];
    this.oplogs = [];
    this.tails = [];
};

// module exports an instance of this class
// this exposes the Constructor in case more instances are needed
Coccyx.prototype.Coccyx = Coccyx;

Coccyx.prototype.Tail = Tail;

Coccyx.prototype.connect = function (uri, options, done) {
    var self = this;

    // setup default args
    if (typeof options === 'function') {
        done = options;
        options = {};
    }
    options || (options = {});
    uri || (uri = 'mongodb://localhost:27017');

    if (options.mongos) {

        // connect to mongos, then connect to the local db on each shard
        self._connectToMongos(uri, options, done);

    } else {

        MongoClient.connect(uri, function (err, local) {
            if (err) { return done(err); }
            connectToOplog.call(self, local, done);
        });

    }
};

Coccyx.prototype.addTail = function (namespace, query, idArray) {
    if (query instanceof Array) {
        // swap query and idArray
        idArray = [query, query = idArray][0];
    }

    var tail = new Tail(namespace, query, idArray);
    for (var i = 0; i < this.oplogs.length; i++) {
        attachTail(this.oplogs[i], tail);
    }
    this.tails.push(tail);
    return tail;
};

Coccyx.prototype.removeAllTails = function () {
    var l = this.tails.length;
    for (var i = 0; i < l; i++) {
        this.tails.pop().removeAllListeners();
    }
};

Coccyx.prototype.destroy = function (done) {
    var self = this;

    done || (done = function () {});

    this.removeAllTails();

    async.whilst(function () {
        return self.connections.length
    }, function (next) {
        self.connections.pop().close(true, next);
    }, done);        
};

// connect to a single mongos and 
Coccyx.prototype._connectToMongos = function (uri, options, done) {
    var self = this;

    var uriObject = muri(uri);

    var host = uriObject.hosts[0];

    var mongoClient = new MongoClient(new Server(host.host, host.port));

    mongoClient.open(function (err, mongoClient) {
        if (err) { return done(err); }
        
        // connect to mongos and sniff out each database
        var config = mongoClient.db('config');

        config.collection('shards', function (err, coll) {
            if (err) { return done(err); }
            coll.find({}, function (err, shards) {
                if (err) { return done(err); }

                var connectionStrings = [];
                shards.toArray(function (err, shardArray) {
                    shardArray.forEach(function (shard) {
                        if (err) { return done(err); }

                        // find the seed lists for each shard's replica set
                        // If the shard is a replica set the host field for each
                        // shard will be formatted as <replica set name>/<seed list>
                        var uriArray = shard.host.split('/');

                        if (uriArray.length !== 2) {
                            return done(new Error('All shards must be replica sets'));
                        }
                        // shift the replica set name off the array
                        var setName = uriArray.shift();

                        connectionStrings.push('mongodb://' + uriArray[0] + '/local?replicaSet=' + setName);

                    });

                    async.each(connectionStrings, function (uri, next) {
                        MongoClient.connect(uri, function (err, local) {
                            if (err) { return next(err); }

                            // connecting to replica set
                            connectToOplog.call(self, local, next);
                        });
                    }, done);

                });

            });
        });
    });
};


var connectToOplog = function (local, done) {
    var self = this;

    this.connections.push(local);
    local.collection('oplog.rs', function (err, oplog) {
        if (err) { return done(err); }

        self.oplogs.push(oplog);
        done && done();
    });

};

var attachTail = function (oplog, tail) {
    // There is some potential here for concurrency issues here, but because the natural order
    // of the oplog is chronological and this is the most recent op and it will be very fast
    oplog.find({}, {sort: {$natural: -1}, limit: 1}).toArray(function (err, lastOp) {
        if (err) {
            console.log(err);
            // TODO: how to deal with errors?
            return tail.emit('error', err);
        }
        lastOp = lastOp[0];

        // get the last record in this oplog and use it to start listening for any new documents
        _attachTail(lastOp.ts, oplog, tail);
    });
};

var _attachTail = function (start, oplog, tail) {
    var cursor = getTailableCursor(start, oplog);

    tail._cursor = cursor;
    cursor.on('data', function (op) {
        // filter migrate operations at this layer
        if (!op.fromMigrate) {
            start = op.ts;
            tail.emit('_operation', op);
        }
    });

    cursor.on('error', function (err) {
        // TODO: deal with errors, maybe just emit on the tail? Just remember cursor timeout is an error...
        console.log('\nCursor Error:');
        console.error(err);
        throw err;
    });

    cursor.on('close', function (err) {
        attachTail(oplog, tail, start);
    });
};

var getTailableCursor = function (start, oplog) {
    return oplog.find({ts: {$gt: start}}, {tailable: true, awaitdata: true}).stream();
};

module.exports = new Coccyx();
