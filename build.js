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

	fs.writeFile(bundleConfig.bundleOutputDir + 'bundle.config.js', "document.write(" + JSON.stringify(
		"Building bundle...."
	) + ")", 'utf8', function(err){
		if(!err) console.log('bundle.config.js written to disk')
	})


	configuredBundles.forEach(function(bundle){
		forkBundle(bundle.modules, bundleConfig.bundleOutputDir + bundle.output, bundleConfig)
	})

	var bundles = {}
	var bundleErrors = {}

	function updateBundleMaster(bundlename){
		var data = 'System.config(' + JSON.stringify({
			bundles: bundles
		}, null, '\t') + ');\n'

		Object.keys(bundleErrors).forEach(function(bundle){
			data += '\ndocument.write(' + JSON.stringify(
				"ERROR BUILDING " + bundle + "<div><pre>" + bundleErrors[bundle] + "</pre></div>"
			) + ');\n';
		})

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
			bundles[message.bundlename] = message.modules;
			delete bundleErrors[message.bundlename];

			updateBundleMaster(message.bundlename)
		}else if(message.cmd === 'updateError'){
			bundleErrors[message.bundlename] = message.error;
			bundles[message.bundlename] = [];

			updateBundleMaster(message.bundlename)
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

	function updateError(bundlename, error){
		process.send({ cmd: 'updateError', bundlename: bundlename, error: error });
	}

	var packet = JSON.parse(process.env.BUNDLE_PARAMS);

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
				// var bundlename = bundleRegex.exec(msg)[1];
				// console.log('DERP DERP', bundlename)
				updateBundle(packet.output, updatedModules)
				updatedModules = []
			}

			msg = msg || '';
	  		msg = msg.toString();

	  		if(type === 'err'){
				updateError(packet.output, msg)
			}

	  		if (type) msg = (ui.format[type] || ui.format.info)(msg.toString());


			if (type != 'err')
		        console.log(msg);
		      else
		        console.error(msg);
		}
	});

	ui.useDefaults(false);


	
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
	}).catch(function(){
		console.log('ERROR INITIAL BUILD FAILED')
	})
}
