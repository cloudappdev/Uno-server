var http = require('http');
var url = require('url');
var Imap = require('imap');
var crypto = require('crypto');

function User(imap_handle, session_id, push_id) {
    this.imap_handle = imap_handle;
    this.session_id = session_id;
    this.push_id = push_id;
    
    User.prototype.getImapHandle = function() {
        return this.imap_handle;
    }
    User.prototype.getSessionID = function() {
        return this.session_id;
    }
    User.prototype.getPushID = function() {
        return this.push_id;
    }
}


function Message(to, from, subject, body) {
    this.to = to;
    this.from = from;
    this.subject = subject;
    this.body = body;
}


var genSessionID = function() {
    var sha = crypto.createHash('sha256');
    sha.update(Math.random.toString());
    return sha.digest('hex');
}

var users = {};

http.createServer(function(req, res) {
    var request_url = url.parse(req.url);
    if (request_url.pathname == '/login') {
        if (req.method == 'POST') {
            var body = '';
            req.on('data', function(data) {
                body += data;
            });
            req.on('end', function() {
                console.log('Got data');
                try {
                    var request_json = JSON.parse(body);
                    console.log(request_json);
                    if (request_json.email != undefined &&
                        request_json.password != undefined) {
                        var imap_handle = new Imap ({
                            user: request_json.email,
                            password: request_json.password,
                            host: 'imap.gmail.com',
                            port: 993,
                            tls: true,
                            tlsOptions: {rejectUnauthorized: false},
                            debug: function(message) {console.log(message)}
                        });
                        var sess_id = genSessionID();
                        var new_user = new User(imap_handle, sess_id, null);
                        users[request_json.email] = new_user;
                        console.log(users[request_json.email]);
                        var json_success = {'success': true, 'email':
                                            request_json.email, 'session_id':
                                            sess_id};
                        console.log(json_success);
                        var response_json = JSON.stringify(json_success);
                        console.log(response_json);
                        res.writeHead(200, {'Content-Type':
                                            'application/json'});
                        res.end(response_json);
                    }
                } catch (err) {
                    var json_err = {'success': false, 'error': err};
                    var response_json = JSON.stringify(json_err);
                    console.log(response_json);
                    res.writeHead(200, {'Content-Type': 'application/json'});
                    res.end(response_json);
               }
            });
        }
    } else if (request_url.pathname == '/push') {
        if (req.method == 'POST') {
            var body = '';
            req.on('data', function(data) {
                body += data;
            });
            req.on('end', function() {
                //try {
                    var request_json = JSON.parse(body);
                    console.log(request_json);
                    var imap = users[request_json.email].getImapHandle();
                    console.log(imap);
                    imap.on('ready', function() {
                        imap.openBox('INBOX', true, function(err, box) {
                            console.log(box.name + ' Opened');
                        });
                    });
                    imap.on('mail', function(num) {
                        console.log('You have ' + num + ' new emails');
                    });
                    //console.log(users[request_json.email].getImapHandle());
                    imap.connect();
                    //setTimeout(function() {imap.end();}, 120000);
                //} catch (err) {
                    //console.log('Error');
                //}
            });
        }
    } else if (request_url.pathname == '/fetch') {
        console.log('Fetching');
        var body = '';
        req.on('data', function(data) {
            body += data;
        });
        req.on('end', function() {
            try {
                var request_json = JSON.parse(body);
                console.log(request_json);
                var imap = users[request_json.email].getImapHandle();
                var messages = Array();
                function openABox(cb) {
                    imap.openBox('INBOX', true, cb);
                }
                imap.on('ready', function() {
                    openABox(function(err, box) {
                      if (err) throw err;
                      var f = imap.seq.fetch(box.messages.total-10 + ':*', 
                          { bodies : ['HEADER.FIELDS (TO FROM SUBJECT)',
                                      'TEXT']});
                      f.on('message', function(msg, seqno) {
                          msg.on('body', function(stream, info) {
                              var buffer = '';
                              stream.on('data', function(chunk) {
                                  buffer += chunk.toString('utf8');
                              });
                              stream.once('end', function() {
                                  var headers = Imap.parseHeader(buffer);
                                  var m = new Message(headers.to, headers.from,
                                      headers.subject, buffer);
                                  messages.push(m);
                                  res.writeHead(200, {'Content-Type':
                                                     'application/json'});
                                  res.end(JSON.stringify(messages));
                              });
                          });
                      });
                      f.once('end', function() {
                          console.log('Done Fetching');
                          imap.end();
                      });
                   });
                });
                imap.connect();
            } catch (err) {
                console.log('An Error Occured');
            }
        });
    } else if (request_url.pathname == '/search') {
         console.log('Fetching');
        var body = '';
        req.on('data', function(data) {
            body += data;
        });
        req.on('end', function() {
            try {
                var request_json = JSON.parse(body);
                console.log(request_json);
                var imap = users[request_json.email].getImapHandle();
                var messages = Array();
                function openABox(cb) {
                    imap.openBox('INBOX', true, cb);
                }
                imap.on('ready', function() {
                    openABox(function(err, box) {
                      if (err) throw err;
                      imap.search([['TEXT', request_json.query] ],
                          function(err, results) {
                      if (err) throw err;
                      var f = imap.seq.fetch(results, 
                          { bodies : ''});
                      f.on('message', function(msg, seqno) {
                          msg.on('body', function(stream, info) {
                              var buffer = '';
                              stream.on('data', function(chunk) {
                                  buffer += chunk.toString('utf8');
                              });
                              stream.once('end', function() {
                                  var headers = Imap.parseHeader(buffer);
                                  var m = new Message(headers.to, headers.from,
                                      headers.subject, buffer);
                                  messages.push(m);
                                  res.writeHead(200, {'Content-Type':
                                                     'application/json'});
                                  res.end(JSON.stringify(messages));
                              });
                          });
                      });
                      f.once('end', function() {
                          console.log('Done Fetching');
                          imap.end();
                      });
                   });
                });
               });
                imap.connect();
            } catch (err) {
                console.log('An Error Occured');
            }
        });
    } else if (request_url.pathname == '/logout') {
        console.log('Logging you out');
    } else {
        console.log('Path ' + request.pathname + 
                    ' does not exist on this server');
    }
}).listen(5000, '127.0.0.1');
console.log('Server running on 127.0.0.1 on port 5000');
