var http = require('http');
var url = require('url');
var qs = require('querystring');
var fs = require('fs');

http.createServer(function(req, res) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    var u = url.parse(req.url);
    var postData = '';
    var body = '';
    if (u.pathname == '/login') {
        if (req.method == 'POST') {
            req.on('data', function(data) {
                body += data;
            });
           req.on('end', function() {
               postData = qs.parse(body);
               res.write('Username: ' + postData.username);
               res.write('<br>');
               res.end('Password: ' + postData.password);
           });
        }
    } else if (u.pathname == '/logout') {
        res.end('You are now logged out');
    } else {
        res.write(fs.readFileSync(__dirname + '/login.html'));
        res.end();
    }
}).listen(80, '127.0.0.1');
console.log('Server running on 127.0.0.1 on Port 80');
