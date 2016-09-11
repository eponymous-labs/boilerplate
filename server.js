const PORT = 2142

const cluster = require('cluster');

if(cluster.isMaster){

	var express = require('express');
	var http = require('http')
	var fs = require('fs')
	var fileWatcher = require('chokidar-socket-emitter');
	var path = require('path')

	var app = express();

	// app.use(express.static('static'));
	app.use(express.static('.'));

	// app.get(/(@\w+|anonymous\/)?[a-f0-9]{32}$/, function(_, res){
	//     res.sendFile('shoelace.html', { root: 'static' })
	// })

	// app.get('/', function(_, res){
	// 	res.sendFile('shoelace.html', { root: 'static' })
	// })

	// app.put('/nanocarbide/*', function(req, res){
	// 	// req.rawBody = '';
	// 	req.setEncoding('utf8');
	// 	var name = path.join(__dirname, req.path);
	// 	var file = fs.createWriteStream(name)
	// 	req.pipe(file)
	// 	// req.on('data', function(chunk) { 
	// 	// 	req.rawBody += chunk;
	// 	// });
	// 	req.on('end', function() {
	// 		console.log('saved to path', name)
	// 		res.end()
	// 	});
	// })

	var server = http.createServer(app);
	fileWatcher({ app: server });

	server.listen(PORT, function () {
		console.log('Listening on port ' + PORT);
	})


	process.env.BUNDLE_CONFIG = JSON.stringify({
		sourceMaps: true,
		lowResSourceMaps: false,
		mangle: false,
		minify: false,
		development: true,
		watch: true,
		bundleOutputDir: 'build/'
	})
}


require('./build.js')