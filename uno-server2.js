var http = require('http');
var url = require('url');
var Imap = require('imap');


var imp;

http.createServer(function(req, res) {
    var requestURL = url.parse(req.url);
    if (requestURL.pathname == '/login') {
        var body = '';
        req.on('data', function(data) {
            body += data;
        });
        req.on('end', function() {
            var myOBJ = JSON.parse(body);
            console.log(myOBJ);
        });
        console.log('Login');
        imp = new Imap({
            user: 'moddroid8@gmail.com',
            password: 'cyanogenmod',
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false }
        });
            imp.on('mail', function(num) {
                console.log('You have mail');
            });
        imp.connect();
        console.log(imp);
    } else if (requestURL.pathname == '/fetch') {
        console.log('Fetch');
    } else if (requestURL.pathname == '/push') {
        console.log('Push');
    } else if (requestURL.pathname == '/search') {
        console.log('Search');
    } else if (requestURL.pathname == '/logout') {
        console.log('Logout');
        imp.end();
    } else {
        console.log('Unknown');
    }
}).listen(5000, '127.0.0.1');
console.log('Server running on 127.0.0.1 on port 5000');
