const configuredBundles = [
	{ modules: 'plugin-shoelace', output: 'plugin-shoelace.js' },
	{ modules: 'app', output: 'app.js'}
]


const cluster = require('cluster');
const fs = require('fs')

if(cluster.isMaster){
	console.log('I AM THE MASTER OF MY FATE\nI AM THE CAPTAIN OF MY SOUL\n...and approximately 3 systemjs builder processes...\n\n')

	if(process.env.BUNDLE_CONFIG){
		var bundleConfig = JSON.parse(process.env.BUNDLE_CONFIG)	
	}else{
		var bundleConfig = {
			sourceMaps: false,
			lowResSourceMaps: false,
			mangle: true,
			minify: true,
			development: false,
			production: true,
			watch: false,
			bundleOutputDir: 'dist/'
		}
	}
	
	var initialBuildListeners = {}
	function forkBundle(expression, output, config){
		cluster.fork({
			BUNDLE_PARAMS: JSON.stringify({
				expression: expression,
				output: output,
				config: config
			})
		})
		return new Promise(function(resolve, reject){
			initialBuildListeners[output] = resolve;
		})
	}

	console.log(bundleConfig)

	configuredBundles.forEach(function(bundle){
		forkBundle(bundle.modules, bundleConfig.bundleOutputDir + bundle.output, bundleConfig)
	})

	var bundles = {}

	function updateBundleMaster(bundlename, modules){
		bundles[bundlename] = modules;

		var data = 'System.config(' + JSON.stringify({
			bundles: bundles
		}, null, '\t') + ');\n'

		fs.writeFile(bundleConfig.bundleOutputDir + 'bundle.config.js', data, 'utf8', function(err){
			if(!err) console.log('bundle.config.js written to disk', bundlename)
		})	

		if(bundlename in initialBuildListeners){
			initialBuildListeners[bundlename]()
			delete initialBuildListeners[bundlename]
		}
	}

	cluster.on('message', function(worker, message, handle) {
		if (arguments.length === 2) {
		    handle = message;
		    message = worker;
		    worker = undefined;
		}
		if(message.cmd === 'updateBundle'){
			updateBundleMaster(message.bundlename, message.modules)
		}
	});

	cluster.on('exit', (worker, code, signal) => {
		console.log('worker %d exited (code: %s)', worker.process.pid, signal || code);
	});
}else{
	var jspm = require('jspm');
	var ui = require('jspm/lib/ui.js');
	var bundle = require('jspm/lib/bundle.js')
	var updatedModules = []

	function updateBundle(bundlename, modules){
		process.send({ cmd: 'updateBundle', bundlename: bundlename, modules: modules });
	}

	ui.setResolver({
		emit: function(log, type, msg){
			// console.log('____', type, msg)
			var modulesRegex = /^  `(.+)`$/
			var bundleRegex = /^Built into `(.+)`/

			if(type === 'info' && modulesRegex.test(msg)){
				var filename = modulesRegex.exec(msg)[1];
				// console.log('WUMBO', filename)
				updatedModules.push(filename)
			}else if(type === 'ok' && bundleRegex.test(msg)){
				var bundlename = bundleRegex.exec(msg)[1];
				// console.log('DERP DERP', bundlename)
				updateBundle(bundlename, updatedModules)
				updatedModules = []
				
			}

			msg = msg || '';
	  		msg = msg.toString();
	  		if (type) msg = (ui.format[type] || ui.format.info)(msg.toString());


			if (type != 'err')
		        console.log(msg);
		      else
		        console.error(msg);
		}
	});

	ui.useDefaults(false);


	var packet = JSON.parse(process.env.BUNDLE_PARAMS);
	bundle.bundle(
		packet.expression,
		packet.output,
		packet.config
	).then(function(){
		if(!packet.config.watch){
			setTimeout(function(){
				console.log('Worker quitting: ', packet.output)	
				process.exit(0)
			}, 500)
		}
	})
}
