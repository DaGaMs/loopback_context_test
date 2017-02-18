'use strict';
process.env.NODE_ENV='testing';

const lb     = require('loopback')
    , boot   = require('loopback-boot')
    , chai   = require('chai')
    , should = chai.should()
    , async  = require('async')
    , _      = require('lodash')
    , path   = require('path');

var request, listener;
describe("Note API", () => {
  var allowedDelay = 1500; // permissible time difference in ms between created and retrieved time
  var server, user, token;
  // Set up
  before( (done) => {
    async.waterfall([
      (next) => {
        server = lb();
        boot(server, path.resolve(__dirname, '../server'), next);
      },
      (next) => {
        var timeOut = setTimeout(next, 2000, "Creating server timed out");
        server.on("started", () => {
          clearTimeout(timeOut);
          next();
        });
        listener = server.listen(function() {
          var baseUrl = server.get('url').replace(/\/$/, '');
          console.log('Web server listening at: %s', baseUrl);
          server.emit('started');
        });
      },
      (next) => {
        request = require('supertest')('http://localhost:3066');
        request.json = function (verb, url) {
          return this[verb](url)
            .set('Content-Type', 'application/json')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/);
        };

        request.json('post', '/api/Users')
        .send({username: 'test', password: 'test123', email: 'test@test.com'})
        .end(next);
      },
      (res, next) => {
        user = res.body;
        request.json('post', '/api/Users/login')
        .send({username: 'test', password: 'test123'})
        .end(next);
      },
      (res, next) => {
        var act = res.body;
        token = act.id;
        next();
      }], done);
  });
  // Finally
  after( (done) => {
    listener.close(done);
  });
  
  describe("Filtering", () => {
    var note;
    it("should allow creating a test note", (done) => {
      request.json("post", '/api/notes')
      .send({title: "test", content: "lalalalala"})
      .set('Authorization', token)
      .expect(200)
      .end((err, res) => {
        should.not.exist(err);
        note = res.body;
        should.exist(note);
        done(err);
      });
    });

    it("should allow to fetch by filter", (done) => {
      request.json('get', '/api/notes?filter[where][title]=test')
      .set('Authorization', token)
      .expect(200)
      .end((err, res) => {
        should.not.exist(err);
        res.should.have.a.property('body');
        res.body.should.be.an("array");
        var notes = res.body;
        notes.should.be.an('array');
        notes.should.not.be.empty;
        notes.should.have.lengthOf(1);
        var note = notes[0];
        note.should.have.a.property('title');
        note.title.should.equal("test");
        note.should.have.a.property('userId');
        note.userId.should.equal(user.id);
        done(err);
      });
    });

    it("should allow to fetch by id", (done) => {
      request.json('get', '/api/notes/'+note.id)
      .set('Authorization', token)
      .expect(200)
      .end((err, res) => {
        should.not.exist(err);
        res.should.have.a.property('body');
        res.body.should.be.an("object");
        var note = res.body;
        note.should.have.a.property('title');
        note.title.should.equal("test");
        note.should.have.a.property('userId');
        note.userId.should.equal(user.id);
        done(err);
      });
    });
  });
});
