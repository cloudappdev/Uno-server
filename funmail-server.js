var http = require('http');
var url = require('url');
var Imap = require('imap');
var crypto = require('crypto');
var redis = require('redis');
var MailParser = require('mailparser').MailParser;

var num_users = 0;
var users = {};
var messages = new Array();

var client = redis.createClient(10985, 'pub-redis-10985.us-east-1-3.3.ec2.garantiadata.com', { auth_pass: '$funmail1'});

client.on('error', function(err) {
    console.log('Error: ' + err);
});

var sendRes = function(res, HTTP_CODE, json) {
    res.writeHead(HTTP_CODE, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(json));
}

var validateReq = function(body, query_params_array) {
    try {
            var success = true;
            var request_json = JSON.parse(body);
            query_params_array.forEach(function(element) {
                if (!(element in request_json)) {
                    success = false;
                }
            });
            if (success) {
                return request_json;
            } else {
                return null;
            }
    } catch (err) {
        return null;
    }
}

var genAuthToken = function() {
    var sha = crypto.createHash('sha256');
    sha.update(Math.random.toString());
    return sha.digest('hex');
}

function Message(from, to, subject, date, text, html) {
    this.from = from;
    this.to = to;
    this.subject = subject;
    this.date = date;
    this.text = text;
    this.html = html;
}

var logout = function(id) {
    var imap_handle = users[id];
    imap_handle.end();
}

var doSearch = function(res, id, query) {
    doFetch(res, id, 0, query); 
}

var doFetch = function(res, id, num_msgs, query) {
    var imap_handle = users[id];
    imap_handle.openBox('INBOX', true, function(err, box) {
        //if (err) return null;
        //if (num_msgs > box.messages.total) return null;
        if (num_msgs < 0) num_msgs = box.messages.total;
        if (num_msgs == 0 && query) {
            imap_handle.search([['TEXT', query]], function(err, results) {
                console.log(results);
            });
            return;
        }
        var parsed_msgs = 0;
        var messages = new Array();
        var f = imap_handle.seq.fetch(1, { bodies: ''});
        f.on('message', function(msg, seqno) {
            mailparser = new MailParser();
            msg.on('body', function(stream, info) {
                stream.on('data', function(chunk) {
                    mailparser.write(chunk.toString());
                });
                stream.on('end', function() {
                    mailparser.end();
                    mailparser.on('end', function(mail) {
                        parsed_msgs++;
                        var message = new Message(mail.from, mail.to,
                                                  mail.subject, mail.date,
                                                  mail.text, mail.html);
                        messages.push(message);
                        if (parsed_msgs == num_msgs) {
                            var response_json = {'success': true,
                                                 'messages': messages};
                            sendRes(res, 200, response_json);
                        }
                    });
                });
            });
            msg.once('end', function() {
                console.log('Done with message');
            });
        });
        f.once('error', function(err) {
            sendRes(res, 400, {'success': false});
        });
        f.on('end', function() {
            console.log('Done with messages');
        });
    });
}

http.createServer(function(req, res) {
    var request_url_parts = url.parse(req.url).pathname.split('/');
    if (request_url_parts[1] == 'login') {
        if (req.method == 'POST') {
            var body = '';
            req.on('data', function(data) {
                body += data;
            });
            req.on('end', function() {
                var request_json = validateReq(body, ['email', 'password']);
                if (request_json != null) {
                    var imap_handle = new Imap({
                        user: request_json.email,
                        password: request_json.password,
                        host: 'imap.gmail.com',
                        port: 993,
                        tls: true,
                        tlsOptions: {rejectUnauthorized: false},
                        debug: function(message) {console.log(message);}
                    });
                    imap_handle.once('error', function(err) {
                        var response_json = {'success': false};
                        sendRes(res, 403, response_json);
                    });
                    imap_handle.once('ready', function() {
                        var auth_token = genAuthToken();
                        client.set(num_users, auth_token,
                            function(err, res2) {
                                if (res2 != null) {
                                    var response_json = {'success': true,
                                      'id': num_users,
                                      'auth_token': auth_token};
                                    users[num_users] = imap_handle;
                                    num_users++;
                                    sendRes(res, 200, response_json);
                                } else {
                                    var response_json = {'success': false};
                                    sendRes(res, 406, response_json);
                                }
                        });
                    });
               imap_handle.connect();
//               setTimeout(function(){imap_handle.end();},3000);
               } else {
                   var response_json = {'success': false}
                   sendRes(res, 400, response_json); 
               }
            });
        } else {
            var response_json = {'success': false}
            sendRes(res, 400, response_json);
        }
    } else if (request_url_parts[1] == 'messages') {
        if (!isNaN(request_url_parts[2])) {
            if (!isNaN(request_url_parts[3])) {
                doFetch(res, request_url_parts[2], request_url_parts[3], false);
            } else if (request_url_parts[3] == 'all'){
                doFetch(res, request_url_parts[2], -1, false);
            } else {
                var response_json = {'success': false};
                sendRes(res, 400, response_json);
            }
        } else {
            var response_json = {'success': false};
            sendRes(res, 400, response_json);
        }
    } else if (request_url_parts[1] == 'search') {
        if (!isNaN(request_url_parts[2])) {
           if (req.method == 'GET') {
               var query_params = url.parse(req.url, true).query;
               if ('query' in query_params) {
                   doSearch(res, request_url_parts[2], query_params['query']);
               }
           } 
        }
    } else {
        logout(0);
        sendRes(res, 200, {'success': true});
    }
}).listen(5000, '127.0.0.1');
console.log('Server listening on 127.0.0.1 on port 5000');
