
var should = require('should');
var Coccyx = require('../index').Coccyx;
var Tail = require('../index').Tail;

describe('Coccyx', function () {

    describe('#addTail', function () {

        it('should be a method', function (done) {
            var coccyx = new Coccyx();

            coccyx.addTail.should.be.an.instanceOf(Function);

            done();
        });


        it('should accept array of ids and/or query object', function (done) {
            var namespace = 'test.coccyx';
            var query = {x: 'test'};
            var idArray = ['535dc4ff30b4dd236514384e', '535dc4ff30b4dd236515484e'];
            var tail = new Coccyx().addTail(namespace, idArray);

            tail.idArray.should.equal(idArray);

            var tail2 = new Coccyx().addTail(namespace, idArray, query);

            tail2.idArray.should.equal(idArray);
            tail2.query.should.equal(query);

            done();
        });

    });

});

describe('Tail', function () {

    it('should have namespace property', function (done) {
        var namespace = 'test.coccyx';
        var tail = new Tail(namespace);
        tail.namespace.should.equal(namespace);

        done();
    });

    it('should accept query and add as a property', function (done) {
        var namespace = 'test.coccyx';
        var query = {x: 'test'};
        var tail = new Tail(namespace, query);
        tail.query.should.equal(query);

        done();
    });

    it('should accept array of ids and add as a property', function (done) {
        var namespace = 'test.coccyx';
        var query = {x: 'test'};
        var idArray = ['535dc4ff30b4dd236514384e', '535dc4ff30b4dd236515484e'];
        var tail = new Tail(namespace, query, idArray);
        tail.query.should.equal(query);
        tail.idArray.should.equal(idArray);

        done();
    });

    describe('#matchQuery', function () {

        it('should be a method', function (done) {
            var tail = new Tail('test.coccyx_test');
            tail.matchQuery.should.be.an.instanceOf(Function);
            done();
        });

        describe('basic querys', function () {

            it('should match field values', function (done) {
                var tail = new Tail('test.coccyx_test', {x: 'test'});
                tail.matchQuery({x: '1'}).should.equal(false);
                tail.matchQuery({x: 'test'}).should.equal(true);
                done();     
            });

            it('should match against idArray', function (done) {
                var tail = new Tail('test.coccyx_test', void 0, ['535dc4ff30b4dd236514384e', '535dc4ff30b4dd236515484e']);
                tail.matchQuery({_id: '535dc4ff30b4dd236514356e'}).should.equal(false);
                tail.matchQuery({_id: '535dc4ff30b4dd236514384e'}).should.equal(true);
                done();     
            });

            it('should match against field values or idArray', function (done) {
                var query = {x: 'test2'};
                var tail = new Tail('test.coccyx_test', query, ['535dc4ff30b4dd236514384e', '535dc4ff30b4dd236515484e']);
                tail.matchQuery(query).should.equal(true);
                tail.matchQuery({_id: '535dc4ff30b4dd236514384e'}).should.equal(true);
                done();
            });

        });

        it('should update the idArray when inserts are matched', function (done) {
            var tail = new Tail('test.coccyx_test', {x: 'test3'});
            
            var id = '535dc4ff30b4dd236514384e';
            var doc = {
                _id: id,
                x: 'test3'
            };
            tail.matchQuery(doc).should.equal(true);
            tail.matchQuery({_id: id}).should.equal(true);
            done();
        });

    });

    describe('#chaseId', function () {

        it('should add an id to id array', function (done) {
            var tail = new Tail('test.coccyx_test');

            tail.chaseId('535dc4ff30b4dd236722484e');
            tail.idArray.length.should.equal(1);
            done();
        });

        it('should update the update remove matcher', function (done) {
            var tail = new Tail('test.coccyx_test', void 0, ['535dc4ff30b4dd236514384e', '535dc4ff30b4dd236515484e']);

            var newId = '535dc4ff30b4dd236722484e';
            tail.chaseId(newId);
            tail.updateRemoveMatcher({_id: newId}).should.be.true
            done();
        });

    });

    describe('#buildIdMather', function () {

        it('should return a function', function (done) {
            var tail = new Tail('test.coccyx_test');

            tail.buildIdMatcher.should.be.an.instanceOf(Function);
            done();
        });

        it('should match on an id in the idArray', function (done) {
            var newId = '535dc4ff30b4dd236722484e'
            var tail = new Tail('test.coccyx_test');

            tail.idArray = [newId];
            tail.buildIdMatcher();
            tail.updateRemoveMatcher({_id: newId}).should.be.true;

            done();
        });

    });

});
