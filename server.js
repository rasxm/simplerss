/*
	Simple nodejs HTTP server to:
	
	1) Fetch XML RSS feeds from Sky and BBC
	2) Convert XML RSS feed to JSON
	3) Supply requested JSON feed to client
*/
var 
	http   = require('http'),
	fs     = require('fs'),
	xml2js = require('xml2js'),
	qs     = require('querystring');

/* HTTP service config */
var SERVICE_ROOT = '/rss/';
var SERVICE_PORT = 8080;
var MAXRSS       = 10;

/* RSS feed providers */
var rssProvider = {
	feed:
	[
		{ title: 'Sky - Home',       host: 'news.sky.com',     path: '/feeds/rss/home.xml' },
		{ title: 'Sky - Business',   host: 'news.sky.com',     path: '/feeds/rss/business.xml' },
		{ title: 'Sky - Politics',   host: 'news.sky.com',     path: '/feeds/rss/politics.xml' },
		{ title: 'Sky - Technology', host: 'news.sky.com',     path: '/feeds/rss/technology.xml' },
		{ title: 'BBC - Home',       host: 'feeds.bbci.co.uk', path: '/news/rss.xml' },
		{ title: 'BBC - Business',   host: 'feeds.bbci.co.uk', path: '/news/business/rss.xml' },
		{ title: 'BBC - Politics',   host: 'feeds.bbci.co.uk', path: '/news/politics/rss.xml' },
		{ title: 'BBC - Technology', host: 'feeds.bbci.co.uk', path: '/news/technology/rss.xml' }
	]
}

/* 
	description : Sort object by provided key 
*/
function sortObject(objects, key, sortOrder)
{
	objects.sort(function() 
	{
		return function(a, b)
		{
			var a = a[key];
			var b = b[key];
			if (a === b) {
				return 0;
			}
			return a > b ? -sortOrder : sortOrder;        
		};
	}());
}

/*
	description : Parse RSS XML, convert to JSON 
*/
function parseRSS(data)
{
	var parser = new xml2js.Parser();
	var rss    = [];

	parser.parseString(data, function (err, result)
	{
		var channel = result.rss.channel[0];
		var logo    = channel.image[0];
		var items   = channel.item;
		var nItems  = channel.item.length;

		/* Want items in date descending order */
		items.sort(function(a,b){
			a = new Date(a.pubDate);
			b = new Date(b.pubDate);
			return a < b ? 1 : a > b ? -1 : 0;
		});

		for (var i = 0; (i < nItems) && (i < MAXRSS); i++)
		{
			var o = 
			{
				id: i,
				description: items[i].description[0],
				pubDate: items[i].pubDate[0],
				link: items[i].link[0]
			};

			if (items[i]['media:thumbnail'] !== undefined)
				o.media = items[i]['media:thumbnail'][0]['$'].url;
			
			rss.push(o);
		}
	});

	return rss;
}

/* 
	description : Read and return file contents 
*/
function staticFile(fileName, res)
{
	var fileContents = '';

	try
	{
		fileContents = fs.readFileSync(__dirname + fileName, 'utf8');
	} 
	catch(err) 
	{
		res.writeHead(404);
		res.end('404 : ' + fileName + ' not found');
		return;
	}

	res.writeHead(200);
	res.end(fileContents);
}

/* 
	description  : Return list of master RSS feeds 
	route : /rsslist
*/
function feedServices(res)
{
	res.writeHead(200, {"Content-Type": "application/json"});
	res.end(JSON.stringify(rssProvider));
}

/* 
	description  : Fetch, convert, return requested RSS feed 
	route : /rssfeed
*/
function getFeed(req, res)
{
	var body = "";

	req.on('data', function (data) {
		body += data;
	});

	req.on('end', function () {

		var POST = qs.parse(body);
		http.request(POST, function requestCallback(response) {

			var str = '';

			/* Feed chunk */
			response.on('data', function (chunk) {
				str += chunk;
			});

			/* Feed request done */
			response.on('end', function () {
			var rssFeed = {
				feed : parseRSS(str)
			}
				res.writeHead(200, {"Content-Type": "application/json"});
				res.end(JSON.stringify(rssFeed));
			});

		}).end();
	});
}

/* 
	description  : HTTP service request dispatcher 
	route : /
*/
var requestListener = function (req, res) {

	switch (req.url)
	{
		case '/': 
		case '/favicon.ico':
			staticFile(SERVICE_ROOT + 'index.html', res);
			break;
		case '/rsslist':
			feedServices(res);
			break;
		case '/rssfeed': 
			getFeed(req, res);
			break;
		default: 
			staticFile(SERVICE_ROOT + req.url, res);
	}
}

/* Start HTTP service */
console.log("Listening for connections on port '" + SERVICE_PORT + "'");
var server = http.createServer(requestListener);
server.listen(SERVICE_PORT);
