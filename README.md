Coccyx
======

Coccyx uses mongodb's oplog and tailable cursors to allow realtime monitoring of updates, inserts, and removes.  Filter updates and removes by document ids, and inserts with a mongodb query object.  Every new log entry is exposed as an event that includes all available information about the log entry.

###What the heck is an Oplog?

If you are looking at Coccyx you probably already know this but...  Coccyx leverages the [MongoDB oplog](http://docs.mongodb.org/manual/core/replica-set-oplog/), by using [tailable cursors](http://docs.mongodb.org/manual/reference/method/cursor.addOption/#DBQuery.Option.tailable) to monitor changes.  The oplog is an internal capped collection that mongodb uses to track changes that modify data on a replica set's primary, so secondaries can update themselves accordingly.  Because of this, coccyx only works with replica sets, or sharded collections where each node is a replica set.  If you want to tinker with this, and aren't familliar with setting up sharded environments, reading through and potentially using [this gist](https://gist.github.com/JoeWagner/c2881417f4a997e0a155) might get you going.

**Important Disclaimer:** mongodb considers the oplog an internal collection.  That means they don't specify what it will look like, and they reserve the right to make changes without telling anybody.  With that said Leveraging the oplog for realtime updates is being used by some [significant projects](https://www.meteor.com/blog/2013/12/17/meteor-070-scalable-database-queries-using-mongodb-oplog-instead-of-poll-and-diff).

###Why build Coccyx?

I decided to build Coccyx, one becasue it was fun, and because I wanted a way to listen to the oplog for modifications to a specific set of documents on a sharded deployment and none of the existing solutions handled either of these. without significant overhead.

###How does it work?

First things first

```npm install coccyx```

then you can do ```var coccyx = require('coccyx');```.  Coccyx exports a sinlge instance of the Coccyx class.  This should be all you need, but the constructor is exposed at ```require('coccyx').Coccyx;```.

After that there is likely only two things you will want to do.
1. Connect to the database
2. Listen for changes to the oplog.  Although you may want to listen separately for diffenrent types of changes.

The Coccyx API is designed to best leverage the information available in the oplog.  Oplog entries are structured differently depending on the kind of operation.  For an insert, the oplog will return the entire document (including _id).  So if you want to listen for specific inserts, you need to provide a query object.  For an update or a remove operation, the oplog only tracks the _id of the document.  So if you want to listen for updates/removes on specific documents you need to provide an array of [ids as strings](http://docs.mongodb.org/manual/reference/method/ObjectId.toString/).
However, when you specify an insert query, and an operation matches it, Coccyx will add the _id of the new document to the array of ids for that tail.

Here's an example:
```javascript
var coccyx = require('coccyx');
// notice the second argument is an options object, and you must specify if you want to connect to a mongos.
coccyx.connect('mongodb://localhost:27018', {mongos: true}, function (err) {
    if (err) {}// handle connection error ...
   
    // listen to all operations on the users collection in the test db
    var tail = coccyx.addTail('test.users');
   
    // the wag event is triggered when matching operations happen
    tail.on('wag', function (data) {
        console.log(data.action); // insert, update, or delete
        console.log(data.doc); // on inserts you get the whole doc, on deletes and updates you get {_id: <id>}
        console.log(data.raw); // For your viewing pleasure the actual oplog document
    });
    
    // the second argument is a query to check all inserts against
    var tail1 = coccyx.addTail('test.users', {name: 'Dwight Merriman'});
   
    // this gets called anytime a document with name === 'Dwight Merriman' is inserted, then anytime that doc is updated or deleted
    tail1.on('wag', function (data) {
        // data has same structure as above...
    });
    
    // you can also specify an array of id strings
    var tail2 = coccyx.addTail('test.users', ['535dc4ff30b4dd236514384e']);
    
    // gets called when the document with the above id is updated or removed
    tail2.on('wag', function (data) {
        // data has same structure as above...
    });
    
    // or you can also specify both
    var tail3 = coccyx.addTail('test.users', {name: 'Dwight Merriman'}, ['535dc4ff30b4dd236514384e']);
    
    // gets called when the document with the above id is updated or removed, and when any document matching the query is inserted
    tail3.on('wag', function (data) {
        // data has same structure as above...
    });
});
```

