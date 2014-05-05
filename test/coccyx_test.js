
var should = require('should');
var Coccyx = require('../index').Coccyx;
var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
var EventEmitter = require('events').EventEmitter;

describe('coccyx', function () {

    var test, test2, mongosTest, test47, test57;
    before(function (done) {

        // Setup a bunch of connections
        // TODO: build a helper for this
        MongoClient.connect('mongodb://localhost:37017,localhost:37018/test', function (err, testDb) {
            if (err) { return done(err); }
            test = testDb;

            MongoClient.connect('mongodb://localhost:37017,localhost:37018/test2', function (err, test2Db) {
                if (err) { return done(err); }
                test2 = test2Db;

                MongoClient.connect('mongodb://localhost:27018/test', function (err, mongosDb) {
                    if (err) { return done(err); }

                    mongosTest = mongosDb;
                    MongoClient.connect('mongodb://localhost:47017,localhost:47018/test', function (err, testDb) {
                        if (err) { return done(err); }
                        test47 = testDb;

                        MongoClient.connect('mongodb://localhost:57017,localhost:57018/test', function (err, testDb) {
                            if (err) { return done(err); }
                            test57 = testDb;

                            done();
                        });
                    });
                });
            });
        });
    });

    var coccyx;
    beforeEach(function (done) {
        coccyx = new Coccyx();
        done();
    });

    it('should export an instance of Coccyx', function (done) {
        should.exist(coccyx);
        coccyx.should.be.an.instanceOf(coccyx.Coccyx);

        done();
    });

    it('should export an instance of Tail', function (done) {
        var Tail = require('../index').Tail;
        Tail.should.be.an.instanceOf(Function);

        done();
    });

    it('should expose a connect function', function (done) {
        should.exist(coccyx.connect);
        coccyx.connect.should.be.an.instanceOf(Function)

        done();
    });

    it('connect function should be able to connect to replica set', function (done) {
        coccyx.connect('mongodb://localhost:37017,localhost:37018/local', function (err) {
            if (err) { return done(err); }

            coccyx.connections.length.should.equal(1);
            done();
        });
    });

    it('connect function should be able to connect to mongos', function (done) {
        coccyx.connect('mongodb://localhost:27018', {mongos: true}, function (err) {
            if (err) { return done(err); }

            coccyx.connections.length.should.equal(3);
            done();
        });
    });

    it('should expose a destroy method', function (done) {
        should.exist(coccyx.destroy);
        coccyx.destroy.should.be.an.instanceOf(Function);

        done();
    });

    it('destroy method should disconnect all connections', function (done) {
        coccyx.connect('mongodb://localhost:27018', {mongos: true}, function (err) {
            if (err) { return done(err); }

            coccyx.destroy(function (err) {
                if (err) { return done(err); }

                coccyx.connections.length.should.equal(0);
                done();
            });
                
        });

    });

    it('should expose a addTail function', function (done) {
        should.exist(coccyx.addTail);
        coccyx.addTail.should.be.an.instanceOf(Function);

        done();
    });

    it('addTail function should return an EventEmitter', function (done) {
        coccyx.connect('mongodb://localhost:37017,localhost:37018/local', function (err) {
            if (err) { return done(err); }

            coccyx.connections.length.should.equal(1);
            coccyx.addTail('test.coccyx_test').should.be.an.instanceOf(EventEmitter);
            done();
        });
    });

    it('addTail function should listen on a specific namespace', function (done) {
        coccyx.connect('mongodb://localhost:37017,localhost:37018/local', function (err) {
            if (err) { return done(err); }

            coccyx.connections.length.should.equal(1);
            var tail = coccyx.addTail('test.coccyx_test')
            
            tail.on('error', function (err) {
                tail.removeAllListeners();
                done(err);
            });

            tail.on('wag', function (data) {
                
                tail.removeAllListeners();

                data.action.should.equal('insert');
                data.doc.x.should.equal('test');
                done();
            });


            test2.collection('coccyx_test').insert({x: 'test2'}, function (err) {
                if (err) { return done(err); }

                test.collection('coccyx_test').insert({x: 'test'}, function (err) {
                    if (err) { return done(err); }
                });
            });

        });
    });

    it('should listen on a specific query', function (done) {
        coccyx.connect('mongodb://localhost:27018', {mongos: true}, function (err) {
            if (err) { return done(err); }

            coccyx.connections.length.should.equal(3);
            var tail = coccyx.addTail('test.coccyx_test', {x: '1'});
            
            tail.on('error', function (err) {
                tail.removeAllListeners();
                done(err);
            });

            var count = 0;
            tail.on('wag', function (data) {
                data.action.should.equal('insert');
                data.doc.x.should.equal('1');
                tail.removeAllListeners();
                done();
            });

            var insertCallback = function (err) {
                if (err) { done(err); }
            };

            var coll = mongosTest.collection('coccyx_test');
            coll.insert({x: 'test'}, insertCallback);
            coll.insert({x: '1'}, insertCallback);
        });
    });

    it('should listen for documents with _id in id array', function (done) {
        var coll = mongosTest.collection('coccyx_test');

        coll.insert({x: 'id array test'}, function (err, docArray) {
            if (err) { return done(err); }
            var doc = docArray[0];

            coccyx.connect('mongodb://localhost:27018', {mongos: true}, function (err) {
                if (err) { return done(err); }

                coccyx.connections.length.should.equal(3);
                var tail = coccyx.addTail('test.coccyx_test', [doc._id]);
                
                tail.on('error', function (err) {
                    tail.removeAllListeners();
                    done(err);
                });

                var count = 0;
                tail.on('wag', function (data) {

                    data.action.should.equal('update');
                    data.doc._id.toString().should.equal(doc._id.toString());
                    tail.removeAllListeners();

                    done();
                });

                var cb = function (err) {
                    if (err) { done(err); }
                };

                coll.insert({x: 'test'}, cb);
                coll.update({_id: doc._id}, {name: 'success'}, cb);
            });
        });
    });

    it('should connect to all shards when using mongos', function (done) {
        coccyx.connect('mongodb://localhost:27018', {mongos: true}, function (err) {
            if (err) { return done(err); }

            coccyx.connections.length.should.equal(3);
            var tail = coccyx.addTail('test.coccyx_test')

            tail.on('error', function (err) {
                tail.removeAllListeners();
                done(err);
            });

            var count = 0;
            tail.on('wag', function (data) {
                // if the name is one of the names inserted for this test increase count
                // and remove the name from the list, this makes sure we don't have duplicates
                var indx;
                if (~(indx = insertNames.indexOf(data.doc.x))) {
                    count += 1;

                    data.action.should.equal('insert');
                    insertNames.splice(indx, 1);
                }
                if (count === 4) {
                    tail.removeAllListeners();
                    done();
                }
            });

            var insertCallback = function (err) {
                if (err) { done(err); }
            };

            var insertNames = [
                'tests',
                'test37',
                'test47',
                'test57'
            ];
            mongosTest.collection('coccyx_test').insert({x: insertNames[0]}, insertCallback);
            test.collection('coccyx_test').insert({x: insertNames[1]}, insertCallback);
            test47.collection('coccyx_test').insert({x: insertNames[2]}, insertCallback);
            test57.collection('coccyx_test').insert({x: insertNames[3]}, insertCallback);
        });
    });

    it('should automatically start tracting inserted documents that match the provided query', function (done) {

        coccyx.connect('mongodb://localhost:27018', {mongos: true}, function (err) {
            if (err) { return done(err); }

            coccyx.connections.length.should.equal(3);

            var coll = mongosTest.collection('coccyx_test');
            var name = 'lana del rey';
            var tail = coccyx.addTail('test.coccyx_test', {name: name});
            
            tail.on('error', function (err) {
                tail.removeAllListeners();
                done(err);
            });

            var count = 0;
            tail.on('wag', function (data) {
                count++;
                if (count === 1) {
                    data.action.should.equal('insert');
                    data.doc.name.should.equal(name);
                } else {
                    data.action.should.equal('update');
                    console.log(typeof data.doc._id.toString());
                    data.doc._id.toString().should.equal(docId.toString());

                    tail.removeAllListeners();
                    done();
                }
            });

            var cb = function (err) {
                if (err) { done(err); }
            };

            var docId;
            coll.insert({name: name}, function (err, doc) {
                if (err) { done(err); }

                doc.length.should.equal(1);
                docId = doc[0]._id;
                
                coll.update({_id: docId}, {$set: {name: 'success'}}, cb);
            });
            
        });
    });

});
